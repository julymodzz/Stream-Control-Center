import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { z } from 'zod';

const rootEnv = path.resolve(process.cwd(), '../.env');
const localEnv = path.resolve(process.cwd(), '.env');

dotenv.config({ path: rootEnv });
dotenv.config({ path: localEnv });
dotenv.config();

const isLinux = os.platform() === 'linux';
const mockModeEnv = process.env.MOCK_MODE === 'true';
const mockModeAuto = !isLinux && process.env.NODE_ENV !== 'production';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  POLL_INTERVAL_MS: z.coerce.number().default(5000),
  MOCK_MODE: z.string().optional(),
  NODE_ENV: z.string().default('development'),
  PROC_PATH: z.string().default('/proc'),
  DATA_DIR: z.string().default('./data'),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  CSRF_SECRET: z.string().min(32).optional(),
  TRUST_PROXY: z.coerce.number().default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  LOGIN_LOCKOUT_THRESHOLD: z.coerce.number().default(5),
  LOGIN_LOCKOUT_DURATION_MS: z.coerce.number().default(900000),
  SESSION_TIMEOUT_MS: z.coerce.number().default(3600000),
  PASSWORD_EXPIRES_DAYS: z.coerce.number().optional(),
  DEFAULT_ADMIN_USERNAME: z.string().default('admin'),
  DEFAULT_ADMIN_PASSWORD: z.string().optional(),
  OBS_SERVICE_NAME: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('obs'),
  OBS_LOG_PATH: z.string().default('/var/log/obs/obs.log'),
  OBS_WEBSOCKET_HOST: z.string().default('127.0.0.1'),
  OBS_WEBSOCKET_PORT: z.coerce.number().default(4455),
  OBS_WEBSOCKET_PASSWORD: z.string().default(''),
  NOALBS_SERVICE_NAME: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('noalbs'),
  NOALBS_LOG_PATH: z.string().default('/var/log/noalbs/noalbs.log'),
  PING_TARGETS: z.string().default('8.8.8.8,twitch.tv,google.com'),
  PING_TIMEOUT_MS: z.coerce.number().default(3000),
  HIGH_LATENCY_THRESHOLD_MS: z.coerce.number().default(200),
  HIGH_PACKET_LOSS_THRESHOLD: z.coerce.number().default(10),
  HIGH_CPU_THRESHOLD: z.coerce.number().default(90),
  HIGH_RAM_THRESHOLD: z.coerce.number().default(90),
  DISK_FULL_THRESHOLD: z.coerce.number().default(90),
  NOTIFICATION_MAX_HISTORY: z.coerce.number().default(100),
  METRICS_HISTORY_SIZE: z.coerce.number().default(120),
  BACKUP_RETENTION_COUNT: z.coerce.number().default(10),
  BACKUP_SCHEDULE_CRON: z.string().default('0 3 * * *'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Twitch Integration (primär für Twitch-Streamer)
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  TWITCH_ACCESS_TOKEN: z.string().optional(),
  TWITCH_REFRESH_TOKEN: z.string().optional(),
  TWITCH_BROADCASTER_USER_ID: z.string().optional(),
  TWITCH_EVENTSUB_ENABLED: z.coerce.boolean().default(true),

  // Encoder / Hardware Präferenzen (Auto-Detect + manuelle Auswahl)
  ENCODER_PREFERRED: z.enum(['auto', 'x264', 'qsv', 'nvenc', 'amf']).default('auto'),
  ENCODER_PRESET: z.string().optional(), // z.B. veryfast, faster, quality, high_quality
  TARGET_BITRATE_KBPS: z.coerce.number().default(6500),
  STREAM_RESOLUTION: z.string().default('1920x1080'),
  STREAM_FPS: z.coerce.number().default(60),
  KEYFRAME_INTERVAL_SEC: z.coerce.number().default(2),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[Config] Ungültige Umgebungsvariablen:', parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const env = parsed.success
  ? parsed.data
  : envSchema.parse({
      JWT_SECRET: process.env.JWT_SECRET || 'dev-only-jwt-secret-min-32-chars-long!!',
      CSRF_SECRET: process.env.CSRF_SECRET || 'dev-only-csrf-secret-min-32-chars-long!',
    });

function requireSecret(value: string | undefined, fallback: string): string {
  if (env.NODE_ENV === 'production' && !value) {
    throw new Error(`[Config] ${fallback} muss in Produktion gesetzt sein`);
  }
  return value || `dev-only-${fallback}-${'x'.repeat(32)}`;
}

export const config = {
  port: env.PORT,
  host: env.HOST,
  corsOrigin: env.CORS_ORIGIN,
  pollIntervalMs: env.POLL_INTERVAL_MS,
  mockMode: mockModeEnv || mockModeAuto || env.MOCK_MODE === 'true',
  procPath: env.PROC_PATH,
  isLinux,
  nodeEnv: env.NODE_ENV,
  dataDir: path.resolve(env.DATA_DIR),
  trustProxy: env.TRUST_PROXY,

  auth: {
    jwtSecret: requireSecret(process.env.JWT_SECRET, 'JWT_SECRET'),
    jwtAccessExpires: env.JWT_ACCESS_EXPIRES,
    jwtRefreshExpires: env.JWT_REFRESH_EXPIRES,
    csrfSecret: requireSecret(process.env.CSRF_SECRET, 'CSRF_SECRET'),
    loginLockoutThreshold: env.LOGIN_LOCKOUT_THRESHOLD,
    loginLockoutDurationMs: env.LOGIN_LOCKOUT_DURATION_MS,
    sessionTimeoutMs: env.SESSION_TIMEOUT_MS,
    passwordExpiresDays: env.PASSWORD_EXPIRES_DAYS,
    defaultAdminUsername: env.DEFAULT_ADMIN_USERNAME,
    defaultAdminPassword: env.DEFAULT_ADMIN_PASSWORD || 'changeme-on-first-login',
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    authMax: env.AUTH_RATE_LIMIT_MAX,
  },

  obs: {
    serviceName: env.OBS_SERVICE_NAME,
    logPath: env.OBS_LOG_PATH,
    websocketHost: env.OBS_WEBSOCKET_HOST,
    websocketPort: env.OBS_WEBSOCKET_PORT,
    websocketPassword: env.OBS_WEBSOCKET_PASSWORD,
  },

  noalbs: {
    serviceName: env.NOALBS_SERVICE_NAME,
    logPath: env.NOALBS_LOG_PATH,
  },

  network: {
    pingTargets: env.PING_TARGETS.split(',').map((t) => t.trim()).filter(Boolean),
    pingTimeoutMs: env.PING_TIMEOUT_MS,
    highLatencyThresholdMs: env.HIGH_LATENCY_THRESHOLD_MS,
    highPacketLossThreshold: env.HIGH_PACKET_LOSS_THRESHOLD,
  },

  thresholds: {
    cpuPercent: env.HIGH_CPU_THRESHOLD,
    ramPercent: env.HIGH_RAM_THRESHOLD,
    diskPercent: env.DISK_FULL_THRESHOLD,
  },

  notifications: {
    maxHistory: env.NOTIFICATION_MAX_HISTORY,
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL || undefined,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM,
    },
  },

  metrics: {
    historySize: env.METRICS_HISTORY_SIZE,
  },

  backup: {
    retentionCount: env.BACKUP_RETENTION_COUNT,
    scheduleCron: env.BACKUP_SCHEDULE_CRON,
  },

  logLevel: env.LOG_LEVEL,

  twitch: {
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
    accessToken: env.TWITCH_ACCESS_TOKEN,
    refreshToken: env.TWITCH_REFRESH_TOKEN,
    broadcasterUserId: env.TWITCH_BROADCASTER_USER_ID,
    eventSubEnabled: env.TWITCH_EVENTSUB_ENABLED,
  },

  encoder: {
    preferred: env.ENCODER_PREFERRED,
    preset: env.ENCODER_PRESET,
    targetBitrateKbps: env.TARGET_BITRATE_KBPS,
    resolution: env.STREAM_RESOLUTION,
    fps: env.STREAM_FPS,
    keyframeIntervalSec: env.KEYFRAME_INTERVAL_SEC,
  },
} as const;

if (config.mockMode) {
  console.warn('[Config] Mock-Modus aktiv – simulierte Systemdaten werden verwendet');
}

if (config.nodeEnv === 'production' && config.auth.defaultAdminPassword === 'changeme-on-first-login') {
  console.warn('[Config] WARNUNG: Standard-Admin-Passwort wird verwendet – bitte sofort ändern');
}
