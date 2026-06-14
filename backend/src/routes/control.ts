import { Router, Request, Response } from 'express';
import { broadcastDashboard } from '../socket';
import { MonitorService } from '../services/MonitorService';
import { ProcessControlService } from '../services/ProcessControlService';
import { ControlAction } from '../types';

const VALID_ACTIONS: ControlAction[] = [
  'obs-start',
  'obs-stop',
  'obs-restart',
  'noalbs-start',
  'noalbs-stop',
  'noalbs-restart',
  'server-reboot',
];

export function createControlRouter(
  processControl: ProcessControlService,
  monitor?: MonitorService
): Router {
  const router = Router();

  router.post('/:action', async (req: Request, res: Response) => {
    const action = req.params.action as ControlAction;

    if (!VALID_ACTIONS.includes(action)) {
      res.status(400).json({
        success: false,
        message: `Ungültige Aktion. Erlaubt: ${VALID_ACTIONS.join(', ')}`,
      });
      return;
    }

    const result = await processControl.execute(action);

    if (monitor && result.success) {
      await broadcastDashboard(monitor);
    }

    res.status(result.success ? 200 : 500).json(result);
  });

  return router;
}
