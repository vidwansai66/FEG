import express, { Request, Response, NextFunction } from 'express';
import healthRouter from './routes/health.js';
import slipsRouter from './routes/slips.js';
import validationRouter from './routes/slipValidation.js';
import confirmationRouter from './routes/slipConfirmation.js';

const app = express();

app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/slips', slipsRouter);
app.use('/api/slips', validationRouter);
app.use('/api/slips', confirmationRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: {
      message: 'Not Found'
    }
  });
});

// Centralized error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: {
      message: 'Internal Server Error'
    }
  });
});

export default app;
