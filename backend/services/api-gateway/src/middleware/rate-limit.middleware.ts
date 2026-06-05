import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// Tiered rate limits per NHIA tier (enforced at gateway level)
const defaultLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.toString() ?? req.ip ?? 'unknown',
});

const ussdLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'USSD rate limit exceeded.' },
});

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.path.startsWith('/api/v1/ussd')) {
      return ussdLimiter(req, res, next);
    }
    return defaultLimiter(req, res, next);
  }
}
