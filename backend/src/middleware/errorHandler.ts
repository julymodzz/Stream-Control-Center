import { Request, Response, NextFunction } from 'express';
import { logger } from '../observability/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err, requestId: req.requestId, path: req.path }, 'Unbehandelter Fehler');
  res.status(500).json({
    error: 'Interner Serverfehler',
    code: 'INTERNAL_ERROR',
    requestId: req.requestId,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'API-Endpunkt nicht gefunden',
    code: 'NOT_FOUND',
    path: req.path,
  });
}
