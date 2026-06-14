import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  totpCode: z.string().max(10).optional(),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(12).max(128),
  role: z.enum(['admin', 'operator', 'viewer']),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
});

export const totpCodeSchema = z.object({
  code: z.string().min(6).max(10),
});

export const controlActionSchema = z.object({
  action: z.enum([
    'obs-start',
    'obs-stop',
    'obs-restart',
    'noalbs-start',
    'noalbs-stop',
    'noalbs-restart',
    'server-reboot',
  ]),
});

export const obsControlSchema = z.object({
  action: z.enum([
    'set-scene',
    'start-stream',
    'stop-stream',
    'start-recording',
    'stop-recording',
    'set-source-visibility',
    'set-source-mute',
    'set-input-volume',
    'set-input-mute',
    'toggle-input-filter',
    'refresh-browser-source',
    'set-current-transition',
    'trigger-hotkey',
    'set-input-settings',
    'get-stats',
    'get-output-settings',
  ]),
  sceneName: z.string().max(128).optional(),
  sourceName: z.string().max(128).optional(),
  visible: z.boolean().optional(),
  muted: z.boolean().optional(),
  // Additional params for expanded actions
  volume: z.number().min(0).max(1).optional(),
  filterName: z.string().optional(),
  filterEnabled: z.boolean().optional(),
  transitionName: z.string().optional(),
  hotkeyName: z.string().optional(),
  inputSettings: z.record(z.any()).optional(),
  inputName: z.string().optional(), // alias for sourceName in some cases
});

export const logsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
});

export const auditQuerySchema = z.object({
  query: z.string().max(200).optional(),
  userId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  success: z.enum(['true', 'false']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export const alertConfigSchema = z.object({
  enabled: z.boolean().optional(),
  discordWebhookUrl: z.string().url().optional().or(z.literal('')),
  emailEnabled: z.boolean().optional(),
  emailRecipients: z.array(z.string().email()).optional(),
  browserNotifications: z.boolean().optional(),
  thresholds: z
    .object({
      cpuPercent: z.number().min(1).max(100).optional(),
      ramPercent: z.number().min(1).max(100).optional(),
      diskPercent: z.number().min(1).max(100).optional(),
      packetLossPercent: z.number().min(0).max(100).optional(),
      latencyMs: z.number().min(1).max(10000).optional(),
    })
    .optional(),
});

export const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  dashboardLayout: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
      })
    )
    .optional(),
  notificationsEnabled: z.boolean().optional(),
});
