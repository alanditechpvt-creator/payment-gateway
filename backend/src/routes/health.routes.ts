/**
 * Health Check Routes
 * 
 * Endpoints for monitoring and load balancer health checks
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { runpaisaService } from '../services/runpaisa.service';
import { config } from '../config';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: ComponentStatus;
    cache?: ComponentStatus;
    storage?: ComponentStatus;
    external?: Record<string, ComponentStatus>;
  };
}

interface ComponentStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
}

/**
 * Basic health check (for load balancers)
 * GET /api/health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Quick database check
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
});

/**
 * Detailed health check
 * GET /api/health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    database: { status: 'down' },
    external: {},
  };
  
  // Check database
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'up',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'down',
      message: 'Database connection failed',
    };
  }
  
  // Check Runpaisa (if configured)
  if (runpaisaService.isConfigured()) {
    try {
      const configStatus = runpaisaService.getConfigStatus();
      checks.external!['runpaisa'] = {
        status: configStatus.configured ? 'up' : 'degraded',
        message: `Environment: ${configStatus.environment}`,
      };
    } catch (error) {
      checks.external!['runpaisa'] = {
        status: 'down',
        message: 'Runpaisa check failed',
      };
    }
  }
  
  // Determine overall status
  let overallStatus: HealthStatus['status'] = 'healthy';
  
  if (checks.database.status === 'down') {
    overallStatus = 'unhealthy';
  } else if (checks.database.status === 'degraded') {
    overallStatus = 'degraded';
  }
  
  // Check external services
  if (checks.external) {
    const externalStatuses = Object.values(checks.external);
    if (externalStatuses.some(s => s.status === 'down')) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }
  }
  
  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
  };
  
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
});

/**
 * Readiness check (for Kubernetes)
 * GET /api/health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: 'Database not ready',
    });
  }
});

/**
 * Liveness check (for Kubernetes)
 * GET /api/health/live
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Version info
 * GET /api/health/version
 */
router.get('/version', (req: Request, res: Response) => {
  res.json({
    version: process.env.npm_package_version || '1.0.0',
    name: 'Payment Gateway API',
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    buildTime: process.env.BUILD_TIME || 'unknown',
    commitHash: process.env.COMMIT_HASH || 'unknown',
  });
});

export default router;

