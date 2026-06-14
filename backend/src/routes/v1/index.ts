import { Router } from 'express';
import { AuthService } from '../../auth/AuthService';
import { TokenService } from '../../auth/TokenService';
import { UserStore } from '../../auth/UserStore';
import { AuditService } from '../../audit/AuditService';
import { IamService } from '../../iam/IamService';
import { createAuthMiddleware, authorize } from '../../middleware/auth';
import { AlertDeliveryService } from '../../services/AlertDeliveryService';
import { BackupService } from '../../services/BackupService';
import { MonitorService } from '../../services/MonitorService';
import { ObsControlService } from '../../services/ObsControlService';
import { ProcessControlService } from '../../services/ProcessControlService';
import { createAuditRouter } from './audit';
import { createAuthRouter } from './auth';
import { createBackupRouter } from './backup';
import { createControlRouter } from './control';
import { createDashboardRouter } from './dashboard';
import { createUsersRouter, createRolesRouter } from './iam';
import { createLogsRouter } from './logs';
import { createNotificationsRouter } from './notifications';
import { createPreferencesRouter } from './preferences';
import { createProfileRouter, createSecurityRouter } from './profile';

export interface V1Dependencies {
  authService: AuthService;
  tokenService: TokenService;
  userStore: UserStore;
  iamService: IamService;
  auditService: AuditService;
  monitorService: MonitorService;
  processControlService: ProcessControlService;
  obsControlService: ObsControlService;
  alertDeliveryService: AlertDeliveryService;
  backupService: BackupService;
}

export function createV1Router(deps: V1Dependencies): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(deps.tokenService);

  router.use('/auth', createAuthRouter(
    deps.authService,
    deps.tokenService,
    deps.iamService,
    deps.auditService
  ));

  router.use('/dashboard', authenticate, authorize('dashboard.view', 'dashboard:read'), createDashboardRouter(deps.monitorService));
  router.use('/control', authenticate, authorize('obs.control', 'noalbs.control', 'control:execute'), createControlRouter(
    deps.processControlService,
    deps.obsControlService,
    deps.monitorService,
    deps.auditService
  ));
  router.use('/logs', authenticate, authorize('logs.view', 'logs:read'), createLogsRouter(deps.monitorService));
  router.use('/notifications', authenticate, authorize('alerts.view', 'alerts:read'), createNotificationsRouter(
    deps.monitorService,
    deps.alertDeliveryService
  ));
  router.use('/audit', authenticate, authorize('audit.view', 'audit:read'), createAuditRouter(deps.auditService));
  router.use('/backup', authenticate, authorize('backup.view', 'backup:read'), createBackupRouter(deps.backupService, deps.auditService));
  router.use('/preferences', authenticate, createPreferencesRouter(deps.userStore));
  router.use('/users', authenticate, createUsersRouter(deps.iamService, deps.auditService, deps.tokenService));
  router.use('/roles', authenticate, createRolesRouter(deps.iamService));
  router.use('/profile', authenticate, createProfileRouter(deps.userStore, deps.iamService, deps.auditService));
  router.use('/security', authenticate, createSecurityRouter(
    deps.authService,
    deps.userStore,
    deps.iamService,
    deps.tokenService,
    deps.auditService
  ));

  return router;
}
