import { Router, Request, Response } from 'express';
import { broadcastDashboard } from '../socket';
import { MonitorService } from '../services/MonitorService';

export function createNotificationsRouter(monitor: MonitorService): Router {
  const router = Router();
  const notificationService = monitor.getNotificationService();

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      active: notificationService.getActiveAlerts(),
      history: notificationService.getHistory(),
    });
  });

  router.post('/acknowledge-all', async (_req: Request, res: Response) => {
    notificationService.acknowledgeAll();
    await broadcastDashboard(monitor);
    res.json({ success: true });
  });

  router.post('/:id/acknowledge', async (req: Request, res: Response) => {
    const success = notificationService.acknowledgeAlert(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    );
    if (success) {
      await broadcastDashboard(monitor);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Benachrichtigung nicht gefunden' });
    }
  });

  return router;
}
