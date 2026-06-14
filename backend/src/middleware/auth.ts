import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../auth/TokenService';
import { hasAnyPermission } from '../iam/permissions';

export function createAuthMiddleware(tokenService: TokenService) {
  return function authenticate(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentifizierung erforderlich', code: 'AUTH_REQUIRED' });
      return;
    }

    const token = header.slice(7);
    const payload = tokenService.verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Ungültiger oder abgelaufener Token', code: 'INVALID_TOKEN' });
      return;
    }

    req.user = payload;
    next();
  };
}

export function authorize(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentifizierung erforderlich', code: 'AUTH_REQUIRED' });
      return;
    }

    const userPerms = req.user.permissions ?? [];
    const allowed = hasAnyPermission(userPerms, permissions);
    if (!allowed) {
      res.status(403).json({ error: 'Unzureichende Berechtigungen', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

export function optionalAuth(tokenService: TokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const payload = tokenService.verifyAccessToken(header.slice(7));
      if (payload) req.user = payload;
    }
    next();
  };
}
