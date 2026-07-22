const SESSION_KEY = "sorry-site.public-session-id";

export function getAnonymousSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
}
