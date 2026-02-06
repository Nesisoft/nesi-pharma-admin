import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Send success response
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send success response with pagination
 */
export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): Response {
  const response: ApiResponse<T[]> = {
    success: true,
    message,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  return res.status(200).json(response);
}

/**
 * Send error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string[]>
): Response {
  const response: ApiResponse = {
    success: false,
    error: message,
    errors,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send validation error response
 */
export function sendValidationError(
  res: Response,
  errors: Record<string, string[]>
): Response {
  return sendError(res, 'Validation failed', 422, errors);
}

/**
 * Send not found response
 */
export function sendNotFound(res: Response, resource = 'Resource'): Response {
  return sendError(res, `${resource} not found`, 404);
}

/**
 * Send unauthorized response
 */
export function sendUnauthorized(res: Response, message = 'Unauthorized'): Response {
  return sendError(res, message, 401);
}

/**
 * Send forbidden response
 */
export function sendForbidden(res: Response, message = 'Forbidden'): Response {
  return sendError(res, message, 403);
}

/**
 * Send internal server error response
 */
export function sendServerError(res: Response, message = 'Internal server error'): Response {
  return sendError(res, message, 500);
}

/**
 * Send created response (201)
 */
export function sendCreated<T>(res: Response, data?: T, message?: string): Response {
  return sendSuccess(res, data, message, 201);
}

export default {
  sendSuccess,
  sendPaginatedSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendServerError,
  sendCreated,
};
