import { Router, Request, Response, NextFunction } from 'express';
import { ValidateSlipRequest } from '../schemas/slipValidation.js';
import { slipValidationService } from '../services/slipValidationService.js';
import { SlipError } from '../services/slipService.js';

const router = Router();

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/validate', asyncHandler(async (req: Request, res: Response) => {
  const parsed = ValidateSlipRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body', details: parsed.error.issues }
    });
  }

  const result = await slipValidationService.validateSlip(parsed.data.slipId);
  res.status(200).json({ ok: true, data: result });
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
