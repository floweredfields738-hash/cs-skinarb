import { Request, Response, NextFunction } from 'express';

// HTTP cache headers for public endpoints
// Browsers and CDNs will cache responses for the specified duration
export function publicCache(seconds: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
    }
    next();
  };
}

// Private cache — cached per-user, not shared
export function privateCache(seconds: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `private, max-age=${seconds}`);
    }
    next();
  };
}

// No cache — dynamic data
export function noCache(req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
}
