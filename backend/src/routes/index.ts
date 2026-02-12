import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import walletRoutes from './wallet.routes';
import transactionRoutes from './transaction.routes';
import pgRoutes from './pg.routes';
// import schemaRoutes from './schema.routes'; // DEPRECATED - moved to deprecated folder
import beneficiaryRoutes from './beneficiary.routes';
import webhookRoutes from './webhook.routes';
import rateRoutes from './rate.routes';
import ledgerRoutes from './ledger.routes';
import storageRoutes from './storage.routes';
import healthRoutes from './health.routes';
import securityRoutes from './security.routes';
import announcementRoutes from './announcement.routes';
import razorpayRoutes from './razorpay.routes';
import sabpaisaRoutes from './sabpaisa.routes';
import cashfreeRoutes from './cashfree.routes';
import bbpsRoutes from './bbps.routes';
import systemSettingsRoutes from './system-settings.routes';
import channelAdminRoutes from './channelAdmin.routes';
import userRatesRoutes from './userRates.routes';

const router = Router();

// Health checks (no auth required)
router.use('/health', healthRoutes);

// Security (public CAPTCHA config + admin routes)
router.use('/security', securityRoutes);

// Authenticated routes
router.use('/auth', authRoutes);
router.use('/announcements', announcementRoutes);
router.use('/users', userRoutes);
router.use('/wallet', walletRoutes);
router.use('/transactions', transactionRoutes);
router.use('/pg', pgRoutes);
router.use('/razorpay', razorpayRoutes);
router.use('/sabpaisa', sabpaisaRoutes);
router.use('/cashfree', cashfreeRoutes);
router.use('/bbps', bbpsRoutes);
// router.use('/schemas', schemaRoutes); // DEPRECATED - use channel-based system
router.use('/beneficiaries', beneficiaryRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/rates', rateRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/storage', storageRoutes);
// router.use('/card-types', cardTypeRoutes); // DEPRECATED - removed
router.use('/system-settings', systemSettingsRoutes);

// New rate system routes
router.use('/admin/channels', channelAdminRoutes);
router.use('/user-rates', userRatesRoutes);

// System configuration (for frontend to check PG mode)
router.get('/config/pg-mode', (req, res) => {
  const { config } = require('../config');
  res.json({
    mode: config.pgMode.mode,
    autoCheckInterval: config.pgMode.autoCheckInterval,
    description: config.pgMode.mode === 'ONLINE' 
      ? 'Webhook mode - PG will send callbacks automatically'
      : 'Offline mode - Use "Check Status" button to verify payment',
  });
});

// Runpaisa config status (for admin)
router.get('/pg/runpaisa/status', (req, res) => {
  const { runpaisaService } = require('../services/runpaisa.service');
  const { config } = require('../config');
  res.json({
    ...runpaisaService.getConfigStatus(),
    pgMode: config.pgMode.mode,
  });
});

// Cashfree config status (for admin)
router.get('/pg/cashfree/status', (req, res) => {
  const { cashfreeService } = require('../services/cashfree.service');
  const { config } = require('../config');
  res.json({
    ...cashfreeService.getConfigStatus(),
    pgMode: config.pgMode.mode,
  });
});

export default router;

