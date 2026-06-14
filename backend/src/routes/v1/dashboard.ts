import { Router, Request, Response } from 'express';
import { MonitorService } from '../../services/MonitorService';
import { metricsHistory } from '../../observability/metrics';

export function createDashboardRouter(monitor: MonitorService): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const data = await monitor.collectDashboardData();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ error: 'Dashboard-Daten konnten nicht geladen werden', code: 'DASHBOARD_ERROR' });
    }
  });

  router.get('/metrics/history', (_req: Request, res: Response) => {
    res.json({ success: true, data: metricsHistory.getHistory() });
  });

  return router;
}
