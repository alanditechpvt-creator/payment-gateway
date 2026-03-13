'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { userApi, rateApi, walletApi, ledgerApi, schemaApi } from '@/lib/api';
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
  IdentificationIcon,
  DocumentTextIcon,
  CreditCardIcon,
  PhotoIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  return `${API_URL}/uploads/${path}`;
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const userId = params.id as string;

  const [activeTab, setActiveTab] = useState<'details' | 'kyc' | 'wallet' | 'ledger' | 'rates' | 'permissions'>('details');
  const [selectedPG, setSelectedPG] = useState('');
  const [payinRate, setPayinRate] = useState('');
  const [payoutRate, setPayoutRate] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', businessName: '' });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerFilter, setLedgerFilter] = useState('');

  const currentUserPerms = Array.isArray(currentUser?.permissions) ? currentUser?.permissions[0] : currentUser?.permissions;
  const canAssignRates =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'WHITE_LABEL' ||
    currentUser?.role === 'MASTER_DISTRIBUTOR' ||
    !!currentUserPerms?.canAssignRates;
  const canTransferWallet = currentUser?.role === 'ADMIN' || !!currentUserPerms?.canTransferWallet;
  const canViewLedger =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'WHITE_LABEL' ||
    currentUser?.role === 'MASTER_DISTRIBUTOR';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const { data: userData, isLoading, error: userError, refetch: refetchUser } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => userApi.getUserById(userId),
    enabled: !!userId,
    retry: (_, err: any) => err?.response?.status !== 403,
  });

  useEffect(() => {
    if (userError && (userError as any)?.response?.status === 403) {
      setAccessDenied(true);
    }
  }, [userError]);

  const { data: pgsData } = useQuery({
    queryKey: ['available-pgs-for-assignment'],
    queryFn: () => rateApi.getAvailablePGsForAssignment(),
    enabled: !!userId && canAssignRates,
  });

  const { data: userRatesData, refetch: refetchRates } = useQuery({
    queryKey: ['user-rates-detail', userId],
    queryFn: async () => {
      const res = await rateApi.getChildrenRates();
      const list = res.data?.data;
      return Array.isArray(list) ? list.find((c: any) => c.id === userId) : null;
    },
    enabled: !!userId && canAssignRates,
  });

  const { data: schemasData } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => schemaApi.getSchemas(),
    enabled: !!userId && canAssignRates,
  });

  const { data: userWalletData, refetch: refetchUserWallet } = useQuery({
    queryKey: ['user-wallet', userId],
    queryFn: () => walletApi.getWallet(userId),
    enabled: !!userId,
  });

  const { data: myWalletData, refetch: refetchMyWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => walletApi.getWallet(),
    enabled: !!userId && canTransferWallet,
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['user-ledger', userId, ledgerPage, ledgerFilter],
    queryFn: () => ledgerApi.getUserLedger(userId, { page: ledgerPage, limit: 20, type: ledgerFilter || undefined }),
    enabled: !!userId && canViewLedger && activeTab === 'ledger',
  });

  const user = userData?.data?.data;
  const availablePGs = pgsData?.data?.data || [];
  const userRates = userRatesData?.rates || [];
  const schemas = schemasData?.data?.data || [];
  const userWallet = userWalletData?.data?.data;
  const myWallet = myWalletData?.data?.data;
  const ledger = ledgerData?.data?.data;
  
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
    mutationFn: ({ pgId, payinRate, payoutRate }: { pgId: string; payinRate?: number; payoutRate?: number }) =>
      rateApi.assignRate(userId, pgId, payinRate, payoutRate),
    onSuccess: () => {
      toast.success(isAdmin ? 'Payment gateway assigned. Rates from schema.' : 'Rate assigned!');
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

  const updateUserMutation = useMutation({
    mutationFn: (data: any) => userApi.updateUser(userId, data),
    onSuccess: () => {
      toast.success('User updated!');
      refetchUser();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update user'),
  });

  const removePGMutation = useMutation({
    mutationFn: ({ pgId }: { pgId: string }) => userApi.removePGAssignment(userId, pgId),
    onSuccess: () => {
      toast.success('Payment gateway removed.');
      refetchRates();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to remove gateway'),
  });

  const resendOnboardingMutation = useMutation({
    mutationFn: () => userApi.resendOnboardingEmail(userId),
    onSuccess: () => toast.success('Onboarding email sent.'),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to send email'),
  });

  useEffect(() => {
    if (user?.permissions) {
      const userPerms = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;
      if (userPerms) {
        setPermissions({
          canCreateUsers: !!userPerms.canCreateUsers,
          canManageWallet: !!userPerms.canManageWallet,
          canTransferWallet: !!userPerms.canTransferWallet,
          canCreateSchema: !!userPerms.canCreateSchema,
          canViewReports: userPerms.canViewReports ?? true,
          canManagePG: !!userPerms.canManagePG,
          canApproveUsers: !!userPerms.canApproveUsers,
          canViewTransactions: userPerms.canViewTransactions ?? true,
          canInitiatePayin: !!userPerms.canInitiatePayin,
          canInitiatePayout: !!userPerms.canInitiatePayout,
          canAssignRates: !!userPerms.canAssignRates,
        });
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setEditForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        businessName: user.businessName || '',
      });
    }
  }, [user]);

  const canEditUser =
    currentUser?.id === userId ||
    isAdmin ||
    (user?.parentId && user.parentId === currentUser?.id);

  const handleEditToggle = () => {
    if (isEditMode) {
      setEditForm({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        businessName: user?.businessName || '',
      });
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveUserDetails = () => {
    if (!editForm.email?.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    updateUserMutation.mutate(editForm, { onSuccess: () => setIsEditMode(false) });
  };

  const handleAssignRate = () => {
    if (!selectedPG) {
      toast.error('Please select a payment gateway');
      return;
    }
    // When user has a schema, rates come from schema – assign PG only (no payin/payout inputs)
    if (isAdmin || user?.schemaId) {
      assignRateMutation.mutate({ pgId: selectedPG });
      return;
    }
    const pg = availablePGs.find((p: any) => p.id === selectedPG);
    if (!pg) return;
    const payinRateNum = parseFloat(payinRate) / 100;
    const payoutRateNum = parseFloat(payoutRate) / 100;
    if (payinRateNum < (pg.minPayinRate ?? 0)) {
      toast.error('Payin rate is below the minimum allowed for this gateway.');
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

  const getVerificationBadge = (status: string) => {
    if (status === 'VERIFIED') return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs">Verified</span>;
    if (status === 'REJECTED') return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs">Rejected</span>;
    return <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs">Pending</span>;
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

  if (accessDenied || (!user && !isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            {accessDenied ? 'Access Denied' : 'User Not Found'}
          </h2>
          <p className="text-white/50 mb-4">
            {accessDenied
              ? 'You do not have permission to view this user. Access is restricted by hierarchy.'
              : "The user you're looking for doesn't exist or you don't have access."}
          </p>
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
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {[
              { id: 'details', label: 'Details', icon: UserCircleIcon },
              { id: 'kyc', label: 'KYC Documents', icon: IdentificationIcon },
              ...(canTransferWallet ? [{ id: 'wallet', label: 'Wallet', icon: WalletIcon }] : []),
              ...(canViewLedger ? [{ id: 'ledger', label: 'Ledger', icon: BookOpenIcon }] : []),
              ...(canAssignRates ? [{ id: 'rates', label: 'Rate Assignment', icon: CurrencyRupeeIcon }] : []),
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
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">User Information</h3>
                  <div className="flex gap-2">
                    {user.status === 'PENDING_ONBOARDING' && (
                      <button
                        onClick={() => resendOnboardingMutation.mutate()}
                        disabled={resendOnboardingMutation.isPending}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm"
                      >
                        <PaperAirplaneIcon className="w-4 h-4" />
                        {resendOnboardingMutation.isPending ? 'Sending...' : 'Resend Onboarding Email'}
                      </button>
                    )}
                    {canEditUser && (
                      isEditMode ? (
                        <>
                          <button onClick={handleSaveUserDetails} disabled={updateUserMutation.isPending} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2 text-sm">
                            <CheckCircleIcon className="w-4 h-4" /> Save
                          </button>
                          <button onClick={handleEditToggle} className="px-4 py-2 bg-white/5 text-white/70 rounded-lg hover:bg-white/10 flex items-center gap-2 text-sm">
                            <XMarkIcon className="w-4 h-4" /> Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={handleEditToggle} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 text-sm">
                          <PencilIcon className="w-4 h-4" /> Edit Details
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">First Name</label>
                    {isEditMode ? (
                      <input type="text" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                    ) : (
                      <p className="px-3 py-2 bg-white/5 rounded-lg">{user.firstName || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Last Name</label>
                    {isEditMode ? (
                      <input type="text" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                    ) : (
                      <p className="px-3 py-2 bg-white/5 rounded-lg">{user.lastName || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Email</label>
                    {isEditMode ? (
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                    ) : (
                      <p className="px-3 py-2 bg-white/5 rounded-lg flex items-center gap-2">
                        {user.email}
                        {user.emailVerified && <CheckCircleIcon className="w-4 h-4 text-emerald-400" />}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Phone</label>
                    {isEditMode ? (
                      <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                    ) : (
                      <p className="px-3 py-2 bg-white/5 rounded-lg">{user.phone || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Business Name</label>
                    {isEditMode ? (
                      <input type="text" value={editForm.businessName} onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                    ) : (
                      <p className="px-3 py-2 bg-white/5 rounded-lg">{user.businessName || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Role</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">{user.role.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Schema/Plan</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">{user.schema?.name || 'None'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Parent</label>
                    <p className="px-3 py-2 bg-white/5 rounded-lg">
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
                </div>
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
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-white/50 mb-2">Front</p>
                      {user.aadhaarFront ? (
                        <a href={getImageUrl(user.aadhaarFront)} target="_blank" rel="noopener noreferrer">
                          <img src={getImageUrl(user.aadhaarFront)} alt="Aadhaar Front" className="w-full h-40 object-cover rounded-lg border border-white/10 hover:border-primary-500" />
                        </a>
                      ) : (
                        <div className="w-full h-40 bg-white/5 rounded-lg flex items-center justify-center text-white/30">
                          <PhotoIcon className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white/50 mb-2">Back</p>
                      {user.aadhaarBack ? (
                        <a href={getImageUrl(user.aadhaarBack)} target="_blank" rel="noopener noreferrer">
                          <img src={getImageUrl(user.aadhaarBack)} alt="Aadhaar Back" className="w-full h-40 object-cover rounded-lg border border-white/10 hover:border-primary-500" />
                        </a>
                      ) : (
                        <div className="w-full h-40 bg-white/5 rounded-lg flex items-center justify-center text-white/30">
                          <PhotoIcon className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <EnvelopeIcon className="w-6 h-6 text-cyan-400" />
                      <div>
                        <h4 className="font-medium">Email Verification</h4>
                        <p className="text-sm text-white/50">{user.email}</p>
                      </div>
                    </div>
                    {user.emailVerified ? <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs">Verified</span> : <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs">Not Verified</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Ledger Tab */}
            {activeTab === 'ledger' && canViewLedger && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Transaction Ledger</h3>
                  <select value={ledgerFilter} onChange={(e) => { setLedgerFilter(e.target.value); setLedgerPage(1); }} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white">
                    <option value="">All Types</option>
                    <option value="CREDIT">Credit</option>
                    <option value="DEBIT">Debit</option>
                    <option value="COMMISSION">Commission</option>
                    <option value="TRANSFER_IN">Transfer In</option>
                    <option value="TRANSFER_OUT">Transfer Out</option>
                    <option value="REFUND">Refund</option>
                  </select>
                </div>
                {ledger?.summary && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-lg p-3"><p className="text-xs text-white/50">Opening</p><p className="font-semibold">₹{Number(ledger.summary.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
                    <div className="bg-emerald-500/10 rounded-lg p-3"><p className="text-xs text-emerald-400">Credits</p><p className="font-semibold text-emerald-400">+₹{Number(ledger.summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
                    <div className="bg-red-500/10 rounded-lg p-3"><p className="text-xs text-red-400">Debits</p><p className="font-semibold text-red-400">-₹{Number(ledger.summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
                    <div className="bg-primary-500/10 rounded-lg p-3"><p className="text-xs text-primary-400">Closing</p><p className="font-semibold text-primary-400">₹{Number(ledger.summary.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
                  </div>
                )}
                {ledgerLoading ? (
                  <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" /></div>
                ) : !ledger?.entries?.length ? (
                  <div className="text-center py-12 text-white/40"><BookOpenIcon className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No ledger entries</p></div>
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
                              <td className="px-4 py-3"><p>{format(new Date(entry.date), 'MMM d, yyyy')}</p><p className="text-xs text-white/40">{format(new Date(entry.date), 'HH:mm')}</p></td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${entry.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-400' : entry.type === 'DEBIT' ? 'bg-red-500/10 text-red-400' : entry.type === 'COMMISSION' ? 'bg-purple-500/10 text-purple-400' : 'bg-white/10 text-white/60'}`}>{entry.type.replace('_', ' ')}</span></td>
                              <td className="px-4 py-3 text-sm">{entry.description}</td>
                              <td className="px-4 py-3 text-right">{entry.debit > 0 ? <span className="text-red-400">-₹{entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> : <span className="text-white/30">-</span>}</td>
                              <td className="px-4 py-3 text-right">{entry.credit > 0 ? <span className="text-emerald-400">+₹{entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> : <span className="text-white/30">-</span>}</td>
                              <td className="px-4 py-3 text-right font-medium">₹{entry.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {ledger.pagination?.totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <p className="text-sm text-white/50">Page {ledgerPage} of {ledger.pagination.totalPages} ({ledger.pagination.total} entries)</p>
                        <div className="flex gap-2">
                          <button onClick={() => setLedgerPage((p) => Math.max(1, p - 1))} disabled={ledgerPage === 1} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50"><ChevronLeftIcon className="w-4 h-4" /></button>
                          <button onClick={() => setLedgerPage((p) => Math.min(ledger.pagination.totalPages, p + 1))} disabled={ledgerPage === ledger.pagination.totalPages} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50"><ChevronRightIcon className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
            
            {/* Rates Tab - like admin: schema + assign/remove PG */}
            {activeTab === 'rates' && canAssignRates && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Rate Assignment</h3>
                <p className="text-white/50 text-sm">
                  {isAdmin ? "Rates are from the user's schema. Assign schema and payment gateways below." : 'Assign payment gateways and rates for your downline.'}
                </p>
                {canAssignRates && schemas.length > 0 && (
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="font-medium mb-2">Schema / Plan</h4>
                    <select
                      value={user?.schemaId || ''}
                      onChange={async (e) => {
                        const schemaId = e.target.value;
                        if (!schemaId || schemaId === user?.schemaId) return;
                        try {
                          await schemaApi.assignToUser(schemaId, userId);
                          toast.success('Schema updated.');
                          refetchUser();
                        } catch (err: any) {
                          toast.error(err?.response?.data?.error || 'Failed to change schema');
                        }
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                    >
                      <option value="">Select schema</option>
                      {schemas.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code}) {s.id === user?.schemaId ? '✓' : ''}</option>
                      ))}
                    </select>
                    <p className="text-xs text-white/40 mt-2">Commission and rates follow this schema.</p>
                  </div>
                )}
                <div>
                  <h4 className="font-medium mb-3">Payment gateways</h4>
                  {!userRates?.length ? (
                    <div className="text-center py-6 bg-white/5 rounded-xl text-white/50 text-sm">No payment gateways assigned. Assign one below.</div>
                  ) : (
                    <div className="grid gap-3">
                      {userRates.map((rate: any) => (
                        <div key={rate.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                          <div>
                            <p className="font-medium">{rate.paymentGateway?.name}</p>
                            <p className="text-sm text-white/50">
                              {rate.paymentGateway?.code}
                              {user?.schema?.name && <span className="text-white/40"> · Rates from schema {user.schema.name}</span>}
                              {!user?.schemaId && rate.payinRate != null && <span> · Payin {(rate.payinRate * 100).toFixed(2)}%</span>}
                            </p>
                          </div>
                          <button
                            onClick={() => { if (confirm(`Remove ${rate.paymentGateway?.name}?`)) removePGMutation.mutate({ pgId: rate.paymentGateway.id }); }}
                            disabled={removePGMutation.isPending}
                            className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20 flex items-center gap-1"
                          >
                            <TrashIcon className="w-4 h-4" /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t border-white/10">
                  <h4 className="font-medium mb-3">Assign payment gateway</h4>
                  {(isAdmin || user?.schemaId) && (
                    <p className="text-sm text-white/50 mb-3">Rates are taken from the user&apos;s schema. No need to enter payin/payout here.</p>
                  )}
                  {!isAdmin && !user?.schemaId && (
                    <p className="text-sm text-white/50 mb-3">Enter payin (and payout if allowed) rate as percentage.</p>
                  )}
                  <div className="space-y-4">
                    <select
                      value={selectedPG}
                      onChange={(e) => {
                        setSelectedPG(e.target.value);
                        const existing = userRates?.find((r: any) => r.paymentGateway?.id === e.target.value);
                        if (existing) {
                          setPayinRate((existing.payinRate * 100).toFixed(2));
                          setPayoutRate((existing.payoutRate * 100).toFixed(2));
                        } else {
                          setPayinRate('');
                          setPayoutRate('');
                        }
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                    >
                      <option value="">Select Payment Gateway</option>
                      {availablePGs.map((pg: any) => (
                        <option key={pg.id} value={pg.id}>{pg.name}</option>
                      ))}
                    </select>
                    {selectedPG && !isAdmin && !user?.schemaId && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-white/60 mb-1">Payin Rate (%)</label>
                          <input type="number" step="0.01" value={payinRate} onChange={(e) => setPayinRate(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-white/60 mb-1">Payout Rate (%)</label>
                          <input type="number" step="0.01" value={payoutRate} onChange={(e) => setPayoutRate(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                        </div>
                      </div>
                    )}
                    {selectedPG && (
                      <button onClick={handleAssignRate} disabled={assignRateMutation.isPending} className="w-full py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600">
                        {assignRateMutation.isPending ? 'Assigning...' : (isAdmin || user?.schemaId) ? 'Assign gateway' : 'Save rate'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {activeTab === 'permissions' && canAssignRates && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">User Permissions</h3>
                <p className="text-white/50 text-sm">Control what this user can do.</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { key: 'canCreateUsers', label: 'Create Users', desc: 'Create downstream users' },
                    { key: 'canManageWallet', label: 'Manage Wallet', desc: 'Add/deduct wallet funds' },
                    { key: 'canTransferWallet', label: 'Transfer Wallet', desc: 'Transfer funds to others' },
                    { key: 'canCreateSchema', label: 'Create Schema', desc: 'Create new schemas/plans' },
                    { key: 'canViewReports', label: 'View Reports', desc: 'Access reports' },
                    { key: 'canManagePG', label: 'Manage PG', desc: 'Manage payment gateways' },
                    { key: 'canApproveUsers', label: 'Approve Users', desc: 'Approve/reject new users' },
                    { key: 'canViewTransactions', label: 'View Transactions', desc: 'View transaction history' },
                    { key: 'canInitiatePayin', label: 'Initiate Payin', desc: 'Create payin transactions' },
                    { key: 'canInitiatePayout', label: 'Initiate Payout', desc: 'Create payout transactions' },
                    { key: 'canAssignRates', label: 'Assign Rates', desc: 'Assign rates to downstream' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={!!permissions[perm.key as keyof typeof permissions]}
                        onChange={(e) => setPermissions({ ...permissions, [perm.key]: e.target.checked })}
                        className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-primary-500"
                      />
                      <div>
                        <p className="font-medium">{perm.label}</p>
                        <p className="text-sm text-white/50">{perm.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={handleSavePermissions} disabled={updatePermissionsMutation.isPending} className="w-full py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600">
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

