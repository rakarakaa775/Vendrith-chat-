/** Extract the most recent password-authentication timestamp from a Supabase access token.
 * Supabase access tokens expose authentication method timestamps in the AMR claim,
 * not in an `auth_time` claim (which is used by OIDC ID tokens).
 * @param {string} token
 * @returns {number | null}
 */
export function passwordAuthTimeFromJwt(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    );
    if (!Array.isArray(decoded?.amr) || decoded.amr.length === 0) return null;
    const latest = decoded.amr[0];
    if (
      !latest ||
      typeof latest !== "object" ||
      latest.method !== "password" ||
      typeof latest.timestamp !== "number" ||
      !Number.isFinite(latest.timestamp)
    ) return null;
    return latest.timestamp;
  } catch {
    return null;
  }
}

/** @param {number | null} authTime @param {number} now @param {number} maxAgeSeconds */
export function hasRecentAuthentication(authTime, now, maxAgeSeconds) {
  return authTime !== null &&
    Number.isFinite(authTime) &&
    authTime > 0 &&
    authTime <= now + 60 &&
    now - authTime <= maxAgeSeconds;
}
