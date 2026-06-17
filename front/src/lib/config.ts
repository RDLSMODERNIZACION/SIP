export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://sip-fhu8.onrender.com";

export function resolveApiUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
