import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../../auth/AuthService';
import { TokenService } from '../../auth/TokenService';
import { UserStore } from '../../auth/UserStore';
import { IamService } from '../../iam/IamService';
import { AuditService } from '../../audit/AuditService';
import { authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

const profileSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  profileImage: z.string().max(500000).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
});

const totpSchema = z.object({ code: z.string().min(6).max(10) });

const apiTokenSchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(z.string()).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export function createProfileRouter(userStore: UserStore, iam: IamService, audit: AuditService): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const result = await iam.getUserWithPermissions(req.user!.sub);
    if (!result) {
      res.status(404).json({ error: 'Profil nicht gefunden', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: result });
  });

  router.patch('/', authorize('profile.edit'), validate(profileSchema), async (req: Request, res: Response) => {
    const user = await userStore.updateUser(req.user!.sub, req.body);
    if (!user) {
      res.status(404).json({ error: 'Profil nicht gefunden', code: 'NOT_FOUND' });
      return;
    }
    await audit.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: getClientIp(req) },
      'profile.update',
      'profile',
      true
    );
    res.json({ success: true, data: userStore.toPublic(user) });
  });

  return router;
}

export function createSecurityRouter(
  authService: AuthService,
  userStore: UserStore,
  iam: IamService,
  tokenService: TokenService,
  audit: AuditService
): Router {
  const router = Router();

  router.post('/change-password', validate(changePasswordSchema), async (req: Request, res: Response) => {
    const user = await userStore.findById(req.user!.sub);
    if (!user) {
      res.status(404).json({ error: 'Benutzer nicht gefunden', code: 'NOT_FOUND' });
      return;
    }
    const valid = await userStore.verifyPassword(user, req.body.currentPassword);
    if (!valid) {
      res.status(400).json({ error: 'Aktuelles Passwort falsch', code: 'PASSWORD_INVALID' });
      return;
    }
    try {
      await userStore.changePassword(req.user!.sub, req.body.newPassword);
      await audit.log(
        { userId: req.user!.sub, username: req.user!.username, sourceIp: getClientIp(req) },
        'auth.password_change',
        'security',
        true
      );
      res.json({ success: true, data: { message: 'Passwort geändert' } });
    } catch (error) {
      res.status(400).json({ error: String(error), code: 'PASSWORD_CHANGE_FAILED' });
    }
  });

  router.post('/validate-password', (req: Request, res: Response) => {
    const result = iam.getPasswordService().validate(req.body.password ?? '');
    res.json({ success: true, data: result });
  });

  router.get('/sessions', authorize('sessions.manage'), async (req: Request, res: Response) => {
    const sessions = await iam.listSessions(req.user!.sub, req.user!.sessionId);
    res.json({ success: true, data: sessions });
  });

  router.delete('/sessions/:id', authorize('sessions.manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await iam.revokeSession(req.user!.sub, id, tokenService);
    res.status(ok ? 200 : 404).json({ success: ok });
  });

  router.post('/sessions/revoke-others', authorize('sessions.manage'), async (req: Request, res: Response) => {
    const count = await iam.getSessionStore().revokeAllForUser(req.user!.sub, req.user!.sessionId);
    tokenService.revokeAllForUser(req.user!.sub);
    res.json({ success: true, data: { revoked: count } });
  });

  router.post('/totp/setup', async (req: Request, res: Response) => {
    const setup = await authService.setupTotp(req.user!.sub);
    if (!setup) {
      res.status(500).json({ error: '2FA-Setup fehlgeschlagen', code: 'TOTP_SETUP_FAILED' });
      return;
    }
    res.json({ success: true, data: setup });
  });

  router.post('/totp/enable', validate(totpSchema), async (req: Request, res: Response) => {
    const result = await authService.enableTotp(req.user!.sub, req.body.code);
    if (!result) {
      res.status(400).json({ error: 'Ungültiger Code', code: 'TOTP_INVALID' });
      return;
    }
    res.json({ success: true, data: { backupCodes: result.backupCodes } });
  });

  router.post('/totp/disable', validate(totpSchema), async (req: Request, res: Response) => {
    const ok = await authService.disableTotp(req.user!.sub, req.body.code);
    res.status(ok ? 200 : 400).json({ success: ok, error: ok ? undefined : 'Ungültiger Code' });
  });

  router.post('/totp/regenerate-backup', validate(totpSchema), async (req: Request, res: Response) => {
    const codes = await authService.regenerateBackupCodes(req.user!.sub, req.body.code);
    if (!codes) {
      res.status(400).json({ error: 'Ungültiger Code', code: 'TOTP_INVALID' });
      return;
    }
    res.json({ success: true, data: { backupCodes: codes } });
  });

  router.get('/api-tokens', authorize('api_tokens.manage'), async (req: Request, res: Response) => {
    const tokens = await iam.listApiTokens(req.user!.sub);
    res.json({ success: true, data: tokens });
  });

  router.post('/api-tokens', authorize('api_tokens.manage'), validate(apiTokenSchema), async (req: Request, res: Response) => {
    const perms = req.body.permissions ?? req.user!.permissions;
    const result = await iam.createApiToken(req.user!.sub, req.body.name, perms, req.body.expiresInDays);
    res.status(201).json({
      success: true,
      data: { token: result.token, rawToken: result.rawToken },
    });
  });

  router.delete('/api-tokens/:id', authorize('api_tokens.manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await iam.revokeApiToken(req.user!.sub, id);
    res.status(ok ? 200 : 404).json({ success: ok });
  });

  return router;
}
