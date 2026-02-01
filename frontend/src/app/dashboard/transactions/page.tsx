'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { transactionApi, pgApi } from '@/lib/api';
import { format } from 'date-fns';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CreditCardIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';

const statusColors: Record<string, string> = {
  SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  SUCCESS: CheckCircleIcon,
  PENDING: ClockIcon,
  FAILED: XCircleIcon,
  PROCESSING: ArrowPathIcon,
};

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pgFilter, setPgFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', page, typeFilter, statusFilter, pgFilter, search],
    queryFn: () => transactionApi.getTransactions({
      page,
      limit: 20,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
      pgId: pgFilter || undefined,
      search: search || undefined,
    }),
  });

  const { data: pgsData } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => pgApi.getAvailablePGs(),
  });

  const transactions = data?.data?.data || [];
  const pagination = data?.data?.pagination || { total: 0, pages: 1 };
  const availablePGs = pgsData?.data?.data || pgsData?.data || [];

  // Group transactions by PG for grouped view
  const groupedByPG = transactions.reduce((acc: any, tx: any) => {
    const pgName = tx.paymentGateway?.name || 'Unknown';
    if (!acc[pgName]) {
      acc[pgName] = { 
        transactions: [], 
        totalAmount: 0, 
        successCount: 0,
        pg: tx.paymentGateway 
      };
    }
    acc[pgName].transactions.push(tx);
    acc[pgName].totalAmount += tx.amount || 0;
    if (tx.status === 'SUCCESS') acc[pgName].successCount++;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-white/50">View all your payin and payout transactions</p>
        </div>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-white/60 hover:text-white'
              }`}
              title="List View"
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grouped' ? 'bg-primary-500 text-white' : 'text-white/60 hover:text-white'
              }`}
              title="Group by Gateway"
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search by transaction ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>

          {/* PG Filter */}
          <select
            value={pgFilter}
            onChange={(e) => setPgFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Gateways</option>
            {availablePGs.map((pg: any) => (
              <option key={pg.id} value={pg.id}>{pg.name}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Types</option>
            <option value="PAYIN">Payin</option>
            <option value="PAYOUT">Payout</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Status</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : transactions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-20 text-center"
        >
          <FunnelIcon className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/40">No transactions found</p>
        </motion.div>
      ) : viewMode === 'grouped' ? (
        /* Grouped by Gateway View */
        <div className="space-y-6">
          {Object.entries(groupedByPG ?? {}).map(([pgName, pgData]: [string, any]) => (
            <motion.div
              key={pgName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl overflow-hidden"
            >
              {/* Gateway Header */}
              <div className="p-4 bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-b border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                      <CreditCardIcon className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{pgName}</h3>
                      <p className="text-sm text-white/50">{pgData.transactions.length} transactions</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-white/50">Total Volume</p>
                      <p className="font-bold text-lg">₹{pgData.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-white/50">Success Rate</p>
                      <p className="font-bold text-lg text-emerald-400">
                        {pgData.transactions.length > 0 
                          ? Math.round((pgData.successCount / pgData.transactions.length) * 100) 
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Transactions List */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr className="text-left text-white/50 text-sm">
                      <th className="px-6 py-3 font-medium">Transaction ID</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pgData.transactions.map((tx: any) => {
                      const StatusIcon = statusIcons[tx.status] || ClockIcon;
                      return (
                        <tr key={tx.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3">
                            <span className="font-mono text-sm">{tx.transactionId}</span>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium ${
                              tx.type === 'PAYIN' 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'bg-orange-500/10 text-orange-400'
                            }`}>
                              {tx.type === 'PAYIN' ? (
                                <ArrowDownIcon className="w-3 h-3" />
                              ) : (
                                <ArrowUpIcon className="w-3 h-3" />
                              )}
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className="font-semibold">₹{tx.amount?.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-medium ${statusColors[tx.status]}`}>
                              <StatusIcon className="w-3 h-3" />
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-white/50 text-sm">
                            {format(new Date(tx.createdAt), 'MMM d, HH:mm')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List View */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr className="text-left text-white/50 text-sm">
                  <th className="px-6 py-4 font-medium">Transaction ID</th>
                  <th className="px-6 py-4 font-medium">Gateway</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => {
                  const StatusIcon = statusIcons[tx.status] || ClockIcon;
                  return (
                    <tr key={tx.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">{tx.transactionId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-500/10 text-primary-400 text-xs font-medium">
                          <CreditCardIcon className="w-3.5 h-3.5" />
                          {tx.paymentGateway?.name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          tx.type === 'PAYIN' 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : tx.type === 'CC_PAYMENT'
                            ? 'bg-pink-500/10 text-pink-400'
                            : 'bg-orange-500/10 text-orange-400'
                        }`}>
                          {tx.type === 'PAYIN' ? (
                            <ArrowDownIcon className="w-3.5 h-3.5" />
                          ) : tx.type === 'CC_PAYMENT' ? (
                            <CreditCardIcon className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpIcon className="w-3.5 h-3.5" />
                          )}
                          {tx.type === 'CC_PAYMENT' ? 'CC PAY' : tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold">₹{tx.amount?.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${statusColors[tx.status]}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/50">
                        {format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
              <p className="text-sm text-white/50">
                Showing page {page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </motion.div>
      )}
    </div>
  );
}

