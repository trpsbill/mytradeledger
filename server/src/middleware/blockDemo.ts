import { Request, Response, NextFunction } from 'express';

// Fast, synchronous check against the JWT claim — no DB round-trip, since demo
// status never changes mid-session (mirrors requirePaid's fast path). Assumes
// it runs after requireAuth, so req.user is already populated.
export function blockDemo(req: Request, res: Response, next: NextFunction) {
  if (req.user?.isDemo) {
    return res.status(403).json({
      error: "This isn't available in demo mode. Create a free account to unlock it.",
    });
  }
  next();
}
