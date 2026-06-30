let tokenGetter: (() => Promise<string>) | null = null;

export function setTokenGetter(fn: () => Promise<string>) {
  tokenGetter = fn;
}

async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenGetter ? await tokenGetter() : "";
  const headers: Record<string, string> = {
    ...Object.fromEntries(new Headers(options.headers).entries()),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

// Accounts
export const getAccounts = () => apiFetch<any[]>("/accounts");
export const getAccount = (id: string) => apiFetch<any>(`/accounts/${id}`);
export const createAccount = (data: Record<string, unknown>) =>
  apiFetch<any>("/accounts", { method: "POST", body: JSON.stringify(data) });
export const updateAccount = (id: string, patch: Record<string, unknown>) =>
  apiFetch<any>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

// Workshops
export const getWorkshops = (view?: string) =>
  apiFetch<any[]>(`/workshops${view ? `?view=${view}` : ""}`);
export const getWorkshop = (id: string) => apiFetch<any>(`/workshops/${id}`);
export const createWorkshop = (data: Record<string, unknown>) =>
  apiFetch<any>("/workshops", { method: "POST", body: JSON.stringify(data) });
export const updateWorkshop = (id: string, patch: Record<string, unknown>) =>
  apiFetch<any>(`/workshops/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const deleteWorkshop = (id: string) =>
  apiFetch<void>(`/workshops/${id}`, { method: "DELETE" });

// SOWs
export const getSow = (id: string) => apiFetch<any>(`/sows/${id}`);
export const createSow = (data: Record<string, unknown>) =>
  apiFetch<any>("/sows", { method: "POST", body: JSON.stringify(data) });
export const updateSow = (id: string, patch: Record<string, unknown>) =>
  apiFetch<any>(`/sows/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const deleteSow = (id: string) =>
  apiFetch<void>(`/sows/${id}`, { method: "DELETE" });

// Tasks
export const getTasks = (filters?: { role?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return apiFetch<any[]>(`/tasks${qs ? `?${qs}` : ""}`);
};
export const createTask = (data: Record<string, unknown>) =>
  apiFetch<any>("/tasks", { method: "POST", body: JSON.stringify(data) });
export const updateTask = (id: string, patch: Record<string, unknown>) =>
  apiFetch<any>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

// Profiles & Roles
export const getProfiles = () => apiFetch<any[]>("/profiles");
export const getMyProfile = () => apiFetch<any>("/profiles/me");
export const grantRole = (userId: string, role: string) =>
  apiFetch<void>("/user-roles", { method: "POST", body: JSON.stringify({ user_id: userId, role }) });
export const revokeRole = (userId: string, role: string) =>
  apiFetch<void>(`/user-roles/${userId}/${encodeURIComponent(role)}`, { method: "DELETE" });

// Reports
export const getReports = () => apiFetch<any[]>("/reports");
