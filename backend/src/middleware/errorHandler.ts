import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logging';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  logger.error('Error caught by error handler:', {
    statusCode,
    message,
    code,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function throwError(message: string, statusCode: number, code?: string) {
  throw new AppError(message, statusCode, code);
}
