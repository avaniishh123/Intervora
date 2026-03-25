/**
 * getAppBaseUrl — returns the base URL for generating shareable links.
 *
 * Priority:
 *  1. VITE_APP_URL env var (set this in .env for ngrok / production deployments)
 *  2. window.location.origin (automatic — works for localhost, ngrok, and any deployed domain)
 */
export function getAppBaseUrl(): string {
  return import.meta.env.VITE_APP_URL?.replace(/\/$/, '') || window.location.origin;
}

/**
 * getJoinUrl — builds a shareable join link for a session.
 * Format: <base_url>/join/<sessionId>
 */
export function getJoinUrl(sessionId: string): string {
  return `${getAppBaseUrl()}/join/${sessionId}`;
}

/**
 * isLocalhostUrl — returns true when the generated base URL is still localhost.
 * Used to warn the host that external participants won't be able to reach the link.
 */
export function isLocalhostUrl(): boolean {
  const base = getAppBaseUrl();
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
}
