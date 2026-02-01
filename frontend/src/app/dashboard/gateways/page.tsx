'use client';

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { pgApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

export default function GatewaysPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => pgApi.getAvailablePGs(),
  });

  const gateways = data?.data?.data || data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Payment Gateways</h1>
        <p className="text-white/50">View your available payment gateways and rates</p>
      </div>

      {/* Gateway Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : gateways.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-12 text-center"
        >
          <CreditCardIcon className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <h3 className="text-xl font-semibold mb-2">No Payment Gateways Assigned</h3>
          <p className="text-white/50">Contact your administrator to get payment gateways assigned to your account.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gateways.map((pg: any, index: number) => (
            <motion.div
              key={pg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-br from-primary-500/10 to-accent-500/10">
                <div className="absolute top-4 right-4">
                  {pg.isActive ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium">
                      <XCircleIcon className="w-3.5 h-3.5" />
                      Inactive
                    </span>
                  )}
                </div>
                
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <CreditCardIcon className="w-7 h-7 text-primary-400" />
                </div>
                
                <h3 className="text-xl font-bold">{pg.name}</h3>
                <p className="text-sm text-white/50">{pg.code}</p>
              </div>

              {/* Rates */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60">
                    <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">Payin Rate</span>
                  </div>
                  <span className="font-semibold">
                    {pg.customPayinRate !== null 
                      ? `${pg.customPayinRate}%` 
                      : pg.payinRate 
                        ? `${pg.payinRate}%` 
                        : 'N/A'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60">
                    <BanknotesIcon className="w-4 h-4 text-orange-400" />
                    <span className="text-sm">Payout Rate</span>
                  </div>
                  <span className="font-semibold">
                    {pg.customPayoutRate !== null 
                      ? `${pg.customPayoutRate}%` 
                      : pg.payoutRate 
                        ? `${pg.payoutRate}%` 
                        : 'N/A'}
                  </span>
                </div>

                {/* Transaction Limits */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Min Transaction</span>
                    <span>₹{pg.minTransaction?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Max Transaction</span>
                    <span>₹{pg.maxTransaction?.toLocaleString() || '∞'}</span>
                  </div>
                </div>

                {/* Supported Types */}
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs text-white/50 mb-2">Supported Operations</p>
                  <div className="flex gap-2">
                    {pg.supportedTypes?.includes('PAYIN') && (
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs">
                        Payin
                      </span>
                    )}
                    {pg.supportedTypes?.includes('PAYOUT') && (
                      <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded-lg text-xs">
                        Payout
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="font-semibold mb-2">About Payment Gateway Rates</h3>
        <p className="text-white/50 text-sm leading-relaxed">
          The rates shown above are the commission rates deducted from each transaction. 
          Custom rates may be applied based on your assigned schema or individual rate settings. 
          If you believe your rates should be different, please contact your administrator.
        </p>
      </motion.div>
    </div>
  );
}

