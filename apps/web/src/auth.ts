/**
 * Client side of the Basic Auth gate. Credentials are held in sessionStorage (cleared on
 * tab close) and sent as an Authorization header on every API call. There is no per-user
 * identity — it's the shared gate matching the API's BASIC_AUTH_USER/PASS.
 */

const KEY = 'mn_auth';

/** Whether the build expects an auth gate (set VITE_REQUIRE_AUTH=true in prod). */
export const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === 'true';

export function hasCreds(): boolean {
  return !!sessionStorage.getItem(KEY);
}

export function setCreds(user: string, pass: string): void {
  sessionStorage.setItem(KEY, btoa(`${user}:${pass}`));
}

export function clearCreds(): void {
  sessionStorage.removeItem(KEY);
}

export function authHeader(): Record<string, string> {
  const v = sessionStorage.getItem(KEY);
  return v ? { authorization: `Basic ${v}` } : {};
}

/** Fired when the API rejects credentials so the UI can re-prompt. */
export const UNAUTHORIZED_EVENT = 'mn-unauthorized';
