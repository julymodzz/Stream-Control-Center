import { Router, Request, Response } from 'express';
import { AuditService } from '../../audit/AuditService';
import { BackupService } from '../../services/BackupService';

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

export function createBackupRouter(backupService: BackupService, auditService: AuditService): Router {
  const router = Router();

  router.get('/export', async (_req: Request, res: Response) => {
    const data = await backupService.exportSettings();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="scc-settings-export.json"');
    res.send(data);
  });

  router.post('/import', async (req: Request, res: Response) => {
    const ok = await backupService.importSettings(JSON.stringify(req.body));
    res.status(ok ? 200 : 400).json({
      success: ok,
      error: ok ? undefined : 'Ungültiges Import-Format',
      code: ok ? undefined : 'IMPORT_INVALID',
    });
  });

  router.get('/', (_req: Request, res: Response) => {
    res.json({ success: true, data: backupService.listBackups() });
  });

  router.post('/', async (req: Request, res: Response) => {
    const backup = await backupService.createBackup('manual');
    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: getClientIp(req) },
      'backup.create',
      backup.id,
      true
    );
    res.status(201).json({ success: true, data: backup });
  });

  router.post('/:id/restore', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await backupService.restore(id);
    await auditService.log(
      { userId: req.user!.sub, username: req.user!.username, sourceIp: getClientIp(req) },
      'backup.restore',
      id,
      ok
    );
    res.status(ok ? 200 : 404).json({
      success: ok,
      error: ok ? undefined : 'Backup nicht gefunden',
      code: ok ? undefined : 'NOT_FOUND',
    });
  });

  return router;
}
