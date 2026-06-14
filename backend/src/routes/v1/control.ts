import { Router, Request, Response } from 'express';
import { AuditService } from '../../audit/AuditService';
import { MonitorService } from '../../services/MonitorService';
import { ObsControlService } from '../../services/ObsControlService';
import { ProcessControlService } from '../../services/ProcessControlService';
import { ControlAction } from '../../types';
import { broadcastDashboard } from '../../socket';
import { validate } from '../../middleware/validate';
import { controlActionSchema, obsControlSchema } from '../../schemas';

const VALID_ACTIONS: ControlAction[] = [
  'obs-start', 'obs-stop', 'obs-restart',
  'noalbs-start', 'noalbs-stop', 'noalbs-restart',
  'server-reboot',
];

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

export function createControlRouter(
  processControl: ProcessControlService,
  obsControl: ObsControlService,
  monitor: MonitorService,
  auditService: AuditService
): Router {
  const router = Router();

  router.post('/:action', async (req: Request, res: Response) => {
    const parsed = controlActionSchema.safeParse({ action: req.params.action });
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Ungültige Aktion', code: 'INVALID_ACTION' });
      return;
    }
    const action = parsed.data.action as ControlAction;

    if (!VALID_ACTIONS.includes(action)) {
      res.status(400).json({ success: false, error: 'Ungültige Aktion', code: 'INVALID_ACTION' });
      return;
    }

    const result = await processControl.execute(action);

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: getClientIp(req) },
      `control.${action}`,
      'process',
      result.success,
      result.message
    );

    if (result.success) {
      await broadcastDashboard(monitor);
    }

    res.status(result.success ? 200 : 500).json({ success: result.success, data: result });
  });

  router.post('/obs/action', validate(obsControlSchema), async (req: Request, res: Response) => {
    const { action, sceneName, sourceName, visible, muted } = req.body;
    const result = await obsControl.execute(action, { sceneName, sourceName, visible, muted });

    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: getClientIp(req) },
      `obs.${action}`,
      'obs',
      result.success,
      result.message
    );

    if (result.success) await broadcastDashboard(monitor);
    res.status(result.success ? 200 : 500).json({ success: result.success, data: result });
  });

  return router;
}
