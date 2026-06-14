import { Router, Request, Response } from 'express';
import { AuthService } from '../../auth/AuthService';
import { AuditService } from '../../audit/AuditService';
import { authRateLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { loginSchema } from '../../schemas';
import { createAuthMiddleware } from '../../middleware/auth';
import { TokenService } from '../../auth/TokenService';
import { IamService } from '../../iam/IamService';

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

export function createAuthRouter(
  authService: AuthService,
  tokenService: TokenService,
  iamService: IamService,
  auditService: AuditService
): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(tokenService);

  router.post('/login', authRateLimiter, validate(loginSchema), async (req: Request, res: Response) => {
    const { username, password, totpCode } = req.body;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] ?? '';
    const result = await authService.login(username, password, totpCode, ip, userAgent);

    if (!result.success) {
      await auditService.log(
        { userId: 'anonymous', username, sourceIp: ip },
        'auth.login',
        'session',
        false,
        result.message
      );
      res.status(401).json({
        error: result.message,
        code: result.requiresTotp ? 'TOTP_REQUIRED' : 'LOGIN_FAILED',
        requiresTotp: result.requiresTotp,
      });
      return;
    }

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        tokens: result.tokens,
        user: result.user,
        mustChangePassword: result.mustChangePassword,
      },
    });
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh-Token fehlt', code: 'REFRESH_MISSING' });
      return;
    }

    const result = await authService.refresh(refreshToken, getClientIp(req));
    if (!result.success) {
      res.status(401).json({ error: result.message, code: 'REFRESH_FAILED' });
      return;
    }

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, data: { tokens: result.tokens, user: result.user } });
  });

  router.post('/logout', authenticate, async (req: Request, res: Response) => {
    await authService.logout(req.cookies?.refreshToken, req.user!.sub, getClientIp(req));
    res.clearCookie('refreshToken');
    res.json({ success: true, data: { message: 'Abgemeldet' } });
  });

  router.get('/me', authenticate, async (req: Request, res: Response) => {
    const result = await iamService.getUserWithPermissions(req.user!.sub);
    if (!result) {
      res.status(404).json({ error: 'Benutzer nicht gefunden', code: 'USER_NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: result });
  });

  return router;
}
