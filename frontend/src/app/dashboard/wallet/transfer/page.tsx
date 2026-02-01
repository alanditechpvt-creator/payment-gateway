'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  BanknotesIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export default function WalletTransferPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  
  // Fetch current wallet
  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getWallet(),
  });
  
  // Fetch users for transfer (children in hierarchy)
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users-for-transfer', search],
    queryFn: () => userApi.getUsers({ search, limit: 50 }),
  });
  
  const wallet = walletData?.data?.data;
  const users = usersData?.data?.data || [];
  
  const transferMutation = useMutation({
    mutationFn: () => walletApi.transfer(selectedUser.id, parseFloat(amount), description),
    onSuccess: () => {
      toast.success(`₹${amount} transferred successfully!`);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      router.push('/dashboard/wallet');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Transfer failed');
    },
  });
  
  const handleTransfer = () => {
    if (!selectedUser) {
      toast.error('Please select a recipient');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) > (wallet?.balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }
    transferMutation.mutate();
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transfer Funds</h1>
          <p className="text-white/50">Send money to users in your hierarchy</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/50">Available Balance</p>
          <p className="text-2xl font-bold text-emerald-400">
            ₹{Number(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Select Recipient */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserCircleIcon className="w-5 h-5 text-primary-400" />
            Select Recipient
          </h3>
          
          {/* Search */}
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500"
            />
          </div>
          
          {/* Users List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {usersLoading ? (
              <div className="text-center py-8 text-white/40">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-white/40">No users found</div>
            ) : (
              users.filter((u: any) => u.id !== user?.id).map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    selectedUser?.id === u.id
                      ? 'bg-primary-500/20 border-2 border-primary-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center font-semibold">
                    {u.firstName?.[0] || u.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">
                      {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                    </p>
                    <p className="text-sm text-white/40">{u.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-white/10 text-white/60">
                    {u.role.replace('_', ' ')}
                  </span>
                </button>
              ))
            )}
          </div>
        </motion.div>
        
        {/* Transfer Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-emerald-400" />
            Transfer Details
          </h3>
          
          {/* Selected User Display */}
          {selectedUser ? (
            <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
              <p className="text-sm text-white/50 mb-1">Sending to</p>
              <p className="font-semibold text-lg">
                {selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName || ''}` : selectedUser.email}
              </p>
              <p className="text-sm text-white/40">{selectedUser.email}</p>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl text-center text-white/40">
              Select a recipient from the list
            </div>
          )}
          
          {/* Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-white/70 mb-2">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">₹</span>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-2xl font-bold placeholder-white/20 focus:outline-none focus:border-primary-500"
              />
            </div>
            {wallet && parseFloat(amount) > wallet.balance && (
              <p className="text-red-400 text-sm mt-1">Insufficient balance</p>
            )}
          </div>
          
          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white/70 mb-2">Description (Optional)</label>
            <input
              type="text"
              placeholder="Add a note..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500"
            />
          </div>
          
          {/* Summary */}
          {selectedUser && amount && parseFloat(amount) > 0 && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Transfer Amount</span>
                <span>₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Your Balance After</span>
                <span className="text-emerald-400">
                  ₹{(wallet?.balance - parseFloat(amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
          
          {/* Transfer Button */}
          <button
            onClick={handleTransfer}
            disabled={!selectedUser || !amount || parseFloat(amount) <= 0 || transferMutation.isPending}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-lg hover:from-emerald-400 hover:to-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {transferMutation.isPending ? (
              'Processing...'
            ) : (
              <>
                <ArrowRightIcon className="w-5 h-5" />
                Transfer Funds
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

