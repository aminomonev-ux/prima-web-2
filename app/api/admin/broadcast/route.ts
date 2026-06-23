
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/data/db';
import { getSession } from '@/lib/security/auth';
import { checkRateLimit } from '@/lib/security/ratelimit';
import { writeAuditLog } from '@/lib/security/auditlog';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 403 });
  }
  const rows = await sql`
    SELECT id, recipient, pesan, created_at
    FROM notifications
    WHERE type = 'BROADCAST'
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 403 });
  }
  const rl = await checkRateLimit(`broadcast:${session.userId}`, 5, 600);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: `Rate limit. Coba lagi dalam ${rl.resetIn} detik.` }, { status: 429 });
  }
  const { pesan, targetRole } = await req.json() as { pesan: string; targetRole?: string };
  if (!pesan?.trim()) return NextResponse.json({ ok: false, message: 'Pesan tidak boleh kosong.' }, { status: 400 });
  if (pesan.length > 500) return NextResponse.json({ ok: false, message: 'Pesan maksimal 500 karakter.' }, { status: 400 });

  const users = targetRole
    ? await sql`SELECT username, role FROM users WHERE status = 'AKTIF' AND role = ${targetRole}`
    : await sql`SELECT username, role FROM users WHERE status = 'AKTIF'`;

  const escapedPesan = pesan.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  for (const u of users as { username: string; role: string }[]) {
    await sql`
      INSERT INTO notifications (recipient, role, type, pesan)
      VALUES (${u.username}, ${u.role}, 'BROADCAST', ${escapedPesan})
    `;
  }
  await writeAuditLog({ req, eventType: 'BROADCAST', userId: session.userId, username: session.username, detail: `Broadcast: "${pesan.slice(0,80)}" ke ${users.length} user` });
  return NextResponse.json({ ok: true, sent: users.length });
}
