// V5-INJ-01: guard skema URL user. React tidak memblok `javascript:`/`data:` di
// href → URL user (url_merk*/file_url usulan) bisa jadi stored-XSS saat reviewer
// klik. Hanya izinkan http/https. Dipakai di Zod input (defense-in-depth) + render.

export function isSafeHttpUrl(input: string | null | undefined): boolean {
  if (!input) return false;
  try {
    const u = new URL(input.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Return URL hanya jika aman, selain itu undefined → `<a href={undefined}>` inert
// (tidak navigasi, tidak eksekusi skema berbahaya).
export function safeHref(input: string | null | undefined): string | undefined {
  return isSafeHttpUrl(input) ? input!.trim() : undefined;
}
