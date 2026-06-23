// SEC (mirror SEC-C1 JWT guard): di production tolak boot kalau Turnstile pakai
// test-key Cloudflare (site/secret diawali 1x/2x/3x → CAPTCHA bypass/rusak) atau
// secret kosong (verifyTurnstile fail-open). Real key diawali 0x. Cegah skenario
// "lupa ganti nilai .env.example saat migrasi ke server".
if (process.env.NODE_ENV === 'production') {
  const _tsSecret = process.env.TURNSTILE_SECRET_KEY ?? '';
  const _tsSite   = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  if (!_tsSecret || /^[123]x/.test(_tsSecret) || /^[123]x/.test(_tsSite)) {
    throw new Error(
      '[FATAL] Turnstile production invalid: secret kosong atau site/secret memakai ' +
      'test-key Cloudflare (1x/2x/3x…). Set key ASLI (diawali 0x...) di env server — ' +
      'jangan biarkan nilai dari .env.example.'
    );
  }
}

export async function verifyTurnstile(token: string): Promise<{ ok: boolean; score: number }> {
  if (!token) return { ok: false, score: 0 };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, score: 1 };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ secret, response: token }),
    });
    const data = await res.json() as { success: boolean };
    return { ok: data.success, score: data.success ? 1 : 0 };
  } catch {
    // V5-AUTH-03: fail-CLOSED saat verifikasi tak bisa dipastikan (Cloudflare
    // unreachable/timeout). Sebelumnya fail-open (ok:true) → bypass CAPTCHA di
    // produksi saat outage. Toggle darurat ops: TURNSTILE_FAILOPEN=1.
    if (process.env.TURNSTILE_FAILOPEN === '1') return { ok: true, score: 1 };
    return { ok: false, score: 0 };
  }
}
