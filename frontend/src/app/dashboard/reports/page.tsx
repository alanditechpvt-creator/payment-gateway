'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { transactionApi, rateApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  CreditCardIcon,
  CalendarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
  },
};

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [dateRange, setDateRange] = useState('24h');
  const [entityId, setEntityId] = useState<string>('');

  const canViewDownline = user?.role === 'ADMIN' || user?.role === 'WHITE_LABEL' || user?.role === 'MASTER_DISTRIBUTOR';

  const { data: childrenData } = useQuery({
    queryKey: ['children-rates'],
    queryFn: () => rateApi.getChildrenRates(),
    enabled: canViewDownline,
  });

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['reports-stats', dateRange, entityId],
    queryFn: () => transactionApi.getStats({ range: dateRange, entityId: entityId || undefined }),
  });

  const stats = statsData?.data?.data || {};
  const children: Array<{ id: string; firstName?: string; lastName?: string; email: string }> = childrenData?.data?.data || [];
  const entityOptions = useMemo(() => {
    const list = [{ id: '', label: 'All (me + downline)' }];
    children.forEach((c: any) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
      list.push({ id: c.id, label: name });
    });
    return list;
  }, [children]);
  const selectedEntityLabel = entityId ? entityOptions.find((o) => o.id === entityId)?.label : null;

  const summaryCards = [
    {
      title: 'Total Payin',
      value: `₹${Number(stats.totalPayin ?? 0).toLocaleString()}`,
      icon: ArrowTrendingDownIcon,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'Total Payout',
      value: `₹${Number(stats.totalPayout ?? 0).toLocaleString()}`,
      icon: ArrowTrendingUpIcon,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Commission Earned',
      value: `₹${Number(stats.totalCommission ?? 0).toLocaleString()}`,
      icon: BanknotesIcon,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Total Transactions',
      value: Number(stats.totalTransactions ?? 0).toLocaleString(),
      icon: CreditCardIcon,
      color: 'from-blue-500 to-blue-600',
    },
  ];

  const dailyBreakdown: Array<{ date: string; payinAmount: number; payoutAmount: number }> = stats.dailyBreakdown || [];
  const chartData = useMemo(() => {
    const labels = dailyBreakdown.map((d) => {
      const [y, m, day] = d.date.split('-');
      return `${day}/${m}`;
    });
    return {
      labels,
      datasets: [
        {
          label: 'Payin (₹)',
          data: dailyBreakdown.map((d) => d.payinAmount),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
        },
        {
          label: 'Payout (₹)',
          data: dailyBreakdown.map((d) => d.payoutAmount),
          backgroundColor: 'rgba(249, 115, 22, 0.7)',
          borderColor: 'rgb(249, 115, 22)',
          borderWidth: 1,
        },
      ],
    };
  }, [dailyBreakdown]);

  const totalTransactions = Number(stats.totalTransactions ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-white/50">
              {selectedEntityLabel ? `Report for: ${selectedEntityLabel}` : 'View your transaction reports and analytics'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canViewDownline && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">View by user</label>
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm min-w-[200px]"
                  title="Select a user to see their report, or All for combined"
                >
                  {entityOptions.map((opt) => (
                    <option key={opt.id || 'all'} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Period (24h default for faster load)</label>
              <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                {[
                  { value: '24h', label: '24h' },
                  { value: '7d', label: '7d' },
                  { value: '30d', label: '30d' },
                  { value: '90d', label: '90d' },
                ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    dateRange === option.value
                      ? 'bg-primary-500 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass rounded-2xl p-6 relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2`} />
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-sm text-white/50 mb-1">{card.title}</h3>
            {isLoading ? (
              <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold">{card.value}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-primary-400" />
            Transaction Volume (Payin vs Payout)
          </h3>
          <div className="h-64">
            {dailyBreakdown.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-white/40 text-sm">
                {isLoading ? 'Loading...' : 'No data in this period'}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCardIcon className="w-5 h-5 text-primary-400" />
            Transaction Type Distribution
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/70">Payin</span>
                <span className="font-medium">{stats.payinCount ?? 0} transactions</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all"
                  style={{ width: `${totalTransactions ? ((stats.payinCount ?? 0) / totalTransactions) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/70">Payout</span>
                <span className="font-medium">{stats.payoutCount ?? 0} transactions</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all"
                  style={{ width: `${totalTransactions ? ((stats.payoutCount ?? 0) / totalTransactions) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50">Success Rate</p>
                <p className="text-xl font-bold text-emerald-400">{stats.successRate ?? 0}%</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50">Avg. Amount</p>
                <p className="text-xl font-bold">₹{Number(stats.avgAmount ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary-400" />
          Today&apos;s Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Today&apos;s Transactions</p>
            <p className="text-2xl font-bold">{stats.todayCount ?? 0}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Today&apos;s Volume</p>
            <p className="text-2xl font-bold">₹{Number(stats.todayVolume ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Today&apos;s Commission</p>
            <p className="text-2xl font-bold text-emerald-400">₹{Number(stats.todayCommission ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
