'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'CREDIT', label: 'Credit' },
  { value: 'DEBIT', label: 'Debit' },
  { value: 'COMMISSION', label: 'Commission' },
  { value: 'TRANSFER_IN', label: 'Transfer In' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out' },
  { value: 'REFUND', label: 'Refund' },
];

export default function LedgerPage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    type: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-ledger', page, filters],
    queryFn: () => ledgerApi.getMyLedger({
      page,
      limit: 25,
      ...filters,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    }),
  });

  const ledgerData = data?.data?.data;
  const entries = ledgerData?.entries || [];
  const summary = ledgerData?.summary || {};
  const pagination = ledgerData?.pagination || { total: 0, totalPages: 1 };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await ledgerApi.exportMyLedger({
        format,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      
      const blob = new Blob([response.data], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger_${format === 'csv' ? 'export' : 'data'}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Ledger exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export ledger');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CREDIT':
        return <ArrowDownIcon className="w-4 h-4 text-emerald-400" />;
      case 'DEBIT':
        return <ArrowUpIcon className="w-4 h-4 text-red-400" />;
      case 'COMMISSION':
        return <BanknotesIcon className="w-4 h-4 text-purple-400" />;
      case 'TRANSFER_IN':
      case 'TRANSFER_OUT':
        return <ArrowsRightLeftIcon className="w-4 h-4 text-blue-400" />;
      case 'REFUND':
        return <ArrowDownIcon className="w-4 h-4 text-cyan-400" />;
      default:
        return <DocumentTextIcon className="w-4 h-4 text-white/40" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      CREDIT: 'bg-emerald-500/10 text-emerald-400',
      DEBIT: 'bg-red-500/10 text-red-400',
      COMMISSION: 'bg-purple-500/10 text-purple-400',
      TRANSFER_IN: 'bg-blue-500/10 text-blue-400',
      TRANSFER_OUT: 'bg-orange-500/10 text-orange-400',
      REFUND: 'bg-cyan-500/10 text-cyan-400',
    };
    return styles[type] || 'bg-white/10 text-white/60';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <DocumentTextIcon className="w-8 h-8 text-primary-400" />
            Ledger
          </h1>
          <p className="text-white/50">Complete record of all wallet transactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
              showFilters ? 'bg-primary-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
            Filters
          </button>
          <div className="relative group">
            <button className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-2">
              <ArrowDownTrayIcon className="w-5 h-5" />
              Export
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 rounded-t-xl"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 rounded-b-xl"
              >
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4"
        >
          <p className="text-white/50 text-sm">Opening Balance</p>
          <p className="text-xl font-bold text-white mt-1">
            ₹{Number(summary.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-xl p-4"
        >
          <p className="text-white/50 text-sm">Total Credits</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            +₹{Number(summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-4"
        >
          <p className="text-white/50 text-sm">Total Debits</p>
          <p className="text-xl font-bold text-red-400 mt-1">
            -₹{Number(summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-4"
        >
          <p className="text-white/50 text-sm">Closing Balance</p>
          <p className="text-xl font-bold text-primary-400 mt-1">
            ₹{Number(summary.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass rounded-xl p-4"
        >
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search description..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              >
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">From Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">To Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setFilters({ type: '', search: '', startDate: '', endDate: '' });
                setPage(1);
              }}
              className="px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              Clear Filters
            </button>
            <button
              onClick={() => {
                setPage(1);
                refetch();
              }}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600"
            >
              Apply Filters
            </button>
          </div>
        </motion.div>
      )}

      {/* Ledger Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No ledger entries found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr className="text-left text-white/50 text-sm">
                    <th className="px-6 py-4 font-medium">Date & Time</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Description</th>
                    <th className="px-6 py-4 font-medium text-right">Debit</th>
                    <th className="px-6 py-4 font-medium text-right">Credit</th>
                    <th className="px-6 py-4 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-white/40" />
                          <div>
                            <p className="text-sm">{format(new Date(entry.date), 'MMM d, yyyy')}</p>
                            <p className="text-xs text-white/40">{format(new Date(entry.date), 'HH:mm:ss')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(entry.type)}
                          <span className={`px-2 py-0.5 rounded text-xs ${getTypeBadge(entry.type)}`}>
                            {entry.type.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{entry.description}</p>
                        {entry.referenceId && (
                          <p className="text-xs text-white/40 font-mono mt-0.5">
                            Ref: {entry.referenceId.slice(0, 8)}...
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {entry.debit > 0 ? (
                          <span className="text-red-400 font-medium">
                            -₹{entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-white/30">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {entry.credit > 0 ? (
                          <span className="text-emerald-400 font-medium">
                            +₹{entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-white/30">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold">
                          ₹{entry.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
              <p className="text-sm text-white/50">
                Showing {((page - 1) * 25) + 1} - {Math.min(page * 25, pagination.total)} of {pagination.total} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

