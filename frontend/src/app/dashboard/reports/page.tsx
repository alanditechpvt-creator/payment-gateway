'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { transactionApi } from '@/lib/api';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  CreditCardIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('7d');

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['reports-stats', dateRange],
    queryFn: () => transactionApi.getStats({ range: dateRange }),
  });

  const stats = statsData?.data?.data || {};

  const summaryCards = [
    {
      title: 'Total Payin',
      value: `₹${(stats.totalPayin || 0).toLocaleString()}`,
      change: '+12.5%',
      trend: 'up',
      icon: ArrowTrendingDownIcon,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'Total Payout',
      value: `₹${(stats.totalPayout || 0).toLocaleString()}`,
      change: '+8.2%',
      trend: 'up',
      icon: ArrowTrendingUpIcon,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Commission Earned',
      value: `₹${(stats.totalCommission || 0).toLocaleString()}`,
      change: '+15.3%',
      trend: 'up',
      icon: BanknotesIcon,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Total Transactions',
      value: (stats.totalTransactions || 0).toLocaleString(),
      change: '+23 today',
      trend: 'up',
      icon: CreditCardIcon,
      color: 'from-blue-500 to-blue-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-white/50">View your transaction reports and analytics</p>
        </div>
        
        {/* Date Range Selector */}
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
              <span className={`text-sm font-medium ${
                card.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {card.change}
              </span>
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
        {/* Transaction Volume Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-primary-400" />
            Transaction Volume
          </h3>
          
          <div className="h-64 flex items-center justify-center text-white/30">
            <div className="text-center">
              <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Chart visualization will appear here</p>
              <p className="text-sm">Install a chart library like recharts for visualization</p>
            </div>
          </div>
        </motion.div>

        {/* Transaction Type Distribution */}
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
                <span className="font-medium">{stats.payinCount || 0} transactions</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                  style={{ width: `${stats.totalTransactions ? (stats.payinCount / stats.totalTransactions * 100) : 0}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/70">Payout</span>
                <span className="font-medium">{stats.payoutCount || 0} transactions</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"
                  style={{ width: `${stats.totalTransactions ? (stats.payoutCount / stats.totalTransactions * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50">Success Rate</p>
                <p className="text-xl font-bold text-emerald-400">{stats.successRate || 0}%</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/50">Avg. Amount</p>
                <p className="text-xl font-bold">₹{(stats.avgAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass rounded-2xl p-6"
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary-400" />
          Daily Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Today&apos;s Transactions</p>
            <p className="text-2xl font-bold">{stats.todayCount || 0}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Today&apos;s Volume</p>
            <p className="text-2xl font-bold">₹{(stats.todayVolume || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Today&apos;s Commission</p>
            <p className="text-2xl font-bold text-emerald-400">₹{(stats.todayCommission || 0).toLocaleString()}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

