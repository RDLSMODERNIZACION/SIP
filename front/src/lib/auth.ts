import { apiFetch, clearToken, setToken } from "./api";
import type { LoginResponse, User } from "@/src/types";

export async function login(email: string, password: string) {
  const data = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data;
}

export async function getMe() {
  return apiFetch<User>("/auth/me");
}

export function logout() {
  clearToken();
}
