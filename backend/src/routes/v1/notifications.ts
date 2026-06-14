import { Router, Request, Response } from 'express';
import { hasAnyPermission } from '../../iam/permissions';
import { AlertDeliveryService } from '../../services/AlertDeliveryService';
import { MonitorService } from '../../services/MonitorService';
import { broadcastDashboard } from '../../socket';
import { validate } from '../../middleware/validate';
import { alertConfigSchema } from '../../schemas';

export function createNotificationsRouter(
  monitor: MonitorService,
  alertDelivery: AlertDeliveryService
): Router {
  const router = Router();
  const notificationService = monitor.getNotificationService();

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        active: notificationService.getActiveAlerts(),
        history: notificationService.getHistory(),
        config: alertDelivery.getConfig(),
      },
    });
  });

  router.put('/config', (req: Request, res: Response, next) => {
    if (!req.user || !hasAnyPermission(req.user.permissions ?? [], ['alerts.manage', 'alerts:manage'])) {
      res.status(403).json({ error: 'Unzureichende Berechtigungen', code: 'FORBIDDEN' });
      return;
    }
    next();
  }, validate(alertConfigSchema), (req: Request, res: Response) => {
    const config = alertDelivery.updateConfig(req.body);
    res.json({ success: true, data: config });
  });

  router.post('/acknowledge-all', async (_req: Request, res: Response) => {
    notificationService.acknowledgeAll();
    await broadcastDashboard(monitor);
    res.json({ success: true });
  });

  router.post('/:id/acknowledge', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = notificationService.acknowledgeAlert(id);
    if (success) {
      await broadcastDashboard(monitor);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Benachrichtigung nicht gefunden', code: 'NOT_FOUND' });
    }
  });

  return router;
}
