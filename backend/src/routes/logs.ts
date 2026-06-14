import { Router, Request, Response } from 'express';
import { MonitorService } from '../services/MonitorService';

export function createLogsRouter(monitor: MonitorService): Router {
  const router = Router();
  const logService = monitor.getLogService();

  router.get('/:source/download', async (req: Request, res: Response) => {
    const source = req.params.source;

    if (source !== 'obs' && source !== 'noalbs') {
      res.status(400).json({ error: 'Quelle muss "obs" oder "noalbs" sein' });
      return;
    }

    const text = await logService.getLogsAsText(source);
    const filename = `${source}-logs-${new Date().toISOString().slice(0, 10)}.log`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(text);
  });

  router.get('/:source', async (req: Request, res: Response) => {
    const source = req.params.source;

    if (source !== 'obs' && source !== 'noalbs') {
      res.status(400).json({ error: 'Quelle muss "obs" oder "noalbs" sein' });
      return;
    }

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const logs = await logService.getLogs(source, search);
    res.json(logs);
  });

  return router;
}
