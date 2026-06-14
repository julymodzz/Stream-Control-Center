export type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer';
export type UserStatus = 'active' | 'disabled' | 'locked';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roleId: string;
  roleSlug: UserRole;
  roleName: string;
  permissions: string[];
  totpEnabled?: boolean;
  mustChangePassword?: boolean;
}

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roleId: string;
  roleName?: string;
  roleSlug?: UserRole;
  status: UserStatus;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  profileImage?: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  device: string;
  browser: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent?: boolean;
}

export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  permissions: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface PasswordValidation {
  valid: boolean;
  score: number;
  errors: string[];
  suggestions: string[];
}

export interface SystemStatus {
  cpuPercent: number;
  ramPercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  uptimeSeconds: number;
  network: {
    uploadBytesPerSec: number;
    downloadBytesPerSec: number;
  };
  timestamp: string;
}

export interface ObsStatus {
  connected: boolean;
  currentScene: string | null;
  streamOnline: boolean;
  recordingActive: boolean;
  bitrateKbps: number | null;
  scenes: string[];
}

export interface NoalbsStatus {
  running: boolean;
  lastSceneSwitch?: string;
  sceneSwitchHistory: SceneSwitchEvent[];
  failoverHistory: FailoverEvent[];
  autoRecoveryEnabled: boolean;
  connectionDiagnostics: string[];
}

export interface SceneSwitchEvent {
  from: string | null;
  to: string;
  timestamp: string;
  reason: string;
}

export interface FailoverEvent {
  trigger: string;
  action: string;
  timestamp: string;
  success: boolean;
}

export interface StreamingStatus {
  obsRunning: boolean;
  noalbsRunning: boolean;
  currentScene: string | null;
  streamOnline: boolean;
  recordingActive: boolean;
  bitrateKbps: number | null;
  obs: ObsStatus;
  noalbs: NoalbsStatus;
  twitchConnected: boolean;
  dockerContainers: DockerContainerHealth[];
  timestamp: string;
}

export interface DockerContainerHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'starting' | 'unknown';
  running: boolean;
}

export interface PingResult {
  host: string;
  latencyMs: number | null;
  packetLossPercent: number;
  reachable: boolean;
  lastSuccess: string | null;
}

export interface NetworkStatus {
  pings: PingResult[];
  internetOnline: boolean;
  timestamp: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  | 'obs_crash'
  | 'obs_disconnected'
  | 'noalbs_crash'
  | 'noalbs_offline'
  | 'stream_offline'
  | 'internet_down'
  | 'high_latency'
  | 'high_packet_loss'
  | 'high_cpu'
  | 'high_ram'
  | 'disk_full';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface DashboardData {
  system: SystemStatus;
  streaming: StreamingStatus;
  network: NetworkStatus;
  alerts: Alert[];
}

export interface LogEntry {
  line: string;
  timestamp: string | null;
}

export interface LogsResponse {
  source: 'obs' | 'noalbs' | 'app';
  lines: LogEntry[];
  totalLines: number;
}

export type ControlAction =
  | 'obs-start'
  | 'obs-stop'
  | 'obs-restart'
  | 'noalbs-start'
  | 'noalbs-stop'
  | 'noalbs-restart'
  | 'server-reboot';

export interface ControlResult {
  success: boolean;
  action: string;
  message: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  details?: string;
  sourceIp: string;
  success: boolean;
  timestamp: string;
}

export interface DashboardWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  dashboardLayout: DashboardWidget[];
  notificationsEnabled: boolean;
}

export interface MetricsHistoryPoint {
  timestamp: string;
  cpuPercent: number;
  ramPercent: number;
  diskPercent: number;
  uploadBytesPerSec: number;
  downloadBytesPerSec: number;
}

// Twitch + Encoder (2026 Twitch-Streamer Features)
export interface TwitchStatus {
  isLive: boolean;
  title: string;
  categoryName: string;
  viewerCount: number;
  twitchConnected: boolean;
}

export interface EncoderProfile {
  id: string;
  label: string;
  encoder: string;
  preset: string;
  bitrate: number;
  resolution: string;
  fps: number;
  notes: string;
}

export interface ScenePreset {
  name: string;
  sceneName: string;
  description: string;
  recommendedFor?: string[];
}

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  type: 'manual' | 'scheduled';
}

export interface AlertConfig {
  enabled: boolean;
  discordWebhookUrl?: string;
  emailEnabled: boolean;
  emailRecipients: string[];
  browserNotifications: boolean;
  thresholds: {
    cpuPercent: number;
    ramPercent: number;
    diskPercent: number;
    packetLossPercent: number;
    latencyMs: number;
  };
}
