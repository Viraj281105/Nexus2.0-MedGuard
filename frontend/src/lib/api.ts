// lib/api.ts — API client helpers for the frontend

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("advocai_token");
}

export function getUser(): { id: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("advocai_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(token: string, user: { id: string; email: string }) {
  localStorage.setItem("advocai_token", token);
  localStorage.setItem("advocai_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("advocai_token");
  localStorage.removeItem("advocai_user");
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(apiUrl(path), { ...init, headers });
}
