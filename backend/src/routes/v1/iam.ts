import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { IamService } from '../../iam/IamService';
import { AuditService } from '../../audit/AuditService';
import { TokenService } from '../../auth/TokenService';
import { authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ALL_PERMISSIONS } from '../../iam/permissions';

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  displayName: z.string().min(1).max(128),
  email: z.string().email().or(z.literal('')),
  password: z.string().min(12).max(128),
  roleId: z.string().min(1),
  mustChangePassword: z.boolean().optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  roleId: z.string().optional(),
  status: z.enum(['active', 'disabled', 'locked']).optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(12).max(128),
  mustChangePassword: z.boolean().optional(),
});

const userQuerySchema = z.object({
  query: z.string().max(200).optional(),
  roleId: z.string().optional(),
  roleSlug: z.enum(['super_admin', 'admin', 'operator', 'viewer']).optional(),
  status: z.enum(['active', 'disabled', 'locked']).optional(),
});

export function createUsersRouter(iam: IamService, audit: AuditService, tokenService: TokenService): Router {
  const router = Router();

  router.get('/', authorize('users.view', 'users:read'), validate(userQuerySchema, 'query'), async (req: Request, res: Response) => {
    const users = await iam.listUsers({
      query: req.query.query as string | undefined,
      roleId: req.query.roleId as string | undefined,
      roleSlug: req.query.roleSlug as string | undefined,
      status: req.query.status as 'active' | 'disabled' | 'locked' | undefined,
    });
    res.json({ success: true, data: users });
  });

  router.post('/', authorize('users.create', 'users:manage'), validate(createUserSchema), async (req: Request, res: Response) => {
    try {
      const user = await iam.createUser(
        req.user!.sub,
        req.user!.roleSlug,
        req.user!.permissions,
        req.body,
        getClientIp(req)
      );
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ error: String(error), code: 'USER_CREATE_FAILED' });
    }
  });

  router.get('/:id', authorize('users.view', 'users:read'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await iam.getUserWithPermissions(id);
    if (!result) {
      res.status(404).json({ error: 'Benutzer nicht gefunden', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: result });
  });

  router.patch('/:id', authorize('users.edit', 'users:manage'), validate(updateUserSchema), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const user = await iam.updateUser(req.user!.sub, req.user!.roleSlug, req.user!.permissions, id, req.body, getClientIp(req));
      if (!user) {
        res.status(404).json({ error: 'Benutzer nicht gefunden', code: 'NOT_FOUND' });
        return;
      }
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(403).json({ error: String(error), code: 'FORBIDDEN' });
    }
  });

  router.post('/:id/disable', authorize('users.disable', 'users:manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await iam.disableUser(req.user!.sub, id, getClientIp(req));
    res.status(ok ? 200 : 404).json({ success: ok });
  });

  router.post('/:id/enable', authorize('users.disable', 'users:manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await iam.enableUser(req.user!.sub, id, getClientIp(req));
    res.status(ok ? 200 : 404).json({ success: ok });
  });

  router.post('/:id/reset-password', authorize('users.reset_password', 'users:manage'), validate(resetPasswordSchema), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      await iam.resetPassword(req.user!.sub, id, req.body.newPassword, req.body.mustChangePassword ?? true, getClientIp(req));
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: String(error), code: 'PASSWORD_RESET_FAILED' });
    }
  });

  router.post('/:id/reset-2fa', authorize('users.reset_2fa', 'users:manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await iam.reset2fa(req.user!.sub, id, getClientIp(req));
    res.status(ok ? 200 : 404).json({ success: ok });
  });

  router.delete('/:id', authorize('users.delete', 'users:manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const ok = await iam.deleteUser(req.user!.sub, req.user!.roleSlug, req.user!.permissions, id, getClientIp(req));
      res.status(ok ? 200 : 404).json({ success: ok });
    } catch (error) {
      res.status(403).json({ error: String(error), code: 'FORBIDDEN' });
    }
  });

  router.get('/:id/sessions', authorize('users.view', 'users:read'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const sessions = await iam.listSessions(id);
    res.json({ success: true, data: sessions });
  });

  return router;
}

export function createRolesRouter(iam: IamService): Router {
  const router = Router();

  router.get('/', authorize('roles.view', 'users:read'), async (_req: Request, res: Response) => {
    const roles = await iam.listRoles();
    res.json({ success: true, data: roles });
  });

  router.get('/permissions', authorize('roles.view', 'users:read'), (_req: Request, res: Response) => {
    res.json({ success: true, data: ALL_PERMISSIONS });
  });

  const roleSchema = z.object({
    name: z.string().min(1).max(64),
    slug: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().max(256),
    permissions: z.array(z.string()),
  });

  router.post('/', authorize('roles.manage', 'users:manage'), validate(roleSchema), async (req: Request, res: Response) => {
    try {
      const role = await iam.createRole(req.body);
      res.status(201).json({ success: true, data: role });
    } catch (error) {
      res.status(400).json({ error: String(error), code: 'ROLE_CREATE_FAILED' });
    }
  });

  router.patch('/:id', authorize('roles.manage', 'users:manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const role = await iam.updateRole(id, req.body);
    if (!role) {
      res.status(404).json({ error: 'Rolle nicht gefunden', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: role });
  });

  router.delete('/:id', authorize('roles.manage', 'users:manage'), async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const ok = await iam.deleteRole(id);
      res.status(ok ? 200 : 404).json({ success: ok });
    } catch (error) {
      res.status(400).json({ error: String(error), code: 'ROLE_DELETE_FAILED' });
    }
  });

  return router;
}
