import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    const raw = err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : 500;
    const status = Number.isInteger(raw) && raw >= 400 && raw <= 599 ? raw : 500;
    const safeMessage = status >= 500 ? 'Internal Server Error' :
        err instanceof Error ? err.message : 'Request failed';
    // Avoid logging raw DB errors, query parameters or connection secrets.
    console.error('[central-service] request failed; status=' + status);
    res.status(status).json({ success: false, message: safeMessage });
}
