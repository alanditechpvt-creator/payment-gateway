'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, pgApi, rateApi, schemaApi, ledgerApi } from '@/lib/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  CurrencyRupeeIcon,
  PhotoIcon,
  IdentificationIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  WalletIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { walletApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

// Helper to get correct image URL - backend returns just filename
const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  // Always use /uploads/ since all files are in uploads folder
  return `${API_URL}/uploads/${path}`;
};

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<'details' | 'kyc' | 'wallet' | 'ledger' | 'rates' | 'permissions'>('details');
  const [selectedPG, setSelectedPG] = useState('');
  const [payinRate, setPayinRate] = useState('');
  const [payoutRate, setPayoutRate] = useState('');
  
  // Wallet state
  const [walletAmount, setWalletAmount] = useState('');
  const [walletDescription, setWalletDescription] = useState('');
  
  // Ledger state
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerFilter, setLedgerFilter] = useState('');
  
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
  });
  
  // Fetch user's rates
  const { data: userRatesData, refetch: refetchRates } = useQuery({
    queryKey: ['user-rates-detail', userId],
    queryFn: async () => {
      const childrenRates = await rateApi.getChildrenRates();
      const userData = childrenRates.data?.data?.find((c: any) => c.id === userId);
      return userData;
    },
    enabled: !!userId,
  });
  
  // Fetch schemas
  const { data: schemasData } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => schemaApi.getSchemas(),
  });
  
  // Fetch user's wallet
  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ['user-wallet', userId],
    queryFn: () => walletApi.getWallet(userId),
    enabled: !!userId,
  });
  
  // Fetch user's ledger
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['user-ledger', userId, ledgerPage, ledgerFilter],
    queryFn: () => ledgerApi.getUserLedger(userId, { page: ledgerPage, limit: 20, type: ledgerFilter || undefined }),
    enabled: !!userId && activeTab === 'ledger',
  });
  
  const user = userData?.data?.data;
  const wallet = walletData?.data?.data;
  const ledger = ledgerData?.data?.data;
  const availablePGs = pgsData?.data?.data || [];
  const userRates = userRatesData?.rates || [];
  const schemas = schemasData?.data?.data || [];
  
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
  
  const updateUserMutation = useMutation({
    mutationFn: (data: any) => userApi.updateUser(userId, data),
    onSuccess: () => {
      toast.success('User updated!');
      refetchUser();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update user');
    },
  });
  
  // Wallet mutations
  const creditMutation = useMutation({
    mutationFn: ({ amount, description }: { amount: number; description: string }) =>
      walletApi.addFunds(userId, amount, description),
    onSuccess: () => {
      toast.success('Funds added successfully!');
      refetchWallet();
      setWalletAmount('');
      setWalletDescription('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add funds');
    },
  });
  
  const debitMutation = useMutation({
    mutationFn: ({ amount, description }: { amount: number; description: string }) =>
      walletApi.deductFunds(userId, amount, description),
    onSuccess: () => {
      toast.success('Funds deducted successfully!');
      refetchWallet();
      setWalletAmount('');
      setWalletDescription('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to deduct funds');
    },
  });
  
  // Permission state
  const [permissions, setPermissions] = useState({
    canCreateUsers: false,
    canManageWallet: false,
    canTransferWallet: false,
    canCreateSchema: false,
    canViewReports: true,
    canManagePG: false,
    canApproveUsers: false,
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
          canCreateSchema: userPerms.canCreateSchema || false,
          canViewReports: userPerms.canViewReports ?? true,
          canManagePG: userPerms.canManagePG || false,
          canApproveUsers: userPerms.canApproveUsers || false,
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
  
  const getVerificationBadge = (status: string) => {
    if (status === 'VERIFIED') {
      return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs">Verified</span>;
    } else if (status === 'REJECTED') {
      return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs">Rejected</span>;
    }
    return <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs">Pending</span>;
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">User Not Found</h2>
          <p className="text-white/50 mb-4">The user you're looking for doesn't exist.</p>
          <Link href="/" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">User Profile</h1>
              <p className="text-sm text-white/50">{user.email}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusBadge(user.status)}`}>
              {user.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - User Card */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sticky top-24"
            >
              {/* Profile Photo */}
              <div className="text-center mb-6">
                {user.profilePhoto ? (
                  <img
                    src={getImageUrl(user.profilePhoto)}
                    alt="Profile"
                    className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-white/10"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-3xl font-bold">
                    {user.firstName?.[0] || user.email[0].toUpperCase()}
                  </div>
                )}
                <h2 className="text-xl font-bold mt-4">
                  {user.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Not Set'}
                </h2>
                <p className="text-white/50">{user.email}</p>
                <span className="inline-block mt-2 px-3 py-1 rounded-lg bg-primary-500/10 text-primary-400 text-sm">
                  {user.role.replace('_', ' ')}
                </span>
              </div>
              
              {/* Quick Info */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-white/70">
                  <PhoneIcon className="w-4 h-4" />
                  <span>{user.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-3 text-white/70">
                  <BuildingOfficeIcon className="w-4 h-4" />
                  <span>{user.businessName || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-3 text-white/70">
                  <ClockIcon className="w-4 h-4" />
                  <span>Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}</span>
                </div>
                {user.lastLoginAt && (
                  <div className="flex items-center gap-3 text-white/70">
                    <ClockIcon className="w-4 h-4" />
                    <span>Last login {format(new Date(user.lastLoginAt), 'MMM d, yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              {(user.status === 'PENDING_APPROVAL' || user.status === 'PENDING_ONBOARDING') && (
                <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                  <button
                    onClick={() => approveMutation.mutate({ approved: true })}
                    disabled={approveMutation.isPending}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    Approve User
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ approved: false, reason: 'Documents not verified' })}
                    disabled={approveMutation.isPending}
                    className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircleIcon className="w-5 h-5" />
                    Reject User
                  </button>
                </div>
              )}
            </motion.div>
          </div>
          
          {/* Right Column - Tabs */}
          <div className="lg:col-span-2">
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                { id: 'details', label: 'Details', icon: UserCircleIcon },
                { id: 'kyc', label: 'KYC Documents', icon: IdentificationIcon },
                { id: 'wallet', label: 'Wallet', icon: WalletIcon },
                { id: 'ledger', label: 'Ledger', icon: BookOpenIcon },
                { id: 'rates', label: 'Rate Assignment', icon: CurrencyRupeeIcon },
                { id: 'permissions', label: 'Permissions', icon: ShieldCheckIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
            >
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">User Information</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-white/60 mb-2">First Name</label>
                      <p className="px-4 py-3 bg-white/5 rounded-xl">{user.firstName || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Last Name</label>
                      <p className="px-4 py-3 bg-white/5 rounded-xl">{user.lastName || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Email</label>
                      <p className="px-4 py-3 bg-white/5 rounded-xl flex items-center gap-2">
                        {user.email}
                        {user.emailVerified && <CheckCircleIcon className="w-4 h-4 text-emerald-400" />}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Phone</label>
                      <p className="px-4 py-3 bg-white/5 rounded-xl">{user.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Business Name</label>
                      <p className="px-4 py-3 bg-white/5 rounded-xl">{user.businessName || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Role</label>
                      <p className="px-4 py-3 bg-white/5 rounded-xl">{user.role.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Schema/Plan</label>
                      <div className="flex gap-2">
                        <select
                          value={user.schemaId || ''}
                          onChange={async (e) => {
                            if (!e.target.value || e.target.value === user.schemaId) return;
                            try {
                              await schemaApi.assignToUser(e.target.value, userId);
                              toast.success('Schema changed successfully!');
                              refetchUser();
                            } catch (error: any) {
                              toast.error(error.response?.data?.error || 'Failed to change schema');
                            }
                          }}
                          className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                        >
                          <option value="">Select Schema</option>
                          {schemas.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code}) {s.id === user.schemaId ? '✓ Current' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        Current: {user.schema?.name || 'No schema'} • Changing schema migrates user to new plan
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Parent User</label>
                      <p className="px-4 py-3 bg-white/5 rounded-xl">
                        {user.parent ? `${user.parent.firstName || ''} ${user.parent.lastName || ''} (${user.parent.email})` : 'Admin'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* KYC Tab */}
              {activeTab === 'kyc' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">KYC Documents</h3>
                  
                  {/* PAN Card */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <CreditCardIcon className="w-6 h-6 text-blue-400" />
                        <div>
                          <h4 className="font-medium">PAN Card</h4>
                          <p className="text-sm text-white/50">{user.panNumber || 'Not provided'}</p>
                        </div>
                      </div>
                      {getVerificationBadge(user.panVerified)}
                    </div>
                    
                    {user.panNumber && user.panVerified === 'PENDING' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => updateUserMutation.mutate({ panVerified: 'VERIFIED' })}
                          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20"
                        >
                          ✓ Verify PAN
                        </button>
                        <button
                          onClick={() => updateUserMutation.mutate({ panVerified: 'REJECTED' })}
                          className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Aadhaar Card */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <IdentificationIcon className="w-6 h-6 text-purple-400" />
                        <div>
                          <h4 className="font-medium">Aadhaar Card</h4>
                          <p className="text-sm text-white/50">
                            {user.aadhaarNumber ? `XXXX XXXX ${user.aadhaarNumber.slice(-4)}` : 'Not provided'}
                          </p>
                        </div>
                      </div>
                      {getVerificationBadge(user.aadhaarVerified)}
                    </div>
                    
                    {/* Aadhaar Images */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-white/50 mb-2">Front Side</p>
                        {user.aadhaarFront ? (
                          <a
                            href={getImageUrl(user.aadhaarFront)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={getImageUrl(user.aadhaarFront)}
                              alt="Aadhaar Front"
                              className="w-full h-40 object-cover rounded-lg border border-white/10 hover:border-primary-500 transition-colors"
                            />
                          </a>
                        ) : (
                          <div className="w-full h-40 bg-white/5 rounded-lg flex items-center justify-center text-white/30">
                            <PhotoIcon className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-white/50 mb-2">Back Side</p>
                        {user.aadhaarBack ? (
                          <a
                            href={getImageUrl(user.aadhaarBack)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={getImageUrl(user.aadhaarBack)}
                              alt="Aadhaar Back"
                              className="w-full h-40 object-cover rounded-lg border border-white/10 hover:border-primary-500 transition-colors"
                            />
                          </a>
                        ) : (
                          <div className="w-full h-40 bg-white/5 rounded-lg flex items-center justify-center text-white/30">
                            <PhotoIcon className="w-12 h-12" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {user.aadhaarNumber && user.aadhaarVerified === 'PENDING' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => updateUserMutation.mutate({ aadhaarVerified: 'VERIFIED' })}
                          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20"
                        >
                          ✓ Verify Aadhaar
                        </button>
                        <button
                          onClick={() => updateUserMutation.mutate({ aadhaarVerified: 'REJECTED' })}
                          className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Email Verification */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <EnvelopeIcon className="w-6 h-6 text-cyan-400" />
                        <div>
                          <h4 className="font-medium">Email Verification</h4>
                          <p className="text-sm text-white/50">{user.email}</p>
                        </div>
                      </div>
                      {user.emailVerified ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs">Verified</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs">Not Verified</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Wallet Tab */}
              {activeTab === 'wallet' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Wallet Management</h3>
                  
                  {/* Wallet Balance */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-xl p-6 border border-emerald-500/20">
                      <div className="flex items-center gap-3 mb-2">
                        <WalletIcon className="w-6 h-6 text-emerald-400" />
                        <span className="text-white/60">Available Balance</span>
                      </div>
                      <p className="text-3xl font-bold text-emerald-400">
                        ₹{Number(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 rounded-xl p-6 border border-amber-500/20">
                      <div className="flex items-center gap-3 mb-2">
                        <ClockIcon className="w-6 h-6 text-amber-400" />
                        <span className="text-white/60">Hold Balance</span>
                      </div>
                      <p className="text-3xl font-bold text-amber-400">
                        ₹{Number(wallet?.holdBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Credit/Debit Form */}
                  <div className="pt-6 border-t border-white/10">
                    <h4 className="font-medium mb-4">Add or Deduct Funds</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-white/60 mb-2">Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={walletAmount}
                          onChange={(e) => setWalletAmount(e.target.value)}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-white/60 mb-2">Description / Reason</label>
                        <input
                          type="text"
                          value={walletDescription}
                          onChange={(e) => setWalletDescription(e.target.value)}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          placeholder="Enter reason for transaction..."
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <button
                          onClick={() => {
                            const amount = parseFloat(walletAmount);
                            if (!amount || amount <= 0) {
                              toast.error('Please enter a valid amount');
                              return;
                            }
                            creditMutation.mutate({ amount, description: walletDescription || 'Admin credit' });
                          }}
                          disabled={creditMutation.isPending || !walletAmount}
                          className="py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowDownIcon className="w-5 h-5" />
                          {creditMutation.isPending ? 'Adding...' : 'Add Funds (Credit)'}
                        </button>
                        
                        <button
                          onClick={() => {
                            const amount = parseFloat(walletAmount);
                            if (!amount || amount <= 0) {
                              toast.error('Please enter a valid amount');
                              return;
                            }
                            if (amount > Number(wallet?.balance || 0)) {
                              toast.error('Amount exceeds available balance');
                              return;
                            }
                            debitMutation.mutate({ amount, description: walletDescription || 'Admin debit' });
                          }}
                          disabled={debitMutation.isPending || !walletAmount}
                          className="py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowUpIcon className="w-5 h-5" />
                          {debitMutation.isPending ? 'Deducting...' : 'Deduct Funds (Debit)'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Ledger Tab */}
              {activeTab === 'ledger' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Transaction Ledger</h3>
                    <select
                      value={ledgerFilter}
                      onChange={(e) => { setLedgerFilter(e.target.value); setLedgerPage(1); }}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                    >
                      <option value="">All Types</option>
                      <option value="CREDIT">Credit</option>
                      <option value="DEBIT">Debit</option>
                      <option value="COMMISSION">Commission</option>
                      <option value="TRANSFER_IN">Transfer In</option>
                      <option value="TRANSFER_OUT">Transfer Out</option>
                      <option value="REFUND">Refund</option>
                    </select>
                  </div>
                  
                  {/* Summary */}
                  {ledger?.summary && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-white/50">Opening</p>
                        <p className="font-semibold">₹{Number(ledger.summary.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-emerald-500/10 rounded-lg p-3">
                        <p className="text-xs text-emerald-400">Credits</p>
                        <p className="font-semibold text-emerald-400">+₹{Number(ledger.summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-3">
                        <p className="text-xs text-red-400">Debits</p>
                        <p className="font-semibold text-red-400">-₹{Number(ledger.summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-primary-500/10 rounded-lg p-3">
                        <p className="text-xs text-primary-400">Closing</p>
                        <p className="font-semibold text-primary-400">₹{Number(ledger.summary.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Ledger Table */}
                  {ledgerLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                    </div>
                  ) : !ledger?.entries?.length ? (
                    <div className="text-center py-12 text-white/40">
                      <BookOpenIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No ledger entries found</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-white/5">
                            <tr className="text-left text-white/50">
                              <th className="px-4 py-3 font-medium">Date</th>
                              <th className="px-4 py-3 font-medium">Type</th>
                              <th className="px-4 py-3 font-medium">Description</th>
                              <th className="px-4 py-3 font-medium text-right">Debit</th>
                              <th className="px-4 py-3 font-medium text-right">Credit</th>
                              <th className="px-4 py-3 font-medium text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {ledger.entries.map((entry: any) => (
                              <tr key={entry.id} className="hover:bg-white/5">
                                <td className="px-4 py-3">
                                  <p>{format(new Date(entry.date), 'MMM d, yyyy')}</p>
                                  <p className="text-xs text-white/40">{format(new Date(entry.date), 'HH:mm')}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    entry.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-400' :
                                    entry.type === 'DEBIT' ? 'bg-red-500/10 text-red-400' :
                                    entry.type === 'COMMISSION' ? 'bg-purple-500/10 text-purple-400' :
                                    entry.type.includes('TRANSFER') ? 'bg-blue-500/10 text-blue-400' :
                                    'bg-white/10 text-white/60'
                                  }`}>
                                    {entry.type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm">{entry.description}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {entry.debit > 0 ? (
                                    <span className="text-red-400">-₹{entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  ) : <span className="text-white/30">-</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {entry.credit > 0 ? (
                                    <span className="text-emerald-400">+₹{entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  ) : <span className="text-white/30">-</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                  ₹{entry.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Pagination */}
                      {ledger.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <p className="text-sm text-white/50">
                            Page {ledgerPage} of {ledger.pagination.totalPages} ({ledger.pagination.total} entries)
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                              disabled={ledgerPage === 1}
                              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50"
                            >
                              <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setLedgerPage(p => Math.min(ledger.pagination.totalPages, p + 1))}
                              disabled={ledgerPage === ledger.pagination.totalPages}
                              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50"
                            >
                              <ChevronRightIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Rates Tab */}
              {activeTab === 'rates' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Rate Assignment</h3>
                  <p className="text-white/50 text-sm">
                    Assign payment gateway rates to this user. They will be charged these rates for transactions.
                  </p>
                  
                  {/* Current Rates */}
                  <div>
                    <h4 className="font-medium mb-3">Current Assigned Rates</h4>
                    {userRates.length === 0 ? (
                      <div className="text-center py-6 bg-white/5 rounded-xl text-white/50">
                        No rates assigned yet.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {userRates.map((rate: any) => (
                          <div
                            key={rate.id}
                            className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10"
                          >
                            <div>
                              <p className="font-medium">{rate.paymentGateway.name}</p>
                              <p className="text-sm text-white/50">{rate.paymentGateway.code}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-400 font-mono">Payin: {(rate.payinRate * 100).toFixed(2)}%</p>
                              <p className="text-blue-400 font-mono text-sm">Payout: {(rate.payoutRate * 100).toFixed(2)}%</p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPG(rate.paymentGateway.id);
                                setPayinRate((rate.payinRate * 100).toString());
                                setPayoutRate((rate.payoutRate * 100).toString());
                              }}
                              className="ml-4 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20"
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
                    <h4 className="font-medium mb-3">{selectedPG ? 'Update Rate' : 'Assign New Rate'}</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-white/60 mb-2">Payment Gateway</label>
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
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                        >
                          <option value="">Select Payment Gateway</option>
                          {availablePGs.map((pg: any) => (
                            <option key={pg.id} value={pg.id}>
                              {pg.name} (Base: {(pg.minPayinRate * 100).toFixed(2)}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedPG && (
                        <>
                          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-sm">
                            <p className="text-emerald-400">
                              PG Base Rate: {(availablePGs.find((p: any) => p.id === selectedPG)?.minPayinRate * 100 || 0).toFixed(2)}%
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/60 mb-2">Payin Rate (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={payinRate}
                                onChange={(e) => setPayinRate(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-white/60 mb-2">Payout Rate (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={payoutRate}
                                onChange={(e) => setPayoutRate(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                              />
                            </div>
                          </div>
                          
                          <button
                            onClick={handleAssignRate}
                            disabled={assignRateMutation.isPending}
                            className="w-full py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
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
              {activeTab === 'permissions' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">User Permissions</h3>
                  <p className="text-white/50 text-sm">
                    Control what this user can do in the system.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { key: 'canCreateUsers', label: 'Create Users', description: 'Create downstream users' },
                      { key: 'canManageWallet', label: 'Manage Wallet', description: 'Add/deduct wallet funds' },
                      { key: 'canTransferWallet', label: 'Transfer Wallet', description: 'Transfer funds to other users' },
                      { key: 'canCreateSchema', label: 'Create Schema', description: 'Create new schemas/plans' },
                      { key: 'canViewReports', label: 'View Reports', description: 'Access reports and analytics' },
                      { key: 'canManagePG', label: 'Manage PG', description: 'Manage payment gateways' },
                      { key: 'canApproveUsers', label: 'Approve Users', description: 'Approve/reject new users' },
                      { key: 'canViewTransactions', label: 'View Transactions', description: 'View transaction history' },
                      { key: 'canInitiatePayin', label: 'Initiate Payin', description: 'Create payin transactions' },
                      { key: 'canInitiatePayout', label: 'Initiate Payout', description: 'Create payout transactions' },
                      { key: 'canAssignRates', label: 'Assign Rates', description: 'Assign rates to downstream' },
                    ].map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={permissions[perm.key as keyof typeof permissions]}
                          onChange={(e) => setPermissions({ ...permissions, [perm.key]: e.target.checked })}
                          className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
                        />
                        <div>
                          <p className="font-medium">{perm.label}</p>
                          <p className="text-sm text-white/50">{perm.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleSavePermissions}
                    disabled={updatePermissionsMutation.isPending}
                    className="w-full py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
                  >
                    {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

