
import { NextRequest, NextResponse } from 'next/server';
import { sql, safeInt, sqlInt, toMysqlDatetime } from '@/lib/data/db';
import { getSession, verifyPassword } from '@/lib/security/auth';
import { writeAuditLog } from '@/lib/security/auditlog';
import { SESSION_DURATION_HOURS } from '@/lib/constants';

// PERF-W5: GET tanpa LIMIT bisa load ribuan row kalau user_sessions tumbuh.
// Default 100/page (ceiling) + prune row invalidated > 30 hari supaya tabel
// tidak grow tak terkendali. Frontend backward-compat: `data` tetap array.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT     = 500;
const PRUNE_DAYS    = 30;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 403 });
  }

  // Parse & clamp pagination params
  const url      = new URL(req.url);
  const reqLimit = safeInt(url.searchParams.get('limit'), DEFAULT_LIMIT);
  const limit    = Math.min(Math.max(reqLimit, 1), MAX_LIMIT);
  const offset   = Math.max(safeInt(url.searchParams.get('offset'), 0), 0);

  // Auto-cleanup #1: ghost sessions — JWT expired in browser but DB record never cleaned up.
  // Compute cutoff in JS (avoids INTERVAL param issue). Use try/catch — SqlFragment is PromiseLike, has no .catch()
  const cutoff = toMysqlDatetime(new Date(Date.now() - SESSION_DURATION_HOURS * 60 * 60 * 1000));
  try {
    await sql`
      UPDATE user_sessions
      SET invalidated_at = NOW()
      WHERE invalidated_at IS NULL
        AND last_active < ${cutoff}
    `;
  } catch { /* silent — cleanup best-effort, jangan block response */ }

  // Auto-cleanup #2 (PERF-W5): prune row invalidated > 30 hari supaya tabel
  // tidak tumbuh tak terbatas. Best-effort, jangan blokir response kalau gagal.
  const pruneCutoff = toMysqlDatetime(new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000));
  try {
    await sql`
      DELETE FROM user_sessions
      WHERE invalidated_at IS NOT NULL
        AND invalidated_at < ${pruneCutoff}
    `;
  } catch { /* silent — prune best-effort */ }

  // Count total active sessions (untuk pagination metadata)
  const countRows = await sql`
    SELECT COUNT(*) AS total
    FROM user_sessions s
    WHERE s.invalidated_at IS NULL
  ` as Array<{ total: number | string }>;
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await sql`
    SELECT s.id, s.session_id, s.user_id, s.username, s.role,
           s.ip_address, s.user_agent, s.created_at, s.last_active,
           TIMESTAMPDIFF(SECOND, s.last_active, NOW()) AS idle_seconds
    FROM user_sessions s
    WHERE s.invalidated_at IS NULL
    ORDER BY s.last_active DESC
    LIMIT ${sqlInt(limit)} OFFSET ${sqlInt(offset)}
  `;
  return NextResponse.json({
    ok: true,
    data: rows,
    pagination: { total, limit, offset, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 403 });
  }
  const { password } = await req.json() as { password?: string };
  if (!password) {
    return NextResponse.json({ ok: false, message: 'Password wajib diisi.' }, { status: 400 });
  }
  const users = await sql`SELECT password_hash FROM users WHERE id = ${session.userId} LIMIT 1`;
  if (!users.length) return NextResponse.json({ ok: false, message: 'User tidak ditemukan.' }, { status: 404 });
  const valid = await verifyPassword(password, (users[0] as Record<string,string>).password_hash);
  if (!valid) {
    await writeAuditLog({ req, eventType: 'LOGIN_FAILED', userId: session.userId, username: session.username, detail: 'Emergency logout password salah' });
    return NextResponse.json({ ok: false, message: 'Password salah.' }, { status: 403 });
  }
  const result = await sql`
    UPDATE user_sessions SET invalidated_at = NOW()
    WHERE invalidated_at IS NULL AND session_id != ${session.sessionId ?? ''}
  `;
  const deleted = (result[0] as { affectedRows: number })?.affectedRows ?? 0;
  await writeAuditLog({ req, eventType: 'LOGOUT', userId: session.userId, username: session.username, detail: `Emergency logout: ${deleted} sesi dihapus` });
  return NextResponse.json({ ok: true, deleted });
}
