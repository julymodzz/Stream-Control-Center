import { useAuthStore } from '../store/useAuthStore';
import {
  Alert,
  AlertConfig,
  AuditLogEntry,
  ApiToken,
  AuthUser,
  BackupMetadata,
  ControlAction,
  ControlResult,
  DashboardData,
  LogsResponse,
  MetricsHistoryPoint,
  PasswordValidation,
  Role,
  UserPreferences,
  UserPublic,
  UserSession,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/csrf-token`, { credentials: 'include' });
  const json = await res.json();
  csrfToken = json.data?.csrfToken ?? null;
  return csrfToken ?? '';
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (csrfToken && options.method && options.method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry && path !== '/api/v1/auth/login') {
    const refreshed = await refreshToken();
    if (refreshed) return apiFetch<T>(path, options, false);
    useAuthStore.getState().clearAuth();
    throw new Error('Session abgelaufen');
  }

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Anfrage fehlgeschlagen');
  }
  return json.data ?? json;
}

export async function login(
  username: string,
  password: string,
  totpCode?: string
): Promise<{ tokens: { accessToken: string }; user: AuthUser }> {
  await fetchCsrfToken();
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password, totpCode }),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || 'Anmeldung fehlgeschlagen') as Error & { requiresTotp?: boolean };
    err.requiresTotp = json.requiresTotp;
    throw err;
  }
  return json.data;
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const json = await res.json();
    useAuthStore.getState().setAuth(json.data.tokens.accessToken, json.data.user);
    return true;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    useAuthStore.getState().clearAuth();
  }
}

export async function fetchDashboard(): Promise<DashboardData> {
  return apiFetch<DashboardData>('/api/v1/dashboard');
}

export async function fetchMetricsHistory(): Promise<MetricsHistoryPoint[]> {
  return apiFetch<MetricsHistoryPoint[]>('/api/v1/dashboard/metrics/history');
}

export async function executeControl(action: ControlAction): Promise<ControlResult> {
  await fetchCsrfToken();
  return apiFetch<ControlResult>(`/api/v1/control/${action}`, { method: 'POST' });
}

export async function executeObsControl(body: Record<string, unknown>): Promise<ControlResult> {
  await fetchCsrfToken();
  return apiFetch<ControlResult>('/api/v1/control/obs/action', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchLogs(source: 'obs' | 'noalbs' | 'app', search?: string): Promise<LogsResponse> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<LogsResponse>(`/api/v1/logs/${source}${params}`);
}

export async function fetchNotifications(): Promise<{
  active: Alert[];
  history: Alert[];
  config: AlertConfig;
}> {
  return apiFetch('/api/v1/notifications');
}

export async function updateAlertConfig(config: Partial<AlertConfig>): Promise<AlertConfig> {
  await fetchCsrfToken();
  return apiFetch<AlertConfig>('/api/v1/notifications/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function acknowledgeAlert(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/notifications/${id}/acknowledge`, { method: 'POST' });
}

export async function acknowledgeAllAlerts(): Promise<void> {
  await fetchCsrfToken();
  await apiFetch('/api/v1/notifications/acknowledge-all', { method: 'POST' });
}

export async function fetchAuditLogs(params: Record<string, string>): Promise<{
  entries: AuditLogEntry[];
  total: number;
}> {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/api/v1/audit?${query}`);
}

export async function fetchPreferences(): Promise<UserPreferences> {
  return apiFetch<UserPreferences>('/api/v1/preferences');
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  await fetchCsrfToken();
  return apiFetch<UserPreferences>('/api/v1/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
}

export async function fetchBackups(): Promise<BackupMetadata[]> {
  return apiFetch<BackupMetadata[]>('/api/v1/backup');
}

export async function createBackup(): Promise<BackupMetadata> {
  await fetchCsrfToken();
  return apiFetch<BackupMetadata>('/api/v1/backup', { method: 'POST' });
}

export function getLogDownloadUrl(source: 'obs' | 'noalbs' | 'app'): string {
  return `${API_BASE}/api/v1/logs/${source}/download`;
}

// IAM API
export async function fetchUsers(params?: Record<string, string>): Promise<UserPublic[]> {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  return apiFetch<UserPublic[]>(`/api/v1/users${query}`);
}

export async function createUser(data: Record<string, unknown>): Promise<UserPublic> {
  await fetchCsrfToken();
  return apiFetch<UserPublic>('/api/v1/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateUser(id: string, data: Record<string, unknown>): Promise<UserPublic> {
  await fetchCsrfToken();
  return apiFetch<UserPublic>(`/api/v1/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteUser(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/users/${id}`, { method: 'DELETE' });
}

export async function disableUser(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/users/${id}/disable`, { method: 'POST' });
}

export async function enableUser(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/users/${id}/enable`, { method: 'POST' });
}

export async function resetUserPassword(id: string, newPassword: string, mustChange = true): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword, mustChangePassword: mustChange }),
  });
}

export async function resetUser2fa(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/users/${id}/reset-2fa`, { method: 'POST' });
}

