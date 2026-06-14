export type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer';
export type UserStatus = 'active' | 'disabled' | 'locked';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  roleId: string;
  /** @deprecated Legacy – wird bei Migration zu roleId konvertiert */
  role?: UserRole;
  status: UserStatus;
  totpSecret?: string;
  totpEnabled: boolean;
  totpBackupCodes?: string[];
  profileImage?: string;
  mustChangePassword: boolean;
  passwordChangedAt: string;
  passwordHistory: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  failedLoginAttempts: number;
  lockedUntil?: string;
  createdBy?: string;
}

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roleId: string;
  roleName?: string;
  roleSlug?: string;
  status: UserStatus;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  profileImage?: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  username: string;
  roleId: string;
  roleSlug: string;
  permissions: string[];
  sessionId?: string;
  /** @deprecated Legacy */
  role?: UserRole;
  type: 'access';
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

export interface DashboardData {
  system: SystemStatus;
  streaming: StreamingStatus;
  network: NetworkStatus;
  alerts: Alert[];
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

export type ObsControlAction =
  | 'set-scene'
  | 'start-stream'
  | 'stop-stream'
  | 'start-recording'
  | 'stop-recording'
  | 'set-source-visibility'
  | 'set-source-mute';

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

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  dashboardLayout: DashboardWidget[];
  notificationsEnabled: boolean;
}

export interface DashboardWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  type: 'manual' | 'scheduled';
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface MetricsHistoryPoint {
  timestamp: string;
  cpuPercent: number;
  ramPercent: number;
  diskPercent: number;
  uploadBytesPerSec: number;
  downloadBytesPerSec: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestId?: string;
    }
  }
}
