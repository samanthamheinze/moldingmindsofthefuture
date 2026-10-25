import { ADMIN_COOKIE_NAME, requireAdmin } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
  res.status(200).json({ ok: true });
}