export async function fetchRoles(): Promise<Role[]> {
  return apiFetch<Role[]>('/api/v1/roles');
}

export async function fetchAllPermissions(): Promise<string[]> {
  return apiFetch<string[]>('/api/v1/roles/permissions');
}

export async function createRole(data: Record<string, unknown>): Promise<Role> {
  await fetchCsrfToken();
  return apiFetch<Role>('/api/v1/roles', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateRole(id: string, data: Record<string, unknown>): Promise<Role> {
  await fetchCsrfToken();
  return apiFetch<Role>(`/api/v1/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteRole(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/roles/${id}`, { method: 'DELETE' });
}

export async function fetchProfile(): Promise<{ user: UserPublic; permissions: string[] }> {
  return apiFetch('/api/v1/profile');
}

export async function updateProfile(data: Record<string, unknown>): Promise<UserPublic> {
  await fetchCsrfToken();
  return apiFetch<UserPublic>('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch('/api/v1/security/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function validatePassword(password: string): Promise<PasswordValidation> {
  await fetchCsrfToken();
  return apiFetch<PasswordValidation>('/api/v1/security/validate-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function fetchSessions(): Promise<UserSession[]> {
  return apiFetch<UserSession[]>('/api/v1/security/sessions');
}

export async function revokeSession(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/security/sessions/${id}`, { method: 'DELETE' });
}

export async function revokeOtherSessions(): Promise<void> {
  await fetchCsrfToken();
  await apiFetch('/api/v1/security/sessions/revoke-others', { method: 'POST' });
}

export async function setupTotp(): Promise<{ secret: string; qrCode: string }> {
  await fetchCsrfToken();
  return apiFetch('/api/v1/security/totp/setup', { method: 'POST' });
}

export async function enableTotp(code: string): Promise<{ backupCodes: string[] }> {
  await fetchCsrfToken();
  return apiFetch('/api/v1/security/totp/enable', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function disableTotp(code: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch('/api/v1/security/totp/disable', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function fetchApiTokens(): Promise<ApiToken[]> {
  return apiFetch<ApiToken[]>('/api/v1/security/api-tokens');
}

export async function createApiToken(name: string, expiresInDays?: number): Promise<{ token: ApiToken; rawToken: string }> {
  await fetchCsrfToken();
  return apiFetch('/api/v1/security/api-tokens', {
    method: 'POST',
    body: JSON.stringify({ name, expiresInDays }),
  });
}

export async function revokeApiToken(id: string): Promise<void> {
  await fetchCsrfToken();
  await apiFetch(`/api/v1/security/api-tokens/${id}`, { method: 'DELETE' });
}

// ==================== TWITCH + ENCODER ====================
export async function fetchTwitchStatus() {
  return apiFetch('/api/v1/twitch/status');
}

export async function updateTwitchStreamInfo(data: { title?: string; categoryIdOrName?: string }) {
  await fetchCsrfToken();
  return apiFetch('/api/v1/twitch/update-stream-info', { method: 'POST', body: JSON.stringify(data) });
}

export async function triggerManualRaid(raiderName: string, viewerCount?: number) {
  await fetchCsrfToken();
  return apiFetch('/api/v1/twitch/trigger-raid', {
    method: 'POST',
    body: JSON.stringify({ raiderName, viewerCount }),
  });
}

export async function fetchEncoderProfiles() {
  return apiFetch('/api/v1/twitch/encoder-profiles');
}

export async function fetchCurrentOutputSettings() {
  return apiFetch('/api/v1/twitch/current-output');
}

export async function fetchIntelDiagnostics() {
  return apiFetch('/api/v1/twitch/intel-diagnostics');
}

export async function applyTwitchEncoderProfile(profileId: string) {
  await fetchCsrfToken();
  return apiFetch('/api/v1/twitch/apply-twitch-profile', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

export async function applyProfileAndRestartStream(profileId: string) {
  await fetchCsrfToken();
  return apiFetch('/api/v1/twitch/apply-profile-and-restart', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

export async function fetchTwitchScenePresets() {
  return apiFetch('/api/v1/twitch/scene-presets');
}

export async function applyTwitchScenePreset(presetName: string) {
  await fetchCsrfToken();
  return apiFetch('/api/v1/twitch/apply-scene-preset', {
    method: 'POST',
    body: JSON.stringify({ presetName }),
  });
}

export async function setTwitchCredentials(creds: { accessToken: string; refreshToken?: string; broadcasterUserId?: string }) {
  await fetchCsrfToken();
  return apiFetch('/api/v1/twitch/set-credentials', {
    method: 'POST',
    body: JSON.stringify(creds),
  });
}

export async function getTwitchAuthUrl(redirectUri?: string) {
  const q = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  return apiFetch(`/api/v1/twitch/auth-url${q}`);
}

export async function twitchDisconnect() {
  await fetchCsrfToken();
  return apiFetch('/api/v1/twitch/disconnect', { method: 'POST' });
}
