'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import NewsTicker from '@/components/NewsTicker';
import { transactionApi, walletApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CreditCardIcon,
  BanknotesIcon,
  UsersIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuthStore();
  
  const { data: stats } = useQuery({
    queryKey: ['transaction-stats'],
    queryFn: () => transactionApi.getStats(),
  });
  
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getWallet(),
  });
  
  const { data: recentTransactions } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => transactionApi.getTransactions({ limit: 5 }),
  });
  
  const statsData = stats?.data?.data;
  const walletData = wallet?.data?.data;
  const transactions = recentTransactions?.data?.data || [];
  
  const statCards = [
    {
      title: 'Wallet Balance',
      value: `₹${Number(walletData?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: BanknotesIcon,
      change: '+12.5%',
      positive: true,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Total Payin',
      value: `₹${Number(statsData?.payin?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: ArrowDownIcon,
      change: `${statsData?.payin?.count || 0} transactions`,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Total Payout',
      value: `₹${Number(statsData?.payout?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: ArrowUpIcon,
      change: `${statsData?.payout?.count || 0} transactions`,
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      title: 'Total Commission',
      value: `₹${Number(statsData?.totalCommissions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: ChartBarIcon,
      change: 'Earned',
      positive: true,
      gradient: 'from-orange-500 to-amber-500',
    },
  ];
  
  return (
    <>
      <Header title="Dashboard" />
      
      <div className="p-6 space-y-6">
        {/* News Ticker / Announcements */}
        <NewsTicker />
        
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card bg-gradient-to-br from-primary-600/20 to-accent-600/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">
                Welcome back, {user?.firstName || 'User'}! 👋
              </h2>
              <p className="text-white/60">
                Here's what's happening with your account today.
              </p>
            </div>
            <div className="hidden md:block">
              <p className="text-white/40 text-sm">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </motion.div>
        
        {/* Quick Actions - Main Business Operations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <a href="/dashboard/transactions/new" className="glass-card text-center group hover:bg-white/10 transition-all border-2 border-emerald-500/30 hover:border-emerald-500/50">
              <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowDownIcon className="w-7 h-7 text-emerald-400" />
              </div>
              <h4 className="font-semibold text-lg">New Payin</h4>
              <p className="text-sm text-white/40 mt-1">Process payment</p>
            </a>
            
            <a href="/dashboard/transactions/new?type=payout" className="glass-card text-center group hover:bg-white/10 transition-all border-2 border-violet-500/30 hover:border-violet-500/50">
              <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowUpIcon className="w-7 h-7 text-violet-400" />
              </div>
              <h4 className="font-semibold text-lg">New Payout</h4>
              <p className="text-sm text-white/40 mt-1">Send funds</p>
            </a>
            
            <a href="/dashboard/wallet/transfer" className="glass-card text-center group hover:bg-white/10 transition-all border-2 border-blue-500/30 hover:border-blue-500/50">
              <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BanknotesIcon className="w-7 h-7 text-blue-400" />
              </div>
              <h4 className="font-semibold text-lg">Transfer</h4>
              <p className="text-sm text-white/40 mt-1">Move funds</p>
            </a>
            
            <a href="/dashboard/users?action=add" className="glass-card text-center group hover:bg-white/10 transition-all border-2 border-orange-500/30 hover:border-orange-500/50">
              <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-orange-500/30 to-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UsersIcon className="w-7 h-7 text-orange-400" />
              </div>
              <h4 className="font-semibold text-lg">Add User</h4>
              <p className="text-sm text-white/40 mt-1">Create account</p>
            </a>
          </div>
        </motion.div>
        
        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="stat-card group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} bg-opacity-20`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                {stat.positive !== undefined && (
                  <span className={`text-sm font-medium ${stat.positive ? 'text-success-500' : 'text-danger-500'}`}>
                    {stat.change}
                  </span>
                )}
              </div>
              <h3 className="text-white/60 text-sm mb-1">{stat.title}</h3>
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              {stat.positive === undefined && (
                <p className="text-white/40 text-sm mt-1">{stat.change}</p>
              )}
            </motion.div>
          ))}
        </div>
        
        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <a href="/dashboard/transactions" className="text-sm text-primary-400 hover:text-primary-300">
              View all
            </a>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-white/40 text-sm border-b border-white/5">
                  <th className="pb-4 font-medium">Transaction ID</th>
                  <th className="pb-4 font-medium">Type</th>
                  <th className="pb-4 font-medium">Amount</th>
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-white/40">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn: any) => (
                    <tr key={txn.id} className="table-row">
                      <td className="py-4">
                        <span className="font-mono text-sm">{txn.transactionId}</span>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          txn.type === 'PAYIN' 
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-violet-500/10 text-violet-400'
                        }`}>
                          {txn.type === 'PAYIN' ? (
                            <ArrowDownIcon className="w-3 h-3" />
                          ) : (
                            <ArrowUpIcon className="w-3 h-3" />
                          )}
                          {txn.type}
                        </span>
                      </td>
                      <td className="py-4 font-medium">
                        ₹{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          txn.status === 'SUCCESS'
                            ? 'bg-success-500/10 text-success-500'
                            : txn.status === 'FAILED'
                            ? 'bg-danger-500/10 text-danger-500'
                            : 'bg-warning-500/10 text-warning-500'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-4 text-white/60 text-sm">
                        {format(new Date(txn.createdAt), 'MMM d, h:mm a')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </>
  );
}

