import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import config from '../config';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  // Handle known Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        const target = (err.meta?.target as string[]) || ['field'];
        res.status(409).json({
          success: false,
          error: `A record with this ${target.join(', ')} already exists`,
        });
        return;

      case 'P2025':
        // Record not found
        res.status(404).json({
          success: false,
          error: 'Record not found',
        });
        return;

      case 'P2003':
        // Foreign key constraint failed
        res.status(400).json({
          success: false,
          error: 'Related record not found',
        });
        return;

      default:
        res.status(500).json({
          success: false,
          error: 'Database error',
        });
        return;
    }
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: 'Invalid data provided',
    });
    return;
  }

  // Handle AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired',
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(422).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Default error
  const statusCode = 500;
  const message = config.isProduction ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.isProduction ? {} : { stack: err.stack }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
}

export default { errorHandler, notFoundHandler, AppError };
