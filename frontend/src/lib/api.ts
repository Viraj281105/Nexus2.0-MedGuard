// ---------------------------------------------------------------------------
// lib/api.ts — API client helpers for the frontend
// ---------------------------------------------------------------------------
//
// Centralised module for:
// - Building absolute API URLs from relative paths
// - Managing the JWT access token and user profile in localStorage
// - Making authenticated fetch requests with automatic Bearer token injection
//
// All localStorage access is guarded with a `typeof window` check so this
// module is safe to import in Next.js server-side rendering contexts.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Base URL for all API requests.
 * Reads from the `NEXT_PUBLIC_API_URL` environment variable at build time.
 * Falls back to an empty string (relative URLs) when not configured, which
 * works when the frontend and backend are served from the same origin.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** localStorage key used for the JWT access token. */
const TOKEN_KEY = "advocai_token";

/** localStorage key used for the serialised user profile object. */
const USER_KEY = "advocai_user";

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Build an absolute API URL by concatenating the configured base URL with
 * the given path.
 *
 * @example
 * ```ts
 * apiUrl("/api/auth/login")  // → "http://localhost:8000/api/auth/login"
 * apiUrl("/health")           // → "http://localhost:8000/health"
 * ```
 */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the stored JWT access token.
 *
 * Returns `null` when:
 * - Called on the server (no `window` object)
 * - No token has been persisted yet (user not logged in)
 *
 * @returns The raw JWT string, or `null`.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// User profile helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the stored user profile object.
 *
 * The profile is serialised as JSON and only contains non-sensitive
 * information (currently `id` and `email`).
 *
 * @returns The parsed user object, or `null` if not available or corrupted.
 */
export function getUser(): { id: string; email: string } | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // If the stored JSON is corrupted, treat it as missing and return null.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Authentication persistence
// ---------------------------------------------------------------------------

/**
 * Persist the JWT token and user profile to localStorage.
 *
 * Called after a successful login or registration so subsequent requests
 * (via `authFetch`) and UI components (via `getUser`) can access the
 * authenticated session.
 *
 * @param token - The JWT access token string.
 * @param user  - The user profile object (must contain at least `id` and `email`).
 */
export function setAuth(
  token: string,
  user: { id: string; email: string }
): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Remove the stored token and user profile from localStorage.
 *
 * Called on logout to clear the client-side session. After calling this,
 * `getToken()` and `getUser()` will both return `null`.
 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ---------------------------------------------------------------------------
// Authenticated fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Make an HTTP request to the API with automatic Bearer token injection.
 *
 * If a token is present in localStorage it is added as an `Authorization`
 * header. Any headers passed via `init` are merged in, with the token
 * taking precedence when a conflict exists (the token header is set last).
 *
 * @param path - Relative API path (e.g. `"/api/cases"`)
 * @param init - Optional `RequestInit` object forwarded to `fetch`
 * @returns The raw `Response` from the API
 *
 * @example
 * ```ts
 * const res = await authFetch("/api/cases");
 * if (res.ok) {
 *   const cases = await res.json();
 * }
 * ```
 */
export async function authFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = getToken();

  // Start with any headers the caller provided (or an empty object).
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
  };

  // If a token exists, attach it as a Bearer token. Setting it after the
  // spread ensures it cannot be accidentally overridden by the caller.
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(apiUrl(path), { ...init, headers });
}