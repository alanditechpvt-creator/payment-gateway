import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { storageService } from './services/storage.service';

const app = express();

// Security middleware - configure Helmet to allow cross-origin images
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable CSP for development (allows images from any source)
}));
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isDevelopment ? 1000 : 100, // Higher limit for development
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Skip rate limiting for development if needed
    return config.isDevelopment && req.path.includes('/auth/login');
  }
});
app.use('/api', limiter);

// Body parsing
// Capture raw body for webhook signature verification (stored on `req.rawBody`)
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf: Buffer) => {
    try {
      req.rawBody = buf.toString();
    } catch (e) {
      // ignore
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Optimized static file serving with caching headers
app.use('/uploads', (req, res, next) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Caching headers for production performance
  const cacheHeaders = storageService.getCacheHeaders();
  Object.entries(cacheHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // ETag support for conditional requests
  res.setHeader('ETag', `"${Date.now()}"`);
  
  next();
});

// Serve files from organized structure (new) and legacy flat structure
app.use('/uploads', express.static(config.upload.path, {
  maxAge: '30d', // Browser caching
  etag: true,
  lastModified: true,
  index: false,
  dotfiles: 'ignore',
}));

// Fallback to ./uploads for backwards compatibility
app.use('/uploads', express.static('./uploads', {
  maxAge: '30d',
  etag: true,
  lastModified: true,
}));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Payment Gateway API',
    version: '1.0.0',
    status: 'running',
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

