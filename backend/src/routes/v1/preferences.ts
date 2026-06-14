import { Router, Request, Response } from 'express';
import { UserStore } from '../../auth/UserStore';
import { validate } from '../../middleware/validate';
import { preferencesSchema } from '../../schemas';

export function createPreferencesRouter(userStore: UserStore): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const prefs = userStore.getPreferences(req.user!.sub);
    res.json({ success: true, data: prefs });
  });

  router.put('/', validate(preferencesSchema), async (req: Request, res: Response) => {
    const prefs = await userStore.setPreferences(req.user!.sub, req.body);
    res.json({ success: true, data: prefs });
  });

  return router;
}
