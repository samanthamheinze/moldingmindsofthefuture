import crypto from 'crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const COOKIE_NAME = 'mm_admin';

function sign(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Returns a cookie VALUE (not the full Set-Cookie header) of the form
// "<base64 payload>.<hex hmac>".
export function signSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64');
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySession(cookieValue) {
  if (typeof cookieValue !== 'string' || !cookieValue) return false;

  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot === -1) return false;

  const payload = cookieValue.slice(0, lastDot);
  const signature = cookieValue.slice(lastDot + 1);
  if (!payload || !signature) return false;

  const expectedSignature = sign(payload);

  // Buffer.from(str, 'hex') silently truncates at the first invalid/odd hex
  // character rather than throwing, so a malformed or appended-to signature
  // can decode to a buffer of the same byte length as a valid one (e.g.
  // "<64 valid hex chars>x" truncates its trailing "x" and still decodes to
  // 32 bytes). Guard against that by requiring the signature to be a
  // well-formed hex string of exactly the expected length *before* decoding,
  // so tampering can't slip past the byte-length check below.
  if (signature.length !== expectedSignature.length) return false;
  if (!/^[0-9a-f]+$/i.test(signature)) return false;

  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return false;
  }

  return typeof parsed?.exp === 'number' && parsed.exp > Date.now();
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function requireAdmin(req, res) {
  const cookies = parseCookies(req.headers?.cookie);
  const session = cookies[COOKIE_NAME];

  if (!verifySession(session)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
