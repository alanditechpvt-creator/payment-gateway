/**
 * Request Validation Middleware
 * 
 * Uses Zod schemas to validate request body, query, and params
 * Returns consistent error responses
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface ValidationTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate request against Zod schemas
 * 
 * @example
 * router.post('/users', 
 *   validate({ body: createUserSchema }), 
 *   userController.create
 * );
 * 
 * @example
 * router.get('/users/:id',
 *   validate({ 
 *     params: z.object({ id: z.string().uuid() }),
 *     query: paginationSchema 
 *   }),
 *   userController.getById
 * );
 */
export const validate = (schemas: ValidationTarget) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      
      // Validate query
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as any;
      }
      
      // Validate params
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as any;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = formatZodErrors(error);
        
        logger.warn('Validation failed', { 
          path: req.path, 
          errors: formattedErrors 
        });
        
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors,
        });
        return;
      }
      
      next(error);
    }
  };
};

/**
 * Format Zod errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path || 'general'] = err.message;
  });
  
  return errors;
}

/**
 * Validate body only (shorthand)
 */
export const validateBody = (schema: ZodSchema) => validate({ body: schema });

/**
 * Validate query only (shorthand)
 */
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });

/**
 * Validate params only (shorthand)
 */
export const validateParams = (schema: ZodSchema) => validate({ params: schema });

/**
 * Validate UUID param
 */
export const validateUuidParam = (paramName: string = 'id') => {
  const { z } = require('zod');
  return validate({
    params: z.object({
      [paramName]: z.string().uuid(`Invalid ${paramName} format`),
    }),
  });
};

