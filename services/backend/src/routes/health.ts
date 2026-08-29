import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'feg-backend'
  });
});

export default router;
