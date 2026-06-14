import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/TokenService';
import { config } from '../config/env';
import { activeConnections } from '../observability/metrics';
import { logger } from '../observability/logger';
import { MonitorService } from '../services/MonitorService';

let io: Server | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export async function broadcastDashboard(monitor: MonitorService): Promise<void> {
  if (!io) return;
  try {
    const data = await monitor.collectDashboardData();
    io.emit('dashboard:update', data);
  } catch (error) {
    logger.error({ error }, 'Fehler beim Sammeln der Dashboard-Daten');
  }
}

export async function broadcastLogs(
  monitor: MonitorService,
  source: 'obs' | 'noalbs' | 'app'
): Promise<void> {
  if (!io) return;
  try {
    const logs = await monitor.getLogService().getLogs(source);
    io.emit(`logs:${source}`, logs);
  } catch (error) {
    logger.error({ error, source }, 'Fehler beim Lesen der Logs');
  }
}

export function setupSocketIO(
  httpServer: HttpServer,
  monitor: MonitorService,
  tokenService: TokenService
): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentifizierung erforderlich'));
      return;
    }
    const payload = tokenService.verifyAccessToken(token);
    if (!payload) {
      next(new Error('Ungültiger Token'));
      return;
    }
    socket.data.user = payload;
    next();
  });

  io.on('connection', (socket: Socket) => {
    activeConnections.inc();
    logger.info({ socketId: socket.id, user: socket.data.user?.username }, 'WebSocket verbunden');

    broadcastDashboard(monitor);
    broadcastLogs(monitor, 'obs');
    broadcastLogs(monitor, 'noalbs');

    socket.on('logs:subscribe', (source: string) => {
      if (source === 'obs' || source === 'noalbs' || source === 'app') {
        broadcastLogs(monitor, source);
      }
    });

    socket.on('disconnect', () => {
      activeConnections.dec();
      logger.info({ socketId: socket.id }, 'WebSocket getrennt');
    });
  });

  pollTimer = setInterval(async () => {
    await broadcastDashboard(monitor);
    await broadcastLogs(monitor, 'obs');
    await broadcastLogs(monitor, 'noalbs');
  }, config.pollIntervalMs);

  return io;
}

export function shutdownSocketIO(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (io) {
    io.close();
    io = null;
  }
}

export function getIO(): Server | null {
  return io;
}
