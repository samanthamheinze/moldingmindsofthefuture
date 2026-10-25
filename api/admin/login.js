import crypto from 'crypto';
import { signSession, ADMIN_COOKIE_NAME } from '../_lib/auth.js';

function safeEquals(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== 'object') body = {};

  const { password } = body;
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminPassword || typeof password !== 'string' || !safeEquals(password, adminPassword)) {
    res.status(401).json({ ok: false, error: 'invalid_password' });
    return;
  }

  const cookieValue = signSession();
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`
  );
  res.status(200).json({ ok: true });
}
