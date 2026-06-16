import cookieParser from 'cookie-parser';
import cors from 'cors';
import { doubleCsrf } from 'csrf-csrf';
import express, { Request, Response } from 'express';
import fs from 'fs';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { PasswordService, RoleStore, SessionStore, ApiTokenStore, IamService } from './iam';
import { AuthService } from './auth/AuthService';
import { TokenService } from './auth/TokenService';
import { TotpService } from './auth/TotpService';
import { UserStore } from './auth/UserStore';
import { AuditService } from './audit/AuditService';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimit';
import { requestIdMiddleware } from './middleware/requestId';
import { logger } from './observability/logger';
import { register } from './observability/metrics';
import { swaggerSpec } from './openapi';
import { createV1Router } from './routes/v1';
import {
  AlertDeliveryService,
  BackupService,
  DesignerService,
  LogService,
  MonitorService,
  NetworkService,
  NoalbsService,
  NotificationService,
  ObsControlService,
  ObsSettingsService,
  ProcessControlService,
  StreamingService,
  SystemService,
  TwitchConfigStore,
  TwitchService,
} from './services';
import { setupSocketIO, shutdownSocketIO } from './socket';

const app = express();
const httpServer = http.createServer(app);

if (config.trustProxy > 0) {
  app.set('trust proxy', config.trustProxy);
}

app.use(requestIdMiddleware);
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);

const { generateToken } = doubleCsrf({
  getSecret: () => config.auth.csrfSecret,
  cookieName: '__Host-scc.csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: '/',
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

app.get('/api/v1/csrf-token', (req: Request, res: Response) => {
  res.json({ success: true, data: { csrfToken: generateToken(req, res) } });
});

// Services
const passwordService = new PasswordService();
const roleStore = new RoleStore();
const sessionStore = new SessionStore();
const apiTokenStore = new ApiTokenStore();
const userStore = new UserStore(roleStore, passwordService);
const tokenService = new TokenService();
const totpService = new TotpService();
const auditService = new AuditService();
const iamService = new IamService(userStore, roleStore, sessionStore, apiTokenStore, passwordService, totpService, auditService);
const authService = new AuthService(userStore, tokenService, totpService, iamService, sessionStore, auditService);
const alertDeliveryService = new AlertDeliveryService();
const backupService = new BackupService();
const systemService = new SystemService();
const obsControlService = new ObsControlService();
const noalbsService = new NoalbsService();
const streamingService = new StreamingService(obsControlService, noalbsService);
const networkService = new NetworkService();
const notificationService = new NotificationService(networkService, alertDeliveryService);
const logService = new LogService();
const monitorService = new MonitorService(
  systemService,
  streamingService,
  networkService,
  notificationService,
  logService
);
const processControlService = new ProcessControlService();
const obsSettingsService = new ObsSettingsService();
const twitchConfigStore = new TwitchConfigStore();
const twitchService = new TwitchService(obsControlService, twitchConfigStore);
const designerService = new DesignerService(obsControlService, twitchConfigStore);

// Wire configurable store into ObsSettingsService for runtime name resolution (functional config)
obsSettingsService.setTwitchConfigStore(twitchConfigStore);

// Wire notification for rich Twitch event alerts (point 5 integration)
(twitchService as any).setNotificationService?.(notificationService);

// Brücke: ObsSettingsService bekommt die aktive OBS-WS, sobald verfügbar
// (wird bei jedem ensureConnected intern aktualisiert)
setInterval(() => {
  const ws = (obsControlService as any).getWebSocket?.();
  if (ws) {
    obsSettingsService.setObsWebSocket(ws);
  }
}, 8000);

async function bootstrap(): Promise<void> {
  await iamService.initialize();
  await auditService.initialize();
  await backupService.initialize();
  await twitchConfigStore.load();

  // Twitch + Encoder Services initialisieren (nach OBS-Connection möglich)
  await twitchService.initialize();

  // ObsSettingsService bekommt später die aktive WebSocket von ObsControlService (wird bei Bedarf über Setter verknüpft)
  // Für volle Funktionalität kann ObsControlService später einen Callback oder direkten Zugriff bereitstellen.
  // Hier nur zur Verfügung stellen.

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        version: '2.0.0',
        mockMode: config.mockMode,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/api/v1/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(swaggerSpec);
  });

  app.use('/api/v1', createV1Router({
    authService,
    tokenService,
    userStore,
    iamService,
    auditService,
    monitorService,
    processControlService,
    obsControlService,
    designerService,
    obsSettingsService,
    twitchService,
    twitchConfigStore,
    alertDeliveryService,
    backupService,
  }));

  app.use('/api', notFoundHandler);

  const frontendDist = path.join(__dirname, '../../frontend/dist');
  const frontendExists = fs.existsSync(path.join(frontendDist, 'index.html'));

  if (frontendExists) {
    app.use(express.static(frontendDist));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        notFoundHandler(req, res);
        return;
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  setupSocketIO(httpServer, monitorService, tokenService);

  httpServer.listen(config.port, config.host, () => {
    logger.info({ port: config.port, host: config.host, mockMode: config.mockMode }, 'Stream Control Center gestartet');
  });
}

function gracefulShutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown-Signal empfangen');
  shutdownSocketIO();
  httpServer.close(() => {
    logger.info('Server beendet');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Bootstrap fehlgeschlagen');
  process.exit(1);
});

export { app, httpServer };
