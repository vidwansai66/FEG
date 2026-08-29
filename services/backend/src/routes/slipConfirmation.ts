import { Router, Request, Response } from 'express';
import { ConfirmSlipRequest } from '../schemas/slipConfirmation.js';
import { slipConfirmationService } from '../services/slipConfirmationService.js';
import { SlipError } from '../services/slipService.js';
import { idempotencyService } from '../services/idempotencyService.js';

const router = Router();

router.post('/:id/confirm', async (req: Request, res: Response) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.trim() === '' || idempotencyKey.length > 128) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key header is missing or invalid'
      }
    });
  }

  const slipId = req.params.id;

  try {
    const acquireResult = await idempotencyService.acquire(idempotencyKey, slipId);

    if (acquireResult.status === 'COMPLETED' || acquireResult.status === 'FAILED') {
      return res.status(acquireResult.httpStatus).json(acquireResult.response);
    }

    if (acquireResult.status === 'IN_PROGRESS') {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
          message: 'A confirmation request with this idempotency key is already in progress'
        }
      });
    }

    const body = ConfirmSlipRequest.safeParse(req.body);

    if (!body.success) {
      const errorResponse = {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: body.error.issues
        }
      };
      await idempotencyService.fail(idempotencyKey, errorResponse, 400);
      return res.status(400).json(errorResponse);
    }

    const result = await slipConfirmationService.confirmSlip(slipId);
    
    const successResponse = {
      ok: true,
      data: result
    };
    
    await idempotencyService.complete(idempotencyKey, successResponse, 200);
    return res.status(200).json(successResponse);
    
  } catch (err: any) {
    if (err.code === 'IDEMPOTENCY_KEY_REUSED') {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: err.message
        }
      });
    }

    if (err instanceof SlipError) {
      const errorResponse = {
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          issues: err.issues
        }
      };

      if (err.code === 'MEMBER_3_UNAVAILABLE') {
        // Safe transient failure (e.g. validateSlip 503 before execution). Release key.
        await idempotencyService.release(idempotencyKey).catch(e => console.error('Failed to release idempotency key:', e));
      } else {
        // Deterministic failure (e.g. ODDS_CHANGED) or Ambiguous execution failure (CONFIRMATION_OUTCOME_UNKNOWN)
        await idempotencyService.fail(idempotencyKey, errorResponse, err.statusCode).catch(e => console.error('Failed to mark idempotency as failed:', e));
      }

      return res.status(err.statusCode).json(errorResponse);
    }
    
    console.error('Unexpected error in confirmSlip:', err);
    
    const internalErrorResponse = {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    };
    
    // We assume 500s are pre-execution or ambiguous. Safest is to fail the key so it's not retried blindly if it was during/after call.
    await idempotencyService.fail(idempotencyKey, internalErrorResponse, 500).catch(e => console.error('Failed to mark idempotency as failed:', e));
    
    return res.status(500).json(internalErrorResponse);
  }
});

export default router;
