'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  WalletIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  ClockIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

export default function WalletPage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);

  // Get user permissions
  const userPermissions = Array.isArray(user?.permissions) ? user?.permissions[0] : user?.permissions;
  const canTransfer = user?.role === 'ADMIN' || userPermissions?.canTransferWallet;

  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getWallet(),
  });

  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions', page],
    queryFn: () => walletApi.getTransactions(undefined, { page, limit: 20 }),
  });

  const wallet = walletData?.data?.data;
  const transactions = transactionsData?.data?.data || [];
  const pagination = transactionsData?.data?.pagination || { total: 0, pages: 1 };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'CREDIT':
        return <ArrowDownIcon className="w-4 h-4 text-emerald-400" />;
      case 'DEBIT':
        return <ArrowUpIcon className="w-4 h-4 text-red-400" />;
      case 'TRANSFER_IN':
        return <ArrowsRightLeftIcon className="w-4 h-4 text-blue-400" />;
      case 'TRANSFER_OUT':
        return <ArrowsRightLeftIcon className="w-4 h-4 text-orange-400" />;
      case 'COMMISSION':
        return <BanknotesIcon className="w-4 h-4 text-purple-400" />;
      default:
        return <ClockIcon className="w-4 h-4 text-white/40" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'CREDIT':
      case 'TRANSFER_IN':
      case 'COMMISSION':
        return 'text-emerald-400';
      case 'DEBIT':
      case 'TRANSFER_OUT':
        return 'text-red-400';
      default:
        return 'text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-white/50">Manage your wallet balance and view transaction history</p>
      </div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700 p-6 md:p-8"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-sm">Available Balance</p>
              <p className="text-white/50 text-xs">{user?.email}</p>
            </div>
          </div>
          
          {walletLoading ? (
            <div className="h-12 w-48 bg-white/10 rounded-lg animate-pulse" />
          ) : (
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              ₹{wallet?.balance?.toLocaleString() || '0'}
            </h2>
          )}
          
          <div className="mt-6 flex flex-wrap gap-4 items-center">
            <div className="bg-white/10 rounded-xl px-4 py-2">
              <p className="text-xs text-white/60">Total Credited</p>
              <p className="font-semibold text-emerald-300">
                ₹{wallet?.totalCredited?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-2">
              <p className="text-xs text-white/60">Total Debited</p>
              <p className="font-semibold text-red-300">
                ₹{wallet?.totalDebited?.toLocaleString() || '0'}
              </p>
            </div>
            {canTransfer && (
              <Link
                href="/dashboard/wallet/transfer"
                className="ml-auto flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-white font-semibold transition-all"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
                Transfer Funds
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Transaction History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl"
      >
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold">Transaction History</h3>
        </div>

        {txLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <WalletIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No transactions yet</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="font-medium">{tx.type.replace('_', ' ')}</p>
                      <p className="text-sm text-white/40">{tx.description || '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getTransactionColor(tx.type)}`}>
                      {tx.type === 'DEBIT' || tx.type === 'TRANSFER_OUT' ? '-' : '+'}
                      ₹{tx.amount?.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/40">
                      {format(new Date(tx.createdAt), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                <p className="text-sm text-white/50">
                  Page {page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

