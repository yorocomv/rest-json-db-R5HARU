import { Request, Response, NextFunction } from 'express';
import ErrorResponse from 'interfaces/ErrorResponse';
import ValidatedRequest from 'interfaces/ValidatedRequest';
import { ZodError } from 'zod';
import { DataBaseError } from './db';

export const validateRequest =
  (schema: ValidatedRequest) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.params) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.params = await schema.params.parseAsync(req.params);
      }
      if (schema.body) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.query = await schema.query.parseAsync(req.query);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422);
      }
      next(err);
    }
  };

export function notFound(req: Request, res: Response, next: NextFunction): void {
  res.status(404);
  const error = new Error(`🔍 - Not Found - ${req.originalUrl}`);
  next(error);
}

export function errorHandler(
  err: Error | DataBaseError,
  _req: Request,
  res: Response<ErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof DataBaseError) {
    res.status(err.status).json({
      message: err.message,
      stack: err.stack?.split(/\r\n|\n/),
    });
  } else {
    res.status(res.statusCode).json({
      message: err.message,
      stack: err.stack?.split(/\r\n|\n/),
    });
  }
}
