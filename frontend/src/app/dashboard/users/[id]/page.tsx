'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, rateApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyRupeeIcon,
  ShieldCheckIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  WalletIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { walletApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

// Helper to get correct image URL - backend returns just filename
const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  return `${API_URL}/uploads/${path}`;
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const userId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<'details' | 'wallet' | 'rates' | 'permissions'>('details');
  const [selectedPG, setSelectedPG] = useState('');
  const [payinRate, setPayinRate] = useState('');
  const [payoutRate, setPayoutRate] = useState('');
  
  // Wallet state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  
  // Check if current user can manage this user
  const canAssignRates = currentUser?.role === 'ADMIN' || currentUser?.role === 'WHITE_LABEL' || currentUser?.role === 'MASTER_DISTRIBUTOR';
  const currentUserPerms = Array.isArray(currentUser?.permissions) ? currentUser?.permissions[0] : currentUser?.permissions;
  const canTransferWallet = currentUser?.role === 'ADMIN' || currentUserPerms?.canTransferWallet;
  
  // Fetch user details
  const { data: userData, isLoading, refetch: refetchUser } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => userApi.getUserById(userId),
    enabled: !!userId,
  });
  
  // Fetch available PGs
  const { data: pgsData } = useQuery({
    queryKey: ['available-pgs-for-assignment'],
    queryFn: () => rateApi.getAvailablePGsForAssignment(),
    enabled: canAssignRates,
  });
  
  // Fetch user's rates
  const { data: userRatesData, refetch: refetchRates } = useQuery({
    queryKey: ['user-rates-detail', userId],
    queryFn: async () => {
      const childrenRates = await rateApi.getChildrenRates();
      const userData = childrenRates.data?.data?.find((c: any) => c.id === userId);
      return userData;
    },
    enabled: !!userId && canAssignRates,
  });
  
  // Fetch user's wallet
  const { data: userWalletData, refetch: refetchUserWallet } = useQuery({
    queryKey: ['user-wallet', userId],
    queryFn: () => walletApi.getWallet(userId),
    enabled: !!userId,
  });
  
  // Fetch current user's wallet (for transfer)
  const { data: myWalletData, refetch: refetchMyWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => walletApi.getWallet(),
    enabled: canTransferWallet,
  });
  
  const user = userData?.data?.data;
  const availablePGs = pgsData?.data?.data || [];
  const userRates = userRatesData?.rates || [];
  const userWallet = userWalletData?.data?.data;
  const myWallet = myWalletData?.data?.data;
  
  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ approved, reason }: { approved: boolean; reason?: string }) =>
      userApi.approveUser(userId, approved, reason),
    onSuccess: (_, variables) => {
      toast.success(variables.approved ? 'User approved!' : 'User rejected');
      refetchUser();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Action failed');
    },
  });
  
  const updatePermissionsMutation = useMutation({
    mutationFn: (permissions: any) => userApi.updatePermissions(userId, permissions),
    onSuccess: () => {
      toast.success('Permissions updated!');
      refetchUser();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update permissions');
    },
  });
  
  const assignRateMutation = useMutation({
    mutationFn: ({ pgId, payinRate, payoutRate }: any) =>
      rateApi.assignRate(userId, pgId, payinRate, payoutRate),
    onSuccess: () => {
      toast.success('Rate assigned!');
      refetchRates();
      setSelectedPG('');
      setPayinRate('');
      setPayoutRate('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to assign rate');
    },
  });
  
  // Wallet transfer mutation
  const transferMutation = useMutation({
    mutationFn: ({ toUserId, amount, description }: { toUserId: string; amount: number; description: string }) =>
      walletApi.transfer(toUserId, amount, description),
    onSuccess: () => {
      toast.success('Funds transferred successfully!');
      refetchUserWallet();
      refetchMyWallet();
      setTransferAmount('');
      setTransferDescription('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Transfer failed');
    },
  });
  
  // Permission state
  const [permissions, setPermissions] = useState({
    canCreateUsers: false,
    canManageWallet: false,
    canTransferWallet: false,
    canViewReports: true,
    canViewTransactions: true,
    canInitiatePayin: false,
    canInitiatePayout: false,
    canAssignRates: false,
  });
  
  useEffect(() => {
    if (user?.permissions) {
      // permissions is an array, get the first element
      const userPerms = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
      if (userPerms) {
        setPermissions({
          canCreateUsers: userPerms.canCreateUsers || false,
          canManageWallet: userPerms.canManageWallet || false,
          canTransferWallet: userPerms.canTransferWallet || false,
          canViewReports: userPerms.canViewReports ?? true,
          canViewTransactions: userPerms.canViewTransactions ?? true,
          canInitiatePayin: userPerms.canInitiatePayin || false,
          canInitiatePayout: userPerms.canInitiatePayout || false,
          canAssignRates: userPerms.canAssignRates || false,
        });
      }
    }
  }, [user]);
  
  const handleAssignRate = () => {
    if (!selectedPG) {
      toast.error('Please select a payment gateway');
      return;
    }
    
    const pg = availablePGs.find((p: any) => p.id === selectedPG);
    if (!pg) return;
    
    const payinRateNum = parseFloat(payinRate) / 100;
    const payoutRateNum = parseFloat(payoutRate) / 100;
    
    if (payinRateNum < pg.minPayinRate) {
      toast.error(`Payin rate cannot be less than ${(pg.minPayinRate * 100).toFixed(2)}%`);
      return;
    }
    
    assignRateMutation.mutate({
      pgId: selectedPG,
      payinRate: payinRateNum,
      payoutRate: payoutRateNum,
    });
  };
  
  const handleSavePermissions = () => {
    updatePermissionsMutation.mutate(permissions);
  };
  
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      PENDING_ONBOARDING: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      SUSPENDED: 'bg-red-500/10 text-red-400 border-red-500/30',
    };
    return styles[status] || 'bg-white/10 text-white/60 border-white/10';
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">User Not Found</h2>
          <p className="text-white/50 mb-4">The user you're looking for doesn't exist or you don't have access.</p>
          <Link href="/dashboard/users" className="btn-primary">
            Back to Users
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/users')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">User Profile</h1>
          <p className="text-white/50">{user.email}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusBadge(user.status)}`}>
          {user.status.replace('_', ' ')}
        </span>
      </div>
      
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - User Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          {/* Profile Photo */}
          <div className="text-center mb-6">
            {user.profilePhoto ? (
              <img
                src={getImageUrl(user.profilePhoto)}
                alt="Profile"
                className="w-20 h-20 rounded-full mx-auto object-cover border-4 border-white/10"
              />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-2xl font-bold">
                {user.firstName?.[0] || user.email[0].toUpperCase()}
              </div>
            )}
            <h2 className="text-lg font-bold mt-3">
              {user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email}
            </h2>
            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-primary-500/10 text-primary-400 text-xs">
              {user.role.replace('_', ' ')}
            </span>
          </div>
          
          {/* Quick Info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-white/70">
              <EnvelopeIcon className="w-4 h-4" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <PhoneIcon className="w-4 h-4" />
              <span>{user.phone || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <BuildingOfficeIcon className="w-4 h-4" />
              <span>{user.businessName || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <ClockIcon className="w-4 h-4" />
              <span>Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>
          
          {/* Action Buttons */}
          {(user.status === 'PENDING_APPROVAL' || user.status === 'PENDING_ONBOARDING') && (
            <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
              <button
                onClick={() => approveMutation.mutate({ approved: true })}
                disabled={approveMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Approve
              </button>
              <button
                onClick={() => approveMutation.mutate({ approved: false })}
                disabled={approveMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <XCircleIcon className="w-5 h-5" />
                Reject
              </button>
            </div>
          )}
        </motion.div>
        
        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {[
              { id: 'details', label: 'Details', icon: UserCircleIcon },
              ...(canTransferWallet ? [{ id: 'wallet', label: 'Wallet', icon: WalletIcon }] : []),
              ...(canAssignRates ? [{ id: 'rates', label: 'Rates', icon: CurrencyRupeeIcon }] : []),
              ...(canAssignRates ? [{ id: 'permissions', label: 'Permissions', icon: ShieldCheckIcon }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6"
          >
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">User Information</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">First Name</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">{user.firstName || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Last Name</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">{user.lastName || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Email</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg flex items-center gap-2">
                      {user.email}
                      {user.emailVerified && <CheckCircleIcon className="w-4 h-4 text-emerald-400" />}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Phone</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">{user.phone || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Business Name</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">{user.businessName || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Role</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">{user.role.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">PAN</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg flex items-center gap-2">
                      {user.panNumber || '-'}
                      {user.panVerified === 'VERIFIED' && <CheckCircleIcon className="w-4 h-4 text-emerald-400" />}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Aadhaar</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg flex items-center gap-2">
                      {user.aadhaarNumber ? `XXXX ${user.aadhaarNumber.slice(-4)}` : '-'}
                      {user.aadhaarVerified === 'VERIFIED' && <CheckCircleIcon className="w-4 h-4 text-emerald-400" />}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Wallet Tab */}
            {activeTab === 'wallet' && canTransferWallet && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Wallet Management</h3>
                
                {/* User's Wallet Balance */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-xl p-4 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <WalletIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-white/60 text-sm">{user?.firstName || 'User'}'s Balance</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">
                      ₹{Number(userWallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <WalletIcon className="w-4 h-4 text-blue-400" />
                      <span className="text-white/60 text-sm">Your Balance</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">
                      ₹{Number(myWallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                
                {/* Transfer Form */}
                <div className="pt-4 border-t border-white/10">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <PaperAirplaneIcon className="w-4 h-4 text-primary-400" />
                    Transfer Funds to {user?.firstName || 'User'}
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        placeholder="0.00"
                      />
                      {transferAmount && parseFloat(transferAmount) > Number(myWallet?.balance || 0) && (
                        <p className="text-red-400 text-xs mt-1">Insufficient balance</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Description (Optional)</label>
                      <input
                        type="text"
                        value={transferDescription}
                        onChange={(e) => setTransferDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        placeholder="Enter reason..."
                      />
                    </div>
                    
                    <button
                      onClick={() => {
                        const amount = parseFloat(transferAmount);
                        if (!amount || amount <= 0) {
                          toast.error('Please enter a valid amount');
                          return;
                        }
                        if (amount > Number(myWallet?.balance || 0)) {
                          toast.error('Insufficient balance');
                          return;
                        }
                        transferMutation.mutate({
                          toUserId: userId,
                          amount,
                          description: transferDescription || `Transfer to ${user?.email}`,
                        });
                      }}
                      disabled={transferMutation.isPending || !transferAmount || parseFloat(transferAmount) > Number(myWallet?.balance || 0)}
                      className="w-full py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PaperAirplaneIcon className="w-5 h-5" />
                      {transferMutation.isPending ? 'Transferring...' : 'Transfer Funds'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Rates Tab */}
            {activeTab === 'rates' && canAssignRates && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Rate Assignment</h3>
                
                {/* Current Rates */}
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-2">Current Rates</h4>
                  {userRates.length === 0 ? (
                    <div className="text-center py-4 bg-white/5 rounded-lg text-white/50 text-sm">
                      No rates assigned yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userRates.map((rate: any) => (
                        <div
                          key={rate.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{rate.paymentGateway.name}</p>
                          </div>
                          <div className="text-right text-sm">
                            <span className="text-emerald-400">{(rate.payinRate * 100).toFixed(2)}%</span>
                            <span className="text-white/30 mx-1">|</span>
                            <span className="text-blue-400">{(rate.payoutRate * 100).toFixed(2)}%</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedPG(rate.paymentGateway.id);
                              setPayinRate((rate.payinRate * 100).toString());
                              setPayoutRate((rate.payoutRate * 100).toString());
                            }}
                            className="ml-2 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Assign New Rate */}
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm font-medium text-white/60 mb-2">
                    {selectedPG ? 'Update Rate' : 'Assign New Rate'}
                  </h4>
                  
                  <div className="space-y-3">
                    <select
                      value={selectedPG}
                      onChange={(e) => {
                        setSelectedPG(e.target.value);
                        const pg = availablePGs.find((p: any) => p.id === e.target.value);
                        if (pg) {
                          const existingRate = userRates.find((r: any) => r.paymentGateway.id === e.target.value);
                          if (existingRate) {
                            setPayinRate((existingRate.payinRate * 100).toString());
                            setPayoutRate((existingRate.payoutRate * 100).toString());
                          } else {
                            setPayinRate((pg.minPayinRate * 100).toString());
                            setPayoutRate((pg.minPayoutRate * 100).toString());
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="">Select Payment Gateway</option>
                      {availablePGs.map((pg: any) => (
                        <option key={pg.id} value={pg.id}>
                          {pg.name} (Base: {(pg.minPayinRate * 100).toFixed(2)}%)
                        </option>
                      ))}
                    </select>
                    
                    {selectedPG && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-white/60 mb-1">Payin Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={payinRate}
                              onChange={(e) => setPayinRate(e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/60 mb-1">Payout Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={payoutRate}
                              onChange={(e) => setPayoutRate(e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                        
                        <button
                          onClick={handleAssignRate}
                          disabled={assignRateMutation.isPending}
                          className="w-full py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors text-sm"
                        >
                          {assignRateMutation.isPending ? 'Saving...' : 'Save Rate'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Permissions Tab */}
            {activeTab === 'permissions' && canAssignRates && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">User Permissions</h3>
                
                <div className="grid gap-3">
                  {[
                    { key: 'canCreateUsers', label: 'Create Users' },
                    { key: 'canManageWallet', label: 'Manage Wallet' },
                    { key: 'canTransferWallet', label: 'Transfer Wallet' },
                    { key: 'canViewReports', label: 'View Reports' },
                    { key: 'canViewTransactions', label: 'View Transactions' },
                    { key: 'canInitiatePayin', label: 'Initiate Payin' },
                    { key: 'canInitiatePayout', label: 'Initiate Payout' },
                    { key: 'canAssignRates', label: 'Assign Rates' },
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={permissions[perm.key as keyof typeof permissions]}
                        onChange={(e) => setPermissions({ ...permissions, [perm.key]: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary-500"
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
                
                <button
                  onClick={handleSavePermissions}
                  disabled={updatePermissionsMutation.isPending}
                  className="w-full py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors text-sm"
                >
                  {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

