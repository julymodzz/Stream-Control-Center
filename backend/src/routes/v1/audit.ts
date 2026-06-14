import { Router, Request, Response } from 'express';
import { AuditService } from '../../audit/AuditService';
import { validate } from '../../middleware/validate';
import { auditQuerySchema } from '../../schemas';

export function createAuditRouter(auditService: AuditService): Router {
  const router = Router();

  router.get('/', validate(auditQuerySchema, 'query'), (req: Request, res: Response) => {
    const result = auditService.search({
      query: req.query.query as string | undefined,
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ success: true, data: result });
  });

  return router;
}
