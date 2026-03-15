import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logging';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    logger.info(`${req.method} ${req.path}`, {
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: (req as any).userId,
    });

    return originalJson(body);
  };

  next();
}
