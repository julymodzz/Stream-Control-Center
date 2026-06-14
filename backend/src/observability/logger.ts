import pino from 'pino';
import { config } from '../config/env';

export const logger = pino({
  level: config.logLevel,
  base: { service: 'stream-control-center' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
