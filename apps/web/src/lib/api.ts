const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("stadia_token");
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data.data as T;
}

export const api = {
  get: <T = any>(path: string): Promise<T> => apiFetch<T>(path),
  post: <T = any>(path: string, body: unknown): Promise<T> =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T = any>(path: string, body: unknown): Promise<T> =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T = any>(path: string, body: unknown): Promise<T> =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = any>(path: string): Promise<T> => apiFetch<T>(path, { method: "DELETE" }),
};
