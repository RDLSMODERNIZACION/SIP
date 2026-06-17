import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  status: number;
  details: string;

  constructor(status: number, details: string) {
    super(details || `Error ${status}`);
    this.status = status;
    this.details = details;
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sip_token");
}

export function setToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem("sip_token", token);
}

export function clearToken() {
  if (typeof window !== "undefined") localStorage.removeItem("sip_token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    clearToken();
    window.location.href = "/login";
  }

  if (!response.ok) {
    let details = "";
    try {
      const json = await response.json();
      details = typeof json.detail === "string" ? json.detail : JSON.stringify(json);
    } catch {
      details = await response.text();
    }
    throw new ApiError(response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function publicFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    let details = "";
    try {
      const json = await response.json();
      details = typeof json.detail === "string" ? json.detail : JSON.stringify(json);
    } catch {
      details = await response.text();
    }
    throw new ApiError(response.status, details);
  }
  return response.json() as Promise<T>;
}
