'use client';

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { transactionApi, pgApi } from '@/lib/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
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
  InformationCircleIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

function getPaymentIdFromTx(tx: any): string {
  if (!tx?.pgResponse) return '';
  try {
    const pr = typeof tx.pgResponse === 'string' ? JSON.parse(tx.pgResponse) : tx.pgResponse;
    return (
      pr?.PAYMENT_ID ||
      pr?.ORDERSTATUS?.PAYMENT_ID ||
      pr?.payment_id ||
      pr?.paymentId ||
      pr?.razorpay_payment_id ||
      pr?.bankTxnId ||
      pr?.BankTxnId ||
      pr?.sabpaisaTxnId ||
      pr?.id ||
      ''
    );
  } catch {
    return '';
  }
}

function escapeCsvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildTransactionsCsv(txList: any[]): string {
  const headers = [
    'Transaction ID',
    'Payment ID',
    'Gateway',
    'Type',
    'Amount',
    'Status',
    'Date',
    'Customer Name',
    'Customer Email',
    'PG Charges',
    'Commission',
    'Net Amount',
    'Beneficiary Name',
  ];
  const rows = txList.map((tx: any) => [
    tx.transactionId ?? '',
    getPaymentIdFromTx(tx),
    tx.paymentGateway?.name ?? '',
    tx.type ?? '',
    tx.amount ?? '',
    tx.status ?? '',
    tx.createdAt ? format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
    tx.customerName ?? '',
    tx.customerEmail ?? '',
    tx.pgCharges ?? '',
    tx.platformCommission ?? '',
    tx.netAmount ?? '',
    tx.beneficiaryName ?? '',
  ]);
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pgFilter, setPgFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [infoTransactionId, setInfoTransactionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportInProgressRef = useRef(false);

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
  const pagination = data?.data?.pagination || { total: 0, totalPages: 1, page: 1, limit: 20 };
  const totalPages = pagination.totalPages ?? (pagination.pages ?? 1);
  const total = pagination.total ?? 0;
  const from = total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, total);
  const availablePGs = pgsData?.data?.data || pgsData?.data || [];

  const { data: txDetailData } = useQuery({
    queryKey: ['transaction', infoTransactionId],
    queryFn: () => transactionApi.getTransactionById(infoTransactionId!),
    enabled: !!infoTransactionId,
  });
  const txDetail = txDetailData?.data?.data;

  const handleExport = useCallback(async () => {
    if (exportInProgressRef.current) return;
    exportInProgressRef.current = true;
    setExporting(true);
    try {
      const res = await transactionApi.getTransactions({
        page: 1,
        limit: 10000,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        pgId: pgFilter || undefined,
        search: search || undefined,
      });
      const list = res?.data?.data ?? [];
      if (list.length === 0) {
        toast.error('No transactions to export');
        return;
      }
      const csv = buildTransactionsCsv(list);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${list.length} transaction(s)`);
    } catch (e) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
      exportInProgressRef.current = false;
    }
  }, [typeFilter, statusFilter, pgFilter, search]);

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
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleExport(); }}
            disabled={exporting || total === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            title="Export transactions (current filters) as CSV"
          >
            {exporting ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDownTrayIcon className="w-4 h-4" />
            )}
            Export CSV
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
                  <th className="px-6 py-4 font-medium">Payment ID</th>
                  <th className="px-6 py-4 font-medium">Gateway</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => {
                  const StatusIcon = statusIcons[tx.status] || ClockIcon;
                  const paymentId = getPaymentIdFromTx(tx);
                  return (
                    <tr key={tx.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">{tx.transactionId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-white/70">{paymentId || '–'}</span>
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
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setInfoTransactionId(tx.transactionId)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                          title="View details"
                        >
                          <InformationCircleIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Transaction details modal */}
          {infoTransactionId && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setInfoTransactionId(null)}
            >
              <div
                className="bg-slate-900 rounded-2xl border border-white/10 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="text-lg font-semibold text-white">Transaction details</h3>
                  <button
                    type="button"
                    onClick={() => setInfoTransactionId(null)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/70"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto p-4 space-y-4">
                  {!txDetail && txDetailData !== undefined ? (
                    <div className="text-center py-8 text-white/50">Loading…</div>
                  ) : txDetail ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="text-white/50">Transaction ID</div>
                        <div className="font-mono text-white">{txDetail.transactionId}</div>
                        {(() => {
                          let paymentId = '';
                          if (txDetail.pgResponse) {
                            try {
                              const pr = typeof txDetail.pgResponse === 'string' ? JSON.parse(txDetail.pgResponse) : txDetail.pgResponse;
                              paymentId = pr?.PAYMENT_ID || pr?.ORDERSTATUS?.PAYMENT_ID || pr?.payment_id || pr?.paymentId || pr?.razorpay_payment_id || pr?.bankTxnId || pr?.BankTxnId || pr?.sabpaisaTxnId || pr?.id || '';
                            } catch { /* ignore */ }
                          }
                          return paymentId ? (
                            <>
                              <div className="text-white/50">Payment ID (PG)</div>
                              <div className="font-mono text-white">{paymentId}</div>
                            </>
                          ) : null;
                        })()}
                        <div className="text-white/50">Gateway</div>
                        <div className="text-white">{txDetail.paymentGateway?.name || '-'}</div>
                        <div className="text-white/50">Type</div>
                        <div className="text-white">{txDetail.type}</div>
                        <div className="text-white/50">Amount</div>
                        <div className="font-semibold text-white">₹{Number(txDetail.amount)?.toLocaleString()}</div>
                        <div className="text-white/50">Status</div>
                        <div className="text-white">{txDetail.status}</div>
                        <div className="text-white/50">Date</div>
                        <div className="text-white">{format(new Date(txDetail.createdAt), 'PPpp')}</div>
                        <div className="text-white/50">Card / Channel</div>
                        <div className="text-white">
                          {txDetail.transactionChannel
                            ? `${txDetail.transactionChannel.name || txDetail.transactionChannel.code || '-'} (${txDetail.transactionChannel.code || ''})`
                            : txDetail.rawPaymentMethod || '-'}
                        </div>
                        <div className="text-white/50">PG charges</div>
                        <div className="text-white">₹{Number(txDetail.pgCharges ?? 0).toFixed(2)}</div>
                        <div className="text-white/50">Net amount</div>
                        <div className="text-emerald-400 font-medium">₹{Number(txDetail.netAmount ?? 0).toFixed(2)}</div>
                      </div>
                      {txDetail.pgResponse && (
                        <div>
                          <h4 className="text-white/70 font-medium mb-2">PG response</h4>
                          <pre className="p-3 bg-black/30 rounded-lg text-xs text-white/80 overflow-x-auto max-h-48 overflow-y-auto">
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(txDetail.pgResponse), null, 2);
                              } catch {
                                return String(txDetail.pgResponse);
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-white/50">Could not load transaction.</div>
                  )}
                </div>
              </div>
            </div>
          )}

        </motion.div>
      )}

      {/* Pagination — shown for both list and grouped view */}
      {!isLoading && total > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 glass rounded-2xl">
          <p className="text-sm text-white/50">
            Showing {from}–{to} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="text-sm text-white/70 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Next page"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

