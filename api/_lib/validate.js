// Simple, intentionally non-RFC5322 email validation — good enough to catch
// obvious junk/typos without rejecting real-world addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export function isValidAudience(a) {
  return a === 'parent' || a === 'educator' || a === 'both';
}

export function normalizeName(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 200) return null;
  return trimmed;
}

export function isBotSuspected({ hp, hp_time_ms } = {}) {
  if (typeof hp === 'string' && hp.trim().length > 0) return true;
  if (hp_time_ms !== undefined && hp_time_ms !== null) {
    const ms = Number(hp_time_ms);
    if (!Number.isNaN(ms) && ms < 1500) return true;
  }
  return false;
}
