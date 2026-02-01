/**
 * Standardized API Response Helpers
 * 
 * Ensures consistent response format across all endpoints
 */

import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: Record<string, any>;
  pagination?: PaginationMeta;
  meta?: Record<string, any>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * HTTP Status Codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Response helper class
 */
export class ApiResponseHelper {
  private res: Response;
  
  constructor(res: Response) {
    this.res = res;
  }
  
  /**
   * Success response
   */
  success<T>(data: T, message?: string, statusCode: number = HttpStatus.OK): Response {
    return this.res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }
  
  /**
   * Created response (201)
   */
  created<T>(data: T, message: string = 'Created successfully'): Response {
    return this.success(data, message, HttpStatus.CREATED);
  }
  
  /**
   * Paginated response
   */
  paginated<T>(
    data: T[],
    pagination: { page: number; limit: number; total: number },
    message?: string
  ): Response {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    
    return this.res.status(HttpStatus.OK).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    });
  }
  
  /**
   * Error response
   */
  error(message: string, statusCode: number = HttpStatus.BAD_REQUEST, details?: Record<string, any>): Response {
    const response: ApiResponse = {
      success: false,
      error: message,
    };
    
    if (details) {
      response.details = details;
    }
    
    return this.res.status(statusCode).json(response);
  }
  
  /**
   * Not found response (404)
   */
  notFound(message: string = 'Resource not found'): Response {
    return this.error(message, HttpStatus.NOT_FOUND);
  }
  
  /**
   * Unauthorized response (401)
   */
  unauthorized(message: string = 'Unauthorized'): Response {
    return this.error(message, HttpStatus.UNAUTHORIZED);
  }
  
  /**
   * Forbidden response (403)
   */
  forbidden(message: string = 'Access denied'): Response {
    return this.error(message, HttpStatus.FORBIDDEN);
  }
  
  /**
   * Validation error response (422)
   */
  validationError(errors: Record<string, string>, message: string = 'Validation failed'): Response {
    return this.res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: message,
      details: errors,
    });
  }
  
  /**
   * No content response (204)
   */
  noContent(): Response {
    return this.res.status(HttpStatus.NO_CONTENT).send();
  }
}

/**
 * Factory function for response helper
 */
export const apiResponse = (res: Response): ApiResponseHelper => new ApiResponseHelper(res);

/**
 * Calculate pagination metadata
 */
export function getPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

