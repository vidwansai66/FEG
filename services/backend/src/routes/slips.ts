import { Router, Request, Response, NextFunction } from 'express';
import { CreateSlipRequest, UpdateSlipRequest } from '../schemas/slips.js';
import { slipService, SlipError } from '../services/slipService.js';

const router = Router();

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = CreateSlipRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body', details: parsed.error.issues }
    });
  }

  const result = await slipService.createSlip(parsed.data);
  res.status(201).json({ ok: true, data: result });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await slipService.getSlip(id);
  res.status(200).json({ ok: true, data: result });
}));

router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = UpdateSlipRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body', details: parsed.error.issues }
    });
  }

  const result = await slipService.updateSlip(id, parsed.data);
  res.status(200).json({ ok: true, data: result });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await slipService.deleteSlip(id);
  res.status(200).json({ ok: true, data: { deleted: true } });
}));

router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SlipError) {
    res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message
      }
    });
  } else {
    next(err);
  }
});

export default router;
