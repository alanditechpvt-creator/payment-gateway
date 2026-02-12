'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, transactionApi, pgApi, schemaApi, rateApi, announcementApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// API Base URL - use environment variable or default to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';
import {
  UsersIcon,
  CreditCardIcon,
  ChartBarIcon,
  BanknotesIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ArrowLeftOnRectangleIcon,
  MegaphoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  XMarkIcon,
  PlusIcon,
  WalletIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { walletApi, ledgerApi, cardTypeApi } from '@/lib/api';
import ChannelRateManager from './ChannelRateManager';
import PGBaseRateManager from './PGBaseRateManager';

type Tab = 'overview' | 'users' | 'transactions' | 'gateways' | 'cardtypes' | 'schemas' | 'wallet' | 'ledger' | 'announcements' | 'settings';

export function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => transactionApi.getStats(),
  });
  
  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => userApi.getUsers({ limit: 100 }),
  });
  
  const { data: pgs } = useQuery({
    queryKey: ['admin-pgs'],
    queryFn: () => pgApi.getPGs(),
  });
  
  const { data: schemas } = useQuery({
    queryKey: ['admin-schemas'],
    queryFn: () => schemaApi.getSchemas(),
  });
  
  const { data: pendingUsers } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => userApi.getUsers({ status: 'PENDING_APPROVAL', limit: 10 }),
  });
  
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };
  
  const statsData = stats?.data?.data;
  const usersData = users?.data?.data || [];
  const pgsData = pgs?.data?.data || pgs?.data || [];
  const schemasData = schemas?.data?.data || schemas?.data || [];
  const pendingUsersData = pendingUsers?.data?.data || [];
  
  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'users', name: 'Users', icon: UsersIcon },
    { id: 'transactions', name: 'Transactions', icon: DocumentTextIcon },
    { id: 'wallet', name: 'Wallet Management', icon: WalletIcon },
    { id: 'ledger', name: 'Global Ledger', icon: BookOpenIcon },
    { id: 'gateways', name: 'Payment Gateways', icon: CreditCardIcon },
    { id: 'cardtypes', name: 'Card Types', icon: CreditCardIcon },
    { id: 'schemas', name: 'Schemas', icon: ChartBarIcon },
    { id: 'announcements', name: 'Announcements', icon: MegaphoneIcon },
    { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
  ];
  
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#141414] border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold">Admin Panel</h1>
              <p className="text-xs text-white/40">PaymentGateway</p>
            </div>
          </div>
        </div>
        
        {/* Navigation - scrollable if needed */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`sidebar-link w-full ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
        
        {/* User & Sign Out - always visible at bottom */}
        <div className="p-4 border-t border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600/50 to-accent-600/50 flex items-center justify-center font-semibold">
              {user?.firstName?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.email}</p>
              <p className="text-xs text-white/40">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="ml-64 p-8">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-6">
              <div className="admin-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10">
                    <BanknotesIcon className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <p className="text-white/50 text-sm">Total Payin</p>
                <p className="text-2xl font-bold mt-1">
                  ₹{Number(statsData?.payin?.totalAmount || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-white/40 mt-2">{statsData?.payin?.count || 0} transactions</p>
              </div>
              
              <div className="admin-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-violet-500/10">
                    <ArrowUpIcon className="w-6 h-6 text-violet-400" />
                  </div>
                </div>
                <p className="text-white/50 text-sm">Total Payout</p>
                <p className="text-2xl font-bold mt-1">
                  ₹{Number(statsData?.payout?.totalAmount || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-white/40 mt-2">{statsData?.payout?.count || 0} transactions</p>
              </div>
              
              <div className="admin-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/10">
                    <UsersIcon className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <p className="text-white/50 text-sm">Total Users</p>
                <p className="text-2xl font-bold mt-1">{usersData.length}</p>
                <p className="text-sm text-white/40 mt-2">{pendingUsersData.length} pending approval</p>
              </div>
              
              <div className="admin-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-orange-500/10">
                    <CreditCardIcon className="w-6 h-6 text-orange-400" />
                  </div>
                </div>
                <p className="text-white/50 text-sm">Payment Gateways</p>
                <p className="text-2xl font-bold mt-1">{pgsData.length}</p>
                <p className="text-sm text-white/40 mt-2">{pgsData.filter((pg: any) => pg.isActive).length} active</p>
              </div>
            </div>
            
            {/* Pending Approvals */}
            {pendingUsersData.length > 0 && (
              <div className="admin-card">
                <h2 className="text-lg font-semibold mb-4">Pending Approvals</h2>
                <div className="space-y-3">
                  {pendingUsersData.map((pendingUser: any) => (
                    <div key={pendingUser.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <ClockIcon className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium">{pendingUser.email}</p>
                          <p className="text-sm text-white/40">{pendingUser.role} • {format(new Date(pendingUser.createdAt), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            try {
                              await userApi.approveUser(pendingUser.id, true);
                              toast.success('User approved!');
                              refetchUsers();
                            } catch (error: any) {
                              toast.error(error.response?.data?.error || 'Failed to approve user');
                            }
                          }}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="Approve User"
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              await userApi.approveUser(pendingUser.id, false);
                              toast.success('User rejected');
                              refetchUsers();
                            } catch (error: any) {
                              toast.error(error.response?.data?.error || 'Failed to reject user');
                            }
                          }}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Reject User"
                        >
                          <XCircleIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-6">
              <div className="admin-card">
                <h2 className="text-lg font-semibold mb-4">Users by Role</h2>
                <div className="space-y-3">
                  {['WHITE_LABEL', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'].map((role) => {
                    const count = usersData.filter((u: any) => u.role === role).length;
                    return (
                      <div key={role} className="flex items-center justify-between">
                        <span className="text-white/60">{role.replace('_', ' ')}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="admin-card">
                <h2 className="text-lg font-semibold mb-4">Schemas</h2>
                <div className="space-y-3">
                  {schemasData.map((schema: any) => (
                    <div key={schema.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{schema.name}</span>
                        {schema.isDefault && (
                          <span className="badge badge-info">Default</span>
                        )}
                      </div>
                      <span className="text-white/40">{schema._count?.users || 0} users</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {activeTab === 'users' && (
          <UsersTab users={usersData} schemas={schemasData} onRefresh={refetchUsers} />
        )}
        
        {activeTab === 'gateways' && (
          <GatewaysTab />
        )}
        
        {activeTab === 'cardtypes' && (
          <CardTypesTab />
        )}
        
        {activeTab === 'schemas' && (
          <SchemasTab />
        )}
        
        {activeTab === 'transactions' && (
          <TransactionsTab />
        )}
        
        {activeTab === 'wallet' && (
          <WalletTab users={usersData} />
        )}
        
        {activeTab === 'ledger' && (
          <GlobalLedgerTab users={usersData} />
        )}
        
        {activeTab === 'announcements' && (
          <AnnouncementsTab />
        )}
        
        {activeTab === 'settings' && (
          <SettingsTab />
        )}
      </main>
    </div>
  );
}

function UsersTab({ users, schemas, onRefresh }: { users: any[]; schemas: any[]; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [showChannelRatesModal, setShowChannelRatesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'RETAILER',
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    schemaId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Rate form state
  const [selectedPG, setSelectedPG] = useState('');
  const [payinRate, setPayinRate] = useState('');
  const [payoutRate, setPayoutRate] = useState('');

  // Fetch available PGs for rate assignment
  const { data: availablePGsData } = useQuery({
    queryKey: ['available-pgs-for-assignment'],
    queryFn: () => rateApi.getAvailablePGsForAssignment(),
  });

  // Fetch selected user's rates
  const { data: userRatesData, refetch: refetchUserRates } = useQuery({
    queryKey: ['user-rates', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return null;
      const childrenRates = await rateApi.getChildrenRates();
      const userData = childrenRates.data?.data?.find((c: any) => c.id === selectedUser.id);
      return userData;
    },
    enabled: !!selectedUser && showRatesModal,
  });

  // Assign rate mutation
  const assignRateMutation = useMutation({
    mutationFn: ({ targetUserId, pgId, payinRate, payoutRate }: any) =>
      rateApi.assignRate(targetUserId, pgId, payinRate, payoutRate),
    onSuccess: () => {
      toast.success('Rate assigned successfully!');
      refetchUserRates();
      queryClient.invalidateQueries({ queryKey: ['children-rates'] });
      setSelectedPG('');
      setPayinRate('');
      setPayoutRate('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to assign rate');
    },
  });

  const availablePGs = availablePGsData?.data?.data || [];
  const userRates = userRatesData?.rates || [];

  const openRatesModal = (u: any) => {
    setSelectedUser(u);
    setShowRatesModal(true);
    setSelectedPG('');
    setPayinRate('');
    setPayoutRate('');
  };

  const handleAssignRate = () => {
    if (!selectedUser || !selectedPG) {
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
    
    if (payoutRateNum < pg.minPayoutRate) {
      toast.error(`Payout rate cannot be less than ${(pg.minPayoutRate * 100).toFixed(2)}%`);
      return;
    }
    
    assignRateMutation.mutate({
      targetUserId: selectedUser.id,
      pgId: selectedPG,
      payinRate: payinRateNum,
      payoutRate: payoutRateNum,
    });
  };
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await userApi.createUser(formData);
      toast.success('User created successfully! Onboarding email sent.');
      setShowModal(false);
      setFormData({
        email: '',
        password: '',
        role: 'RETAILER',
        firstName: '',
        lastName: '',
        phone: '',
        businessName: '',
        schemaId: '',
      });
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleApprove = async (userId: string, approved: boolean) => {
    try {
      await userApi.approveUser(userId, approved);
      toast.success(approved ? 'User approved!' : 'User rejected');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Action failed');
    }
  };
  
  const handleSuspend = async (userId: string) => {
    try {
      await userApi.suspendUser(userId);
      toast.success('User suspended');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to suspend user');
    }
  };
  
  const handleReactivate = async (userId: string) => {
    try {
      await userApi.reactivateUser(userId);
      toast.success('User reactivated');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reactivate user');
    }
  };
  
  const handleQuickActivate = async (userId: string) => {
    try {
      await userApi.approveUser(userId, true);
      toast.success('User activated!');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to activate user');
    }
  };
  
  const handleCopyOnboardingLink = async (userId: string) => {
    try {
      const response = await userApi.getOnboardingLink(userId);
      const token = response.data.data.token;
      const link = `${window.location.origin.replace(':5002', ':5000')}/onboarding/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success('Onboarding link copied to clipboard!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to get onboarding link');
    }
  };
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Add User
        </button>
      </div>
      
      <div className="admin-card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr className="text-left text-white/50 text-sm">
              <th className="px-6 py-4 font-medium">User</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Created</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="table-row">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600/30 to-accent-600/30 flex items-center justify-center font-semibold">
                      {user.firstName?.[0] || user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email}</p>
                      <p className="text-sm text-white/40">{user.email}</p>
                      {user.status === 'PENDING_ONBOARDING' && user.onboardingToken && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-blue-400">Onboarding Link:</span>
                          <code className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded max-w-[200px] truncate">
                            {`${window.location.origin.replace(':5002', ':5000')}/onboarding/${user.onboardingToken}`}
                          </code>
                          <button
                            onClick={() => {
                              const link = `${window.location.origin.replace(':5002', ':5000')}/onboarding/${user.onboardingToken}`;
                              navigator.clipboard.writeText(link);
                              toast.success('Link copied!');
                            }}
                            className="text-blue-400 hover:text-blue-300"
                            title="Copy Link"
                          >
                            📋
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="badge badge-info">{user.role.replace('_', ' ')}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${
                    user.status === 'ACTIVE' ? 'badge-success' :
                    user.status === 'PENDING_APPROVAL' ? 'badge-warning' :
                    user.status === 'SUSPENDED' ? 'badge-danger' : 'badge-info'
                  }`}>
                    {user.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-white/50">
                  {format(new Date(user.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <a 
                      href={`/users/${user.id}`}
                      className="px-2 py-1 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 text-xs font-medium"
                      title="View Profile"
                    >
                      Profile
                    </a>
                    {user.role !== 'ADMIN' && (
                      <button 
                        onClick={() => openRatesModal(user)}
                        className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium"
                        title="Manage Rates"
                      >
                        Rates
                      </button>
                    )}
                    {user.status === 'PENDING_ONBOARDING' && (
                      <button 
                        onClick={() => handleCopyOnboardingLink(user.id)}
                        className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium"
                        title="Copy Onboarding Link"
                      >
                        Copy Link
                      </button>
                    )}
                    {(user.status === 'PENDING_APPROVAL' || user.status === 'PENDING_ONBOARDING') && (
                      <>
                        <button 
                          onClick={() => handleQuickActivate(user.id)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium"
                          title="Quick Activate (Skip Onboarding)"
                        >
                          Activate
                        </button>
                        <button 
                          onClick={() => handleApprove(user.id, false)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          title="Reject"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {user.status === 'ACTIVE' && user.role !== 'ADMIN' && (
                      <button 
                        onClick={() => handleSuspend(user.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Suspend
                      </button>
                    )}
                    {user.status === 'SUSPENDED' && (
                      <button 
                        onClick={() => handleReactivate(user.id)}
                        className="text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Create New User</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input-field"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input-field"
                    placeholder="Doe"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="john@example.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="select-field"
                  required
                >
                  <option value="WHITE_LABEL">White Label</option>
                  <option value="MASTER_DISTRIBUTOR">Master Distributor</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="RETAILER">Retailer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                  placeholder="+91 98765 43210"
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">Business Name</label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="input-field"
                  placeholder="ABC Enterprises"
                />
              </div>
              
              <div>
                <label className="block text-sm text-white/60 mb-1">Schema (Plan)</label>
                <select
                  value={formData.schemaId}
                  onChange={(e) => setFormData({ ...formData, schemaId: e.target.value })}
                  className="select-field"
                >
                  <option value="">Select a schema...</option>
                  {schemas.map((schema: any) => (
                    <option key={schema.id} value={schema.id}>
                      {schema.name} {schema.isDefault && '(Default)'}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Rate Management Modal */}
      {showRatesModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-xl font-bold">Manage Rates</h2>
                <p className="text-sm text-white/50 mt-1">
                  {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                </p>
              </div>
              <button 
                onClick={() => setShowRatesModal(false)} 
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Current Rates */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Current Assigned Rates</h3>
                {userRates.length === 0 ? (
                  <div className="text-center py-6 bg-white/5 rounded-xl text-white/50">
                    No rates assigned yet. Assign rates below.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {userRates.map((rate: any) => (
                      <div
                        key={rate.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10"
                      >
                        <div>
                          <p className="font-medium text-white">{rate.paymentGateway.name}</p>
                          <p className="text-sm text-white/50">{rate.paymentGateway.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-mono">
                            Payin: {(rate.payinRate * 100).toFixed(2)}%
                          </p>
                          <p className="text-blue-400 font-mono text-sm">
                            Payout: {(rate.payoutRate * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => {
                              setSelectedPG(rate.paymentGateway.id);
                              setShowChannelRatesModal(true);
                            }}
                            className="px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-sm hover:bg-blue-500/20 flex items-center gap-1"
                          >
                            <CreditCardIcon className="w-4 h-4" />
                            Channels
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPG(rate.paymentGateway.id);
                              setPayinRate((rate.payinRate * 100).toString());
                              setPayoutRate((rate.payoutRate * 100).toString());
                            }}
                            className="px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign New Rate */}
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-lg font-medium text-white mb-3">
                  {selectedPG ? 'Update Rate' : 'Assign New Rate'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Payment Gateway</label>
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
                      className="select-field"
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
                        <p className="text-white/50 text-xs mt-1">
                          This is what Admin pays. Assign a higher rate to earn commission.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-white/60 mb-1">Payin Rate (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={payinRate}
                            onChange={(e) => setPayinRate(e.target.value)}
                            className="input-field"
                            placeholder="e.g., 1.5"
                          />
                          {payinRate && availablePGs.find((p: any) => p.id === selectedPG) && (
                            <p className="text-xs text-emerald-400 mt-1">
                              Admin profit: {(parseFloat(payinRate) - availablePGs.find((p: any) => p.id === selectedPG).minPayinRate * 100).toFixed(2)}%
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm text-white/60 mb-1">Payout Rate (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={payoutRate}
                            onChange={(e) => setPayoutRate(e.target.value)}
                            className="input-field"
                            placeholder="e.g., 1.5"
                          />
                          {payoutRate && availablePGs.find((p: any) => p.id === selectedPG) && (
                            <p className="text-xs text-blue-400 mt-1">
                              Admin profit: {(parseFloat(payoutRate) - availablePGs.find((p: any) => p.id === selectedPG).minPayoutRate * 100).toFixed(2)}%
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleAssignRate}
                        disabled={assignRateMutation.isPending || !payinRate || !payoutRate}
                        className="w-full btn-primary"
                      >
                        {assignRateMutation.isPending ? 'Saving...' : 'Save Rate'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function GatewaysTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingPG, setEditingPG] = useState<any>(null);
  
  // Fetch gateways data directly in this component
  const { data: pgsData, isLoading } = useQuery({
    queryKey: ['admin-pgs'],
    queryFn: () => pgApi.getPGs(),
  });
  const gateways = pgsData?.data?.data || pgsData?.data || [];
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    supportedTypes: 'PAYIN,PAYOUT',
    isActive: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => pgApi.createPG(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pgs'] });
      toast.success('Payment Gateway created successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create gateway');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => pgApi.updatePG(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pgs'] });
      toast.success('Payment Gateway updated successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update gateway');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      pgApi.updatePG(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pgs'] });
      toast.success('Gateway status updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update status');
    },
  });

  const openCreateModal = () => {
    setEditingPG(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      supportedTypes: 'PAYIN,PAYOUT',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (pg: any) => {
    setEditingPG(pg);
    setFormData({
      name: pg.name || '',
      code: pg.code || '',
      description: pg.description || '',
      supportedTypes: pg.supportedTypes || 'PAYIN,PAYOUT',
      isActive: pg.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPG(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      supportedTypes: formData.supportedTypes.split(','),
    };
    
    if (editingPG) {
      updateMutation.mutate({ id: editingPG.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment Gateways</h1>
        <button onClick={openCreateModal} className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Gateway
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {gateways.map((pg: any) => (
          <div key={pg.id} className="admin-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                  <CreditCardIcon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{pg.name}</h3>
                  <p className="text-sm text-white/40">{pg.code}</p>
                </div>
              </div>
              <span className={`badge ${pg.isActive ? 'badge-success' : 'badge-danger'}`}>
                {pg.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Supported Types</span>
                <span>
                  {(() => {
                    try {
                      const types = typeof pg.supportedTypes === 'string' 
                        ? JSON.parse(pg.supportedTypes) 
                        : pg.supportedTypes;
                      return Array.isArray(types) ? types.join(', ') : types;
                    } catch {
                      return pg.supportedTypes || 'PAYIN, PAYOUT';
                    }
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Transaction Channels</span>
                <span>{pg._count?.transactionChannels || 0} channels</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">User Assignments</span>
                <span>{pg._count?.userAssignments || 0} users</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
              <button onClick={() => openEditModal(pg)} className="btn-secondary text-sm flex-1">Edit</button>
              <button 
                onClick={() => toggleMutation.mutate({ id: pg.id, isActive: !pg.isActive })}
                className={`text-sm flex-1 ${pg.isActive ? 'btn-danger' : 'btn-primary'}`}
              >
                {pg.isActive ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingPG ? 'Edit Gateway' : 'Add Payment Gateway'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl"
                  placeholder="Razorpay"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Code * (unique)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl font-mono"
                  placeholder="RAZORPAY"
                  required
                  disabled={!!editingPG}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl"
                  placeholder="Payment gateway for cards and UPI"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Supported Types</label>
                <select
                  value={formData.supportedTypes}
                  onChange={(e) => setFormData({ ...formData, supportedTypes: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl"
                >
                  <option value="PAYIN,PAYOUT">Both (PAYIN & PAYOUT)</option>
                  <option value="PAYIN">PAYIN Only</option>
                  <option value="PAYOUT">PAYOUT Only</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-white/70">Active</label>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingPG ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ==================== CARD TYPES TAB ====================
function CardTypesTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCardType, setEditingCardType] = useState<any>(null);
  const [selectedPG, setSelectedPG] = useState<string>('');
  
  // Fetch payment gateways
  const { data: pgsData } = useQuery({
    queryKey: ['admin-pgs'],
    queryFn: () => pgApi.getPGs(),
  });
  const gateways = pgsData?.data?.data || pgsData?.data || [];
  
  // Fetch card types
  const { data: cardTypesData, isLoading } = useQuery({
    queryKey: ['admin-cardtypes', selectedPG],
    queryFn: () => cardTypeApi.getAll({ pgId: selectedPG || undefined }),
  });
  const cardTypes = cardTypesData?.data?.data || cardTypesData?.data || [];
  
  const [formData, setFormData] = useState({
    pgId: '',
    code: '',
    name: '',
    description: '',
    internalPG: '',
    cardNetwork: '',
    cardCategory: '',
    baseRate: '0.02',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => cardTypeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cardtypes'] });
      toast.success('Card Type created successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create card type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cardTypeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cardtypes'] });
      toast.success('Card Type updated successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update card type');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      cardTypeApi.toggle(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cardtypes'] });
      toast.success('Card Type status updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update status');
    },
  });

  const openCreateModal = () => {
    setEditingCardType(null);
    setFormData({
      pgId: selectedPG || (gateways[0]?.id || ''),
      code: '',
      name: '',
      description: '',
      internalPG: '',
      cardNetwork: 'VISA',
      cardCategory: 'NORMAL',
      baseRate: '0.02',
    });
    setShowModal(true);
  };

  const openEditModal = (ct: any) => {
    setEditingCardType(ct);
    setFormData({
      pgId: ct.pgId,
      code: ct.code,
      name: ct.name,
      description: ct.description || '',
      internalPG: ct.internalPG || '',
      cardNetwork: ct.cardNetwork || '',
      cardCategory: ct.cardCategory || '',
      baseRate: String(ct.baseRate || 0.02),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCardType(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      baseRate: parseFloat(formData.baseRate),
    };
    
    if (editingCardType) {
      updateMutation.mutate({ id: editingCardType.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Auto-generate code from internalPG, cardNetwork, cardCategory
  const generateCode = () => {
    const parts = [];
    if (formData.internalPG) parts.push(formData.internalPG.toLowerCase());
    if (formData.cardNetwork) parts.push(formData.cardNetwork.toLowerCase());
    if (formData.cardCategory) parts.push(formData.cardCategory.toLowerCase());
    return parts.length >= 2 ? `${parts[0]}_${parts.slice(1).join('-')}` : '';
  };

  // Auto-generate name
  const generateName = () => {
    const parts = [];
    if (formData.internalPG) parts.push(formData.internalPG.charAt(0).toUpperCase() + formData.internalPG.slice(1));
    if (formData.cardNetwork) parts.push(formData.cardNetwork.toUpperCase());
    if (formData.cardCategory) parts.push(formData.cardCategory.charAt(0).toUpperCase() + formData.cardCategory.slice(1).toLowerCase());
    return parts.join(' ');
  };

  // Group card types by internal PG
  const groupedCardTypes = cardTypes.reduce((acc: any, ct: any) => {
    const key = ct.internalPG || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ct);
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Card Types</h2>
          <p className="text-white/60 text-sm mt-1">
            Manage card types for PG-specific rates (e.g., PayU VISA Corporate, Cashfree Master Normal)
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedPG}
            onChange={(e) => setSelectedPG(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
          >
            <option value="">All Payment Gateways</option>
            {gateways.map((pg: any) => (
              <option key={pg.id} value={pg.id}>{pg.name}</option>
            ))}
          </select>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-xl font-medium transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Card Type
          </button>
        </div>
      </div>

      {/* Card Types Table - Grouped by Internal PG */}
      {isLoading ? (
        <div className="text-center py-8 text-white/60">Loading card types...</div>
      ) : Object.keys(groupedCardTypes ?? {}).length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <CreditCardIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>No card types configured yet.</p>
          <p className="text-sm">Click "Add Card Type" to create one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCardTypes ?? {}).map(([internalPG, types]: [string, any]) => (
            <div key={internalPG} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                <h3 className="font-semibold text-lg">
                  {internalPG.charAt(0).toUpperCase() + internalPG.slice(1)}
                  <span className="ml-2 text-sm text-white/50 font-normal">({types.length} types)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 text-white/60 text-sm">
                    <tr>
                      <th className="px-6 py-3 text-left">Code</th>
                      <th className="px-6 py-3 text-left">Name</th>
                      <th className="px-6 py-3 text-left">Network</th>
                      <th className="px-6 py-3 text-left">Category</th>
                      <th className="px-6 py-3 text-left">Base Rate</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {types.map((ct: any) => (
                      <tr key={ct.id} className="hover:bg-white/5">
                        <td className="px-6 py-4 font-mono text-sm">{ct.code}</td>
                        <td className="px-6 py-4">{ct.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ct.cardNetwork === 'VISA' ? 'bg-blue-500/20 text-blue-400' :
                            ct.cardNetwork === 'MASTER' ? 'bg-orange-500/20 text-orange-400' :
                            ct.cardNetwork === 'RUPAY' ? 'bg-green-500/20 text-green-400' :
                            ct.cardNetwork === 'AMEX' ? 'bg-purple-500/20 text-purple-400' :
                            ct.cardNetwork === 'UPI' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {ct.cardNetwork || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            ct.cardCategory === 'CORPORATE' ? 'bg-yellow-500/20 text-yellow-400' :
                            ct.cardCategory === 'PREMIUM' ? 'bg-pink-500/20 text-pink-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {ct.cardCategory || 'Normal'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-emerald-400">
                          {(ct.baseRate * 100).toFixed(2)}%
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            ct.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {ct.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(ct)}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleMutation.mutate({ id: ct.id, isActive: !ct.isActive })}
                              className={`p-2 rounded-lg transition-colors ${
                                ct.isActive ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-green-500/20 text-green-400'
                              }`}
                              title={ct.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {ct.isActive ? <XMarkIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-4">
              {editingCardType ? 'Edit Card Type' : 'Add Card Type'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingCardType && (
                <div>
                  <label className="block text-sm text-white/60 mb-2">Payment Gateway *</label>
                  <select
                    value={formData.pgId}
                    onChange={(e) => setFormData({...formData, pgId: e.target.value})}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                    required
                  >
                    <option value="">Select Gateway</option>
                    {gateways.map((pg: any) => (
                      <option key={pg.id} value={pg.id}>{pg.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Internal PG</label>
                  <select
                    value={formData.internalPG}
                    onChange={(e) => {
                      const newData = {...formData, internalPG: e.target.value};
                      if (!editingCardType) {
                        newData.code = generateCode();
                        newData.name = generateName();
                      }
                      setFormData(newData);
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select</option>
                    <option value="payu">PayU</option>
                    <option value="cashfree">Cashfree</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="ccavenue">CCAvenue</option>
                    <option value="phonepe">PhonePe</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Card Network</label>
                  <select
                    value={formData.cardNetwork}
                    onChange={(e) => {
                      const newData = {...formData, cardNetwork: e.target.value};
                      if (!editingCardType) {
                        newData.code = generateCode();
                        newData.name = generateName();
                      }
                      setFormData(newData);
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select</option>
                    <option value="VISA">VISA</option>
                    <option value="MASTER">Mastercard</option>
                    <option value="RUPAY">RuPay</option>
                    <option value="AMEX">AMEX</option>
                    <option value="UPI">UPI</option>
                    <option value="NETBANKING">Net Banking</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Category</label>
                  <select
                    value={formData.cardCategory}
                    onChange={(e) => {
                      const newData = {...formData, cardCategory: e.target.value};
                      if (!editingCardType) {
                        newData.code = generateCode();
                        newData.name = generateName();
                      }
                      setFormData(newData);
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="PLATINUM">Platinum</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Code *</label>
                <input
                  type="text"
                  value={formData.code || generateCode()}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500 font-mono"
                  placeholder="payu_visa-normal"
                  required
                  disabled={!!editingCardType}
                />
                <p className="text-xs text-white/40 mt-1">This code will be matched with PG response</p>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Display Name *</label>
                <input
                  type="text"
                  value={formData.name || generateName()}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                  placeholder="PayU VISA Normal"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Base Rate (PG Cost) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={formData.baseRate}
                    onChange={(e) => setFormData({...formData, baseRate: e.target.value})}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                    required
                  />
                  <span className="text-white/60 whitespace-nowrap">= {(parseFloat(formData.baseRate || '0') * 100).toFixed(2)}%</span>
                </div>
                <p className="text-xs text-white/40 mt-1">This is the cost charged by the PG for this card type</p>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary-500"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingCardType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function SchemasTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [editingSchema, setEditingSchema] = useState<any>(null);
  const [selectedSchemaForRates, setSelectedSchemaForRates] = useState<any>(null);
  
  // Fetch schemas data directly in this component
  const { data: schemasData, isLoading } = useQuery({
    queryKey: ['admin-schemas'],
    queryFn: () => schemaApi.getSchemas(),
  });
  const schemas = schemasData?.data?.data || schemasData?.data || [];
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    applicableRoles: 'WHITE_LABEL,MASTER_DISTRIBUTOR,DISTRIBUTOR,RETAILER',
    isActive: true,
    isDefault: false,
  });

  const { data: pgsData } = useQuery({
    queryKey: ['pgs-for-rates'],
    queryFn: () => pgApi.getPGs(),
  });
  const allPGs = pgsData?.data?.data || pgsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => schemaApi.createSchema(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schemas'] });
      toast.success('Schema created successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create schema');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => schemaApi.updateSchema(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schemas'] });
      toast.success('Schema updated successfully!');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update schema');
    },
  });

  const openCreateModal = () => {
    setEditingSchema(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      applicableRoles: 'WHITE_LABEL,MASTER_DISTRIBUTOR,DISTRIBUTOR,RETAILER',
      isActive: true,
      isDefault: false,
    });
    setShowModal(true);
  };

  const openEditModal = (schema: any) => {
    setEditingSchema(schema);
    setFormData({
      name: schema.name || '',
      code: schema.code || '',
      description: schema.description || '',
      applicableRoles: schema.applicableRoles || 'WHITE_LABEL,MASTER_DISTRIBUTOR,DISTRIBUTOR,RETAILER',
      isActive: schema.isActive,
      isDefault: schema.isDefault,
    });
    setShowModal(true);
  };

  const openRatesModal = (schema: any) => {
    setSelectedSchemaForRates(schema);
    setShowRatesModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSchema(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSchema) {
      updateMutation.mutate({ id: editingSchema.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schemas</h1>
        <button onClick={openCreateModal} className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Create Schema
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-6">
        {schemas.map((schema: any) => (
          <div key={schema.id} className="admin-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{schema.name}</h3>
              <div className="flex gap-2">
                {schema.isDefault && (
                  <span className="badge badge-success">Default</span>
                )}
                {!schema.isActive && (
                  <span className="badge badge-danger">Inactive</span>
                )}
              </div>
            </div>
            <p className="text-white/50 text-sm mb-4">{schema.description || 'No description'}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Code</span>
                <span className="font-mono">{schema.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Users</span>
                <span>{schema._count?.users || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">PG Rates</span>
                <span>{schema.pgRates?.length || 0} configured</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
              <button onClick={() => openEditModal(schema)} className="btn-secondary text-sm flex-1">Edit</button>
              <button onClick={() => openRatesModal(schema)} className="btn-primary text-sm flex-1">Rates</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Schema Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingSchema ? 'Edit Schema' : 'Create Schema'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl"
                  placeholder="Gold"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Code * (unique)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl font-mono"
                  placeholder="GOLD"
                  required
                  disabled={!!editingSchema}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl"
                  placeholder="Premium rates for gold members"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Applicable Roles</label>
                <select
                  value={formData.applicableRoles}
                  onChange={(e) => setFormData({ ...formData, applicableRoles: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl"
                >
                  <option value="WHITE_LABEL,MASTER_DISTRIBUTOR,DISTRIBUTOR,RETAILER">All Roles</option>
                  <option value="WHITE_LABEL,MASTER_DISTRIBUTOR">White Label & Master Distributor</option>
                  <option value="DISTRIBUTOR,RETAILER">Distributor & Retailer</option>
                  <option value="RETAILER">Retailer Only</option>
                </select>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-white/70">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-white/70">Default Schema</span>
                </label>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingSchema ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* PG Rates Modal */}
      {showRatesModal && selectedSchemaForRates && (
        <SchemaRatesModal
          schema={selectedSchemaForRates}
          allPGs={allPGs}
          onClose={() => {
            setShowRatesModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin-schemas'] });
          }}
        />
      )}
    </motion.div>
  );
}

function TransactionsTab() {
  const [pgFilter, setPgFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  
  const { data, isLoading } = useQuery({
    queryKey: ['admin-transactions', pgFilter, typeFilter, statusFilter],
    queryFn: () => transactionApi.getTransactions({ 
      limit: 100,
      pgId: pgFilter || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
  });
  
  const { data: pgsData } = useQuery({
    queryKey: ['pgs-for-filter'],
    queryFn: () => pgApi.getPGs(),
  });
  
  const transactions = data?.data?.data || [];
  const pgs = pgsData?.data?.data || pgsData?.data || [];
  
  // Group transactions by PG
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'all' ? 'bg-primary-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'grouped' ? 'bg-primary-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            By Gateway
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={pgFilter}
            onChange={(e) => setPgFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Payment Gateways</option>
            {pgs.map((pg: any) => (
              <option key={pg.id} value={pg.id}>{pg.name}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Types</option>
            <option value="PAYIN">Payin</option>
            <option value="PAYOUT">Payout</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Status</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : viewMode === 'grouped' ? (
        /* Grouped View */
        <div className="space-y-6">
          {Object.entries(groupedByPG ?? {}).map(([pgName, data]: [string, any]) => (
            <div key={pgName} className="admin-card overflow-hidden p-0">
              {/* PG Header */}
              <div className="p-4 bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                      <CreditCardIcon className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{pgName}</h3>
                      <p className="text-sm text-white/50">{data.transactions.length} transactions</p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <p className="text-sm text-white/50">Total Volume</p>
                      <p className="font-semibold text-lg">₹{data.totalAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/50">Success Rate</p>
                      <p className="font-semibold text-lg text-emerald-400">
                        {data.transactions.length > 0 
                          ? Math.round((data.successCount / data.transactions.length) * 100) 
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Transactions Table */}
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr className="text-left text-white/50 text-sm">
                    <th className="px-6 py-3 font-medium">Transaction ID</th>
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.slice(0, 10).map((tx: any) => (
                    <tr key={tx.id} className="table-row">
                      <td className="px-6 py-3 font-mono text-sm">{tx.transactionId}</td>
                      <td className="px-6 py-3 text-sm">{tx.initiator?.email || '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`badge ${tx.type === 'PAYIN' ? 'badge-success' : 'badge-warning'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-semibold">₹{tx.amount?.toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <span className={`badge ${
                          tx.status === 'SUCCESS' ? 'badge-success' :
                          tx.status === 'PENDING' ? 'badge-warning' :
                          tx.status === 'FAILED' ? 'badge-danger' : 'badge-info'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-white/50 text-sm">
                        {format(new Date(tx.createdAt), 'MMM d, HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.transactions.length > 10 && (
                <div className="p-3 text-center text-white/40 text-sm border-t border-white/5">
                  + {data.transactions.length - 10} more transactions
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* All Transactions View */
        <div className="admin-card overflow-hidden p-0">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <p>No transactions found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-white/5">
                <tr className="text-left text-white/50 text-sm">
                  <th className="px-6 py-4 font-medium">Transaction ID</th>
                  <th className="px-6 py-4 font-medium">Gateway</th>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="table-row">
                    <td className="px-6 py-4 font-mono text-sm">{tx.transactionId}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-lg bg-primary-500/10 text-primary-400 text-xs font-medium">
                        {tx.paymentGateway?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{tx.initiator?.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${tx.type === 'PAYIN' ? 'badge-success' : 'badge-warning'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold">₹{tx.amount?.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${
                        tx.status === 'SUCCESS' ? 'badge-success' :
                        tx.status === 'PENDING' ? 'badge-warning' :
                        tx.status === 'FAILED' ? 'badge-danger' : 'badge-info'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/50">
                      {format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </motion.div>
  );
}

function WalletTab({ users }: { users: any[] }) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'credit' | 'debit'>('credit');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  
  // Fetch wallets for all users
  const { data: walletsData, isLoading, refetch: refetchWallets } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      // Fetch wallet for each user (in parallel)
      const walletPromises = users.map(async (user) => {
        try {
          const res = await walletApi.getWallet(user.id);
          return { user, wallet: res.data.data };
        } catch (e) {
          return { user, wallet: null };
        }
      });
      return Promise.all(walletPromises);
    },
    enabled: users.length > 0,
  });
  
  const wallets = walletsData || [];
  
  const creditMutation = useMutation({
    mutationFn: ({ userId, amount, description }: { userId: string; amount: number; description: string }) =>
      walletApi.addFunds(userId, amount, description),
    onSuccess: () => {
      toast.success('Funds added successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      refetchWallets();
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add funds');
    },
  });
  
  const debitMutation = useMutation({
    mutationFn: ({ userId, amount, description }: { userId: string; amount: number; description: string }) =>
      walletApi.deductFunds(userId, amount, description),
    onSuccess: () => {
      toast.success('Funds deducted successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      refetchWallets();
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to deduct funds');
    },
  });
  
  const openCreditModal = (user: any) => {
    setSelectedUser(user);
    setModalType('credit');
    setAmount('');
    setDescription('');
    setShowModal(true);
  };
  
  const openDebitModal = (user: any) => {
    setSelectedUser(user);
    setModalType('debit');
    setAmount('');
    setDescription('');
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setAmount('');
    setDescription('');
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !amount) return;
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (modalType === 'credit') {
      creditMutation.mutate({ userId: selectedUser.id, amount: amountNum, description });
    } else {
      debitMutation.mutate({ userId: selectedUser.id, amount: amountNum, description });
    }
  };
  
  // Filter wallets by search
  const filteredWallets = wallets.filter((w: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      w.user.email?.toLowerCase().includes(searchLower) ||
      w.user.firstName?.toLowerCase().includes(searchLower) ||
      w.user.lastName?.toLowerCase().includes(searchLower) ||
      w.user.businessName?.toLowerCase().includes(searchLower)
    );
  });
  
  // Calculate total balance
  const totalBalance = wallets.reduce((sum: number, w: any) => sum + Number(w.wallet?.balance || 0), 0);
  const totalHoldBalance = wallets.reduce((sum: number, w: any) => sum + Number(w.wallet?.holdBalance || 0), 0);
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wallet Management</h1>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="admin-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <WalletIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-white/50">Total User Balance</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="admin-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <ClockIcon className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-white/50">Total Hold Balance</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            ₹{totalHoldBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="admin-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <UsersIcon className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-white/50">Users with Wallet</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {wallets.filter((w: any) => w.wallet).length}
          </p>
        </div>
      </div>
      
      {/* Search */}
      <div className="admin-card p-4">
        <input
          type="text"
          placeholder="Search users by name, email, or business..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
      </div>
      
      {/* Wallets Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="admin-card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr className="text-left text-white/50 text-sm">
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium text-right">Balance</th>
                <th className="px-6 py-4 font-medium text-right">Hold Balance</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWallets.map((item: any) => (
                <tr key={item.user.id} className="table-row">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600/30 to-accent-600/30 flex items-center justify-center font-semibold">
                        {item.user.firstName?.[0] || item.user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">
                          {item.user.firstName ? `${item.user.firstName} ${item.user.lastName || ''}` : item.user.email}
                        </p>
                        <p className="text-sm text-white/40">{item.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge badge-info">{item.user.role?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-emerald-400">
                      ₹{Number(item.wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-amber-400">
                      ₹{Number(item.wallet?.holdBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openCreditModal(item.user)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium flex items-center gap-1"
                      >
                        <ArrowDownIcon className="w-3 h-3" />
                        Credit
                      </button>
                      <button
                        onClick={() => openDebitModal(item.user)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium flex items-center gap-1"
                      >
                        <ArrowUpIcon className="w-3 h-3" />
                        Debit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Credit/Debit Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {modalType === 'credit' ? 'Add Funds' : 'Deduct Funds'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            {/* User Info */}
            <div className="mb-6 p-4 bg-white/5 rounded-xl">
              <p className="text-sm text-white/50 mb-1">User</p>
              <p className="font-medium">
                {selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName || ''}` : selectedUser.email}
              </p>
              <p className="text-sm text-white/40">{selectedUser.email}</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder={modalType === 'credit' ? 'Admin credit - reason' : 'Admin debit - reason'}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creditMutation.isPending || debitMutation.isPending}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                    modalType === 'credit'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {creditMutation.isPending || debitMutation.isPending
                    ? 'Processing...'
                    : modalType === 'credit'
                    ? 'Add Funds'
                    : 'Deduct Funds'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ==================== ANNOUNCEMENTS TAB ====================
function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'INFO',
    priority: 0,
    targetRoles: 'ALL',
    startDate: '',
    endDate: '',
    bgColor: '',
    textColor: '',
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementApi.getAll(),
  });

  const { data: statsResponse } = useQuery({
    queryKey: ['announcement-stats'],
    queryFn: () => announcementApi.getStats(),
  });

  const announcements = response?.data?.data || [];
  const stats = statsResponse?.data?.data || {};

  const createMutation = useMutation({
    mutationFn: (data: any) => announcementApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement-stats'] });
      toast.success('Announcement created!');
      setShowModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create announcement');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => announcementApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement updated!');
      setShowModal(false);
      setEditingAnnouncement(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update announcement');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => announcementApi.toggle(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement-stats'] });
      toast.success('Status updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to toggle status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement-stats'] });
      toast.success('Announcement deleted!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete announcement');
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'INFO',
      priority: 0,
      targetRoles: 'ALL',
      startDate: '',
      endDate: '',
      bgColor: '',
      textColor: '',
    });
  };

  const handleEdit = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title || '',
      message: announcement.message || '',
      type: announcement.type || 'INFO',
      priority: announcement.priority || 0,
      targetRoles: announcement.targetRoles || 'ALL',
      startDate: announcement.startDate ? new Date(announcement.startDate).toISOString().slice(0, 16) : '',
      endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().slice(0, 16) : '',
      bgColor: announcement.bgColor || '',
      textColor: announcement.textColor || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
    };

    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const typeColors: any = {
    INFO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    WARNING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    ALERT: 'bg-red-500/20 text-red-400 border-red-500/30',
    PROMO: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-white/60">Manage news ticker and broadcast messages</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingAnnouncement(null); setShowModal(true); }}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <MegaphoneIcon className="w-5 h-5" />
          New Announcement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="admin-card text-center">
          <p className="text-3xl font-bold text-white">{stats.total || 0}</p>
          <p className="text-white/60 text-sm">Total</p>
        </div>
        <div className="admin-card text-center">
          <p className="text-3xl font-bold text-emerald-400">{stats.active || 0}</p>
          <p className="text-white/60 text-sm">Active</p>
        </div>
        <div className="admin-card text-center">
          <p className="text-3xl font-bold text-amber-400">{stats.scheduled || 0}</p>
          <p className="text-white/60 text-sm">Scheduled</p>
        </div>
        <div className="admin-card text-center">
          <p className="text-3xl font-bold text-white/40">{stats.expired || 0}</p>
          <p className="text-white/60 text-sm">Expired</p>
        </div>
      </div>

      {/* Announcements List */}
      <div className="admin-card">
        <h2 className="text-lg font-semibold mb-4">All Announcements</h2>
        
        {isLoading ? (
          <div className="text-center py-8 text-white/60">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-white/60">No announcements yet. Create one to get started!</div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement: any) => (
              <div
                key={announcement.id}
                className={`p-4 rounded-xl border ${announcement.isActive ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeColors[announcement.type]}`}>
                        {announcement.type}
                      </span>
                      <span className="text-xs text-white/40">
                        Priority: {announcement.priority}
                      </span>
                      <span className="text-xs text-white/40">
                        Target: {announcement.targetRoles}
                      </span>
                      <span className="text-xs text-white/40">
                        Views: {announcement.viewCount}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white mb-1">{announcement.title || '(No title)'}</h3>
                    <p className="text-white/70 text-sm line-clamp-2">{announcement.message}</p>
                    <div className="mt-2 text-xs text-white/40">
                      {announcement.startDate && (
                        <span>Start: {format(new Date(announcement.startDate), 'MMM d, yyyy HH:mm')}</span>
                      )}
                      {announcement.endDate && (
                        <span className="ml-4">End: {format(new Date(announcement.endDate), 'MMM d, yyyy HH:mm')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMutation.mutate({ id: announcement.id, isActive: !announcement.isActive })}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        announcement.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {announcement.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this announcement?')) {
                          deleteMutation.mutate(announcement.id);
                        }
                      }}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold mb-4">
              {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-primary-500 outline-none"
                  placeholder="Announcement title"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-primary-500 outline-none min-h-[100px]"
                  placeholder="Enter your announcement message..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-primary-500 outline-none"
                  >
                    <option value="INFO">Info (Blue)</option>
                    <option value="WARNING">Warning (Amber)</option>
                    <option value="ALERT">Alert (Red)</option>
                    <option value="PROMO">Promo (Green)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-primary-500 outline-none"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Target Roles</label>
                <select
                  value={formData.targetRoles}
                  onChange={(e) => setFormData({ ...formData, targetRoles: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-primary-500 outline-none"
                >
                  <option value="ALL">All Users</option>
                  <option value="WHITE_LABEL">White Label Only</option>
                  <option value="MASTER_DISTRIBUTOR">Master Distributor Only</option>
                  <option value="DISTRIBUTOR">Distributor Only</option>
                  <option value="RETAILER">Retailer Only</option>
                  <option value="WHITE_LABEL,MASTER_DISTRIBUTOR">WL & MD</option>
                  <option value="MASTER_DISTRIBUTOR,DISTRIBUTOR,RETAILER">MD, Distributor & Retailer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Start Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">End Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingAnnouncement(null); resetForm(); }}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingAnnouncement ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function SettingsTab() {
  const { user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setIsChangingPassword(true);
    try {
      const { authApi } = await import('@/lib/api');
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* PG Base Rate Manager - Admin Only */}
      <div className="mb-6">
        <PGBaseRateManager />
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Profile Info */}
        <div className="admin-card">
          <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center text-2xl font-bold">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-lg">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Admin'}
                </p>
                <p className="text-white/50">{user?.email}</p>
                <span className="badge badge-info mt-1">{user?.role}</span>
              </div>
            </div>
            <div className="pt-4 border-t border-white/5 space-y-2">
              <div className="flex justify-between">
                <span className="text-white/50">Email</span>
                <span>{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Role</span>
                <span>{user?.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Status</span>
                <span className="badge badge-success">{user?.status}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Change Password */}
        <div className="admin-card">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isChangingPassword}
              className="btn-primary w-full"
            >
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
      
      {/* System Info */}
      <div className="admin-card">
        <h2 className="text-lg font-semibold mb-4">System Information</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">API URL</p>
            <p className="font-mono text-sm">{API_BASE_URL}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Environment</p>
            <p className="font-medium">Development</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-white/50 mb-1">Version</p>
            <p className="font-medium">1.0.0</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GlobalLedgerTab({ users }: { users: any[] }) {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  
  const { data, isLoading } = useQuery({
    queryKey: ['global-ledger', page, filterType, filterUserId],
    queryFn: () => ledgerApi.getGlobalLedger({
      page,
      limit: 30,
      type: filterType || undefined,
      userId: filterUserId || undefined,
    }),
  });
  
  const ledger = data?.data?.data;
  const entries = ledger?.entries || [];
  const summary = ledger?.summary || {};
  const pagination = ledger?.pagination || { total: 0, totalPages: 1 };
  
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BookOpenIcon className="w-8 h-8 text-primary-400" />
          Global Ledger
        </h1>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-3 gap-6">
        <div className="admin-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ArrowDownIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-white/50">Total Credits</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            +₹{Number(summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="admin-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <ArrowUpIcon className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-white/50">Total Debits</span>
          </div>
          <p className="text-2xl font-bold text-red-400">
            -₹{Number(summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="admin-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DocumentTextIcon className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-white/50">Total Transactions</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {summary.transactionCount || 0}
          </p>
        </div>
      </div>
      
      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Types</option>
            <option value="CREDIT">Credit</option>
            <option value="DEBIT">Debit</option>
            <option value="COMMISSION">Commission</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="REFUND">Refund</option>
          </select>
          <select
            value={filterUserId}
            onChange={(e) => { setFilterUserId(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Ledger Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : entries.length === 0 ? (
        <div className="admin-card text-center py-20 text-white/40">
          <BookOpenIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No ledger entries found</p>
        </div>
      ) : (
        <div className="admin-card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr className="text-left text-white/50 text-sm">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">User</th>
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
                    <p className="text-sm">{format(new Date(entry.date), 'MMM d, yyyy')}</p>
                    <p className="text-xs text-white/40">{format(new Date(entry.date), 'HH:mm:ss')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center text-xs font-semibold">
                        {entry.user?.firstName?.[0] || entry.user?.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {entry.user?.firstName ? `${entry.user.firstName} ${entry.user.lastName || ''}` : entry.user?.email}
                        </p>
                        <p className="text-xs text-white/40">{entry.user?.role?.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${getTypeBadge(entry.type)}`}>
                      {entry.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm">{entry.description}</p>
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
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
              <p className="text-sm text-white/50">
                Page {page} of {pagination.totalPages} ({pagination.total} entries)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Schema Rates Modal with full editing capability
// NEW SCHEMA RATES MODAL - Transaction Channel Based
// This replaces the old PG-based rate system
// Replace the SchemaRatesModal function in AdminDashboard.tsx (lines 3244-3633) with this code

function SchemaRatesModal({ schema, allPGs, onClose }: { schema: any; allPGs: any[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedPG, setSelectedPG] = useState<any>(null);
  const [view, setView] = useState<'pg-list' | 'channels' | 'payout' | 'response-codes'>('pg-list');
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [channelRateInput, setChannelRateInput] = useState('');
  const [editingResponseCodes, setEditingResponseCodes] = useState<any>(null);
  const [responseCodesInput, setResponseCodesInput] = useState<string>('');
  
  console.log('[MODAL DEBUG] allPGs:', allPGs);
  console.log('[MODAL DEBUG] selectedPG:', selectedPG);
  console.log('[MODAL DEBUG] view:', view);
  
  // Payout configuration states
  const [payoutChargeType, setPayoutChargeType] = useState<'PERCENTAGE' | 'SLAB'>('SLAB');
  const [payoutRate, setPayoutRate] = useState('');
  const [slabs, setSlabs] = useState<Array<{ minAmount: string; maxAmount: string; flatFee: string }>>([
    { minAmount: '0', maxAmount: '5000', flatFee: '10' },
  ]);

  // Fetch all channels for the selected PG
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', selectedPG?.id],
    queryFn: async () => {
      if (!selectedPG || !selectedPG.id) {
        console.log('[DEBUG] No selectedPG or PG ID:', selectedPG);
        return [];
      }
      console.log('[DEBUG] Fetching channels for PG:', selectedPG.id, selectedPG.name);
      const token = localStorage.getItem('adminAccessToken');
      const response = await fetch(
        `${API_BASE_URL}/admin/channels?pgId=${selectedPG.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) throw new Error('Failed to fetch channels');
      const result = await response.json();
      console.log('[DEBUG] Channels response:', result);
      console.log('[DEBUG] result.data:', result.data);
      console.log('[DEBUG] result.data.channels:', result.data.channels);
      console.log('[DEBUG] Array check:', Array.isArray(result.data.channels));
      return result.data.channels || [];
    },
    enabled: !!selectedPG && !!selectedPG.id,
  });

  // Fetch schema payin rates
  const { data: schemaRatesData, refetch: refetchRates } = useQuery({
    queryKey: ['schema-rates', schema.id],
    queryFn: async () => {
      const token = localStorage.getItem('adminAccessToken');
      const response = await fetch(
        `${API_BASE_URL}/admin/channels/schemas/${schema.id}/payin-rates`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) throw new Error('Failed to fetch schema rates');
      const result = await response.json();
      console.log('[DEBUG] Schema rates response:', result);
      return result.data || {};
    },
  });

  // Fetch payout config
  const { data: payoutConfig, refetch: refetchPayout } = useQuery({
    queryKey: ['schema-payout', schema.id, selectedPG?.id],
    queryFn: async () => {
      if (!selectedPG) return null;
      const token = localStorage.getItem('adminAccessToken');
      const response = await fetch(
        `${API_BASE_URL}/admin/channels/schemas/${schema.id}/payout-config/${selectedPG.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedPG,
  });

  // Initialize payout form when payout config loads
  useEffect(() => {
    if (payoutConfig) {
      setPayoutChargeType(payoutConfig.chargeType || 'SLAB');
      if (payoutConfig.chargeType === 'PERCENTAGE') {
        setPayoutRate((payoutConfig.payoutRate * 100).toString());
      }
      if (payoutConfig.slabs && payoutConfig.slabs.length > 0) {
        setSlabs(payoutConfig.slabs.map((s: any) => ({
          minAmount: s.minAmount.toString(),
          maxAmount: s.maxAmount ? s.maxAmount.toString() : '',
          flatFee: s.flatCharge.toString(),
        })));
      }
    }
  }, [payoutConfig]);

  // Mutation for setting channel payin rate
  const setRateMutation = useMutation({
    mutationFn: async ({ channelId, rate }: { channelId: string; rate: number }) => {
      const token = localStorage.getItem('adminAccessToken');
      const response = await fetch(
        `${API_BASE_URL}/admin/channels/schemas/${schema.id}/payin-rates`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ channelId, payinRate: rate / 100 }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set rate');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchRates();
      queryClient.invalidateQueries({ queryKey: ['admin-schemas'] });
      setEditingChannel(null);
      setChannelRateInput('');
      toast.success('Channel rate updated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set rate');
    },
  });

  // Mutation for setting payout config
  const setPayoutMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('adminAccessToken');
      const response = await fetch(
        `${API_BASE_URL}/admin/channels/schemas/${schema.id}/payout-config`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pgId: selectedPG.id,
            chargeType: payoutChargeType,
            payoutRate: payoutChargeType === 'PERCENTAGE' ? parseFloat(payoutRate) / 100 : null,
            slabs: payoutChargeType === 'SLAB' ? slabs.map(s => ({
              minAmount: parseFloat(s.minAmount) || 0,
              maxAmount: s.maxAmount ? parseFloat(s.maxAmount) : null,
              flatCharge: parseFloat(s.flatFee) || 0,
            })) : [],
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set payout config');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchPayout();
      queryClient.invalidateQueries({ queryKey: ['admin-schemas'] });
      toast.success('Payout configuration updated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set payout config');
    },
  });

  // Mutation for updating response codes
  const updateResponseCodesMutation = useMutation({
    mutationFn: async ({ channelId, responseCodes }: { channelId: string; responseCodes: string[] }) => {
      const token = localStorage.getItem('adminAccessToken');
      const response = await fetch(
        `${API_BASE_URL}/admin/channels/${channelId}/response-codes`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ responseCodes }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update response codes');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', selectedPG?.id] });
      setEditingResponseCodes(null);
      setResponseCodesInput('');
      toast.success('Response codes updated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update response codes');
    },
  });

  // Helper functions
  const addSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    const newMin = lastSlab.maxAmount ? (parseFloat(lastSlab.maxAmount) + 0.01).toString() : '0';
    setSlabs([...slabs, { minAmount: newMin, maxAmount: '', flatFee: '10' }]);
  };

  const removeSlab = (index: number) => {
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const updateSlab = (index: number, field: string, value: string) => {
    const newSlabs = [...slabs];
    newSlabs[index] = { ...newSlabs[index], [field]: value };
    setSlabs(newSlabs);
  };

  const handleSaveChannelRate = () => {
    if (!editingChannel || !channelRateInput) {
      toast.error('Please enter a valid rate');
      return;
    }
    const rate = parseFloat(channelRateInput);
    if (rate < 0) {
      toast.error('Rate must be positive');
      return;
    }
    setRateMutation.mutate({ channelId: editingChannel.id, rate });
  };

  const handleSavePayoutConfig = () => {
    if (payoutChargeType === 'PERCENTAGE' && (!payoutRate || parseFloat(payoutRate) < 0)) {
      toast.error('Please enter a valid payout rate');
      return;
    }
    if (payoutChargeType === 'SLAB' && slabs.length === 0) {
      toast.error('Please add at least one slab');
      return;
    }
    setPayoutMutation.mutate();
  };

  // Get current rate for a channel
  const getChannelRate = (channelId: string) => {
    console.log('[DEBUG] getChannelRate - channelId:', channelId, 'schemaRatesData:', schemaRatesData);
    if (!schemaRatesData?.rates) return null;
    const rateConfig = schemaRatesData.rates.find((r: any) => r.channelId === channelId);
    console.log('[DEBUG] Found rate config:', rateConfig);
    return rateConfig ? (rateConfig.payinRate * 100).toFixed(2) : null;
  };

  // Group channels by category
  const groupedChannels = channels?.reduce((acc: any, channel: any) => {
    const category = channel.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(channel);
    return acc;
  }, {}) || {};

  // Count configured payin channels for a PG
  const getConfiguredPayinCount = (pgId: string) => {
    if (!schemaRatesData?.rates) return 0;
    // Count rates that belong to this PG
    return schemaRatesData.rates.filter((r: any) => r.pgId === pgId).length;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <motion.div 
        className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-4xl border border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">Configure Channel Rates</h3>
            <p className="text-white/60 text-sm mt-1">
              {selectedPG ? `${selectedPG.name} • ` : ''}{schema.name} Schema
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {view === 'pg-list' ? (
          // PG Selection View
          <div>
            <p className="text-white/60 mb-4">Select a Payment Gateway to configure channel rates:</p>
            <div className="grid gap-3">
              {allPGs.map((pg) => {
                const configuredPayin = getConfiguredPayinCount(pg.id);
                
                return (
                  <div
                    key={pg.id}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold">{pg.name}</h4>
                        <p className="text-xs text-white/40 font-mono mt-0.5">{pg.code}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          console.log('[BUTTON CLICK] Setting selectedPG:', pg);
                          console.log('[BUTTON CLICK] PG has id?', pg.id);
                          setSelectedPG(pg);
                          setView('channels');
                        }}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-3 text-left transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-emerald-400">PAYIN Channels</span>
                          {configuredPayin > 0 && (
                            <span className="text-xs text-emerald-400/60">{configuredPayin} configured</span>
                          )}
                        </div>
                        <p className="text-xs text-white/40">Configure payin rates per channel</p>
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedPG(pg);
                          setView('payout');
                        }}
                        className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-left transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-blue-400">PAYOUT Config</span>
                        </div>
                        <p className="text-xs text-white/40">Configure payout slabs</p>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'channels' ? (
          // Channel Configuration View
          <div className="space-y-6">
            <button 
              onClick={() => {
                setView('pg-list');
                setSelectedPG(null);
              }} 
              className="flex items-center gap-2 text-white/60 hover:text-white"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to gateways
            </button>

            <div className="flex items-center justify-between">
              <div className="bg-white/5 rounded-xl p-4 flex-1">
                <h3 className="font-semibold text-lg mb-1">{selectedPG.name} - PAYIN Channels</h3>
                <p className="text-xs text-white/40">Configure rates for each transaction channel</p>
              </div>
              <button
                onClick={() => setView('response-codes')}
                className="ml-4 px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Response Codes
              </button>
            </div>

            {channelsLoading ? (
              <div className="text-center py-8 text-white/40">
                Loading channels...
                <div className="text-xs mt-2">selectedPG: {selectedPG?.name} (ID: {selectedPG?.id || 'UNDEFINED'})</div>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedChannels)
                  .filter(([_, channels]: any) => channels.some((c: any) => c.transactionType === 'PAYIN'))
                  .map(([category, categoryChannels]: any) => {
                    const payinChannels = categoryChannels.filter((c: any) => c.transactionType === 'PAYIN');
                    if (payinChannels.length === 0) return null;

                    return (
                      <div key={category} className="bg-white/5 rounded-xl p-4">
                        <h4 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                          {category}
                          <span className="text-xs text-white/40 font-normal">({payinChannels.length} channels)</span>
                        </h4>
                        <div className="space-y-2">
                          {payinChannels.map((channel: any) => {
                            const currentRate = getChannelRate(channel.id);
                            const baseCost = (channel.baseCost * 100).toFixed(2);
                            const isEditing = editingChannel?.id === channel.id;

                            return (
                              <div
                                key={channel.id}
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{channel.name}</span>
                                    <span className="text-xs text-white/40 font-mono">{channel.code}</span>
                                  </div>
                                  <p className="text-xs text-white/40 mt-0.5">
                                    Base Cost: {baseCost}%
                                  </p>
                                </div>

                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={channelRateInput}
                                      onChange={(e) => setChannelRateInput(e.target.value)}
                                      className="w-24 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-right"
                                      placeholder="0.00"
                                      autoFocus
                                    />
                                    <span className="text-white/60">%</span>
                                    <button
                                      onClick={handleSaveChannelRate}
                                      disabled={setRateMutation.isPending}
                                      className="px-3 py-1.5 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600 disabled:opacity-50"
                                    >
                                      {setRateMutation.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingChannel(null);
                                        setChannelRateInput('');
                                      }}
                                      className="px-3 py-1.5 bg-white/10 text-white/60 rounded text-sm hover:bg-white/20"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-xs text-white/50">Current Rate</p>
                                      <p className="font-mono text-lg text-emerald-400">
                                        {currentRate ? `${currentRate}%` : 'Not Set'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setEditingChannel(channel);
                                        setChannelRateInput(currentRate || baseCost);
                                      }}
                                      className="p-2 hover:bg-white/10 rounded transition-all"
                                    >
                                      <PencilIcon className="w-4 h-4 text-white/60" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : view === 'payout' ? (
          // Payout Configuration View
          <div className="space-y-6">
            <button 
              onClick={() => {
                setView('pg-list');
                setSelectedPG(null);
              }} 
              className="flex items-center gap-2 text-white/60 hover:text-white"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to gateways
            </button>

            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-semibold text-lg mb-1">{selectedPG.name} - PAYOUT Configuration</h3>
              <p className="text-xs text-white/40">Configure payout charges for this gateway</p>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <h4 className="font-semibold text-blue-400 mb-4">Payout Charges</h4>
              
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payoutType"
                    checked={payoutChargeType === 'SLAB'}
                    onChange={() => setPayoutChargeType('SLAB')}
                    className="w-4 h-4"
                  />
                  <span>Slab-based (Flat Fee)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payoutType"
                    checked={payoutChargeType === 'PERCENTAGE'}
                    onChange={() => setPayoutChargeType('PERCENTAGE')}
                    className="w-4 h-4"
                  />
                  <span>Percentage-based</span>
                </label>
              </div>

              {payoutChargeType === 'PERCENTAGE' ? (
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-white/60 mb-1">Payout Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payoutRate}
                      onChange={(e) => setPayoutRate(e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
                      placeholder="e.g., 1.5"
                    />
                  </div>
                  <button
                    onClick={handleSavePayoutConfig}
                    disabled={setPayoutMutation.isPending}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {setPayoutMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/50">
                    Configure flat fee charges based on transaction amount ranges.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 text-white/50">Min Amount (₹)</th>
                          <th className="text-left py-2 text-white/50">Max Amount (₹)</th>
                          <th className="text-left py-2 text-white/50">Flat Fee (₹)</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slabs.map((slab, idx) => (
                          <tr key={idx} className="border-b border-white/5">
                            <td className="py-2">
                              <input
                                type="number"
                                value={slab.minAmount}
                                onChange={(e) => updateSlab(idx, 'minAmount', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                value={slab.maxAmount}
                                onChange={(e) => updateSlab(idx, 'maxAmount', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded"
                                placeholder="Unlimited"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                value={slab.flatFee}
                                onChange={(e) => updateSlab(idx, 'flatFee', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded"
                                placeholder="10"
                              />
                            </td>
                            <td className="py-2">
                              {slabs.length > 1 && (
                                <button
                                  onClick={() => removeSlab(idx)}
                                  className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                                >
                                  <XMarkIcon className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={addSlab}
                      className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Slab
                    </button>
                    <button
                      onClick={handleSavePayoutConfig}
                      disabled={setPayoutMutation.isPending}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      {setPayoutMutation.isPending ? 'Saving...' : 'Save Payout Config'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : view === 'response-codes' ? (
          // Response Codes Management View
          <div className="space-y-6">
            <button 
              onClick={() => setView('channels')} 
              className="flex items-center gap-2 text-white/60 hover:text-white"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to channels
            </button>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <h3 className="font-semibold text-lg mb-2 text-purple-400">{selectedPG.name} - Response Code Mappings</h3>
              <p className="text-sm text-white/60">
                Configure how payment method strings from {selectedPG.name} API responses are matched to channels.
                These codes are used to automatically detect the payment method used by customers.
              </p>
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
                <p className="text-yellow-400 font-medium mb-1">💡 Example:</p>
                <p className="text-white/60">
                  If {selectedPG.name} returns <code className="px-1.5 py-0.5 bg-white/10 rounded">payment_method: "credit_card_visa"</code>, 
                  the system will match it to the Visa channel if "visa" is in its response codes list.
                </p>
              </div>
            </div>

            {channelsLoading ? (
              <div className="text-center py-8 text-white/40">Loading channels...</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedChannels)
                  .filter(([_, channels]: any) => channels.some((c: any) => c.transactionType === 'PAYIN'))
                  .map(([category, categoryChannels]: any) => {
                    const payinChannels = categoryChannels.filter((c: any) => c.transactionType === 'PAYIN');
                    if (payinChannels.length === 0) return null;

                    return (
                      <div key={category} className="bg-white/5 rounded-xl p-4">
                        <h4 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
                          {category}
                          <span className="text-xs text-white/40 font-normal">({payinChannels.length} channels)</span>
                        </h4>
                        <div className="space-y-3">
                          {payinChannels.map((channel: any) => {
                            const isEditing = editingResponseCodes?.id === channel.id;
                            const currentCodes = channel.pgResponseCodes ? JSON.parse(channel.pgResponseCodes) : [];

                            return (
                              <div
                                key={channel.id}
                                className="p-4 bg-white/5 rounded-lg border border-white/10"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{channel.name}</span>
                                      <span className="text-xs text-white/40 font-mono">{channel.code}</span>
                                      {channel.isDefault && (
                                        <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                                          Default Fallback
                                        </span>
                                      )}
                                    </div>
                                    {!isEditing && (
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {currentCodes.length > 0 ? (
                                          currentCodes.map((code: string, idx: number) => (
                                            <span
                                              key={idx}
                                              className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-mono"
                                            >
                                              {code}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-xs text-white/40 italic">No response codes configured</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {!isEditing && (
                                    <button
                                      onClick={() => {
                                        setEditingResponseCodes(channel);
                                        setResponseCodesInput(currentCodes.join(', '));
                                      }}
                                      className="p-2 hover:bg-white/10 rounded transition-all"
                                    >
                                      <PencilIcon className="w-4 h-4 text-white/60" />
                                    </button>
                                  )}
                                </div>

                                {isEditing && (
                                  <div className="mt-3 space-y-3">
                                    <div>
                                      <label className="block text-sm text-white/60 mb-2">
                                        Response Codes (comma-separated):
                                      </label>
                                      <input
                                        type="text"
                                        value={responseCodesInput}
                                        onChange={(e) => setResponseCodesInput(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-sm font-mono"
                                        placeholder="visa, VISA, credit_card_visa"
                                        autoFocus
                                      />
                                      <p className="text-xs text-white/40 mt-1">
                                        Enter all possible values that {selectedPG.name} might return for this payment method.
                                        Matching is case-insensitive and uses substring matching.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          const codes = responseCodesInput
                                            .split(',')
                                            .map(c => c.trim())
                                            .filter(c => c.length > 0);
                                          updateResponseCodesMutation.mutate({
                                            channelId: channel.id,
                                            responseCodes: codes
                                          });
                                        }}
                                        disabled={updateResponseCodesMutation.isPending}
                                        className="px-4 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50"
                                      >
                                        {updateResponseCodesMutation.isPending ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingResponseCodes(null);
                                          setResponseCodesInput('');
                                        }}
                                        className="px-4 py-2 bg-white/10 text-white/60 rounded text-sm hover:bg-white/20"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h4 className="font-medium text-blue-400 mb-2">📝 Best Practices:</h4>
              <ul className="text-sm text-white/60 space-y-1 list-disc list-inside">
                <li>Include multiple variations (lowercase, uppercase, with underscores)</li>
                <li>Example: For Visa, add: visa, VISA, Visa, credit_card_visa, visa_normal</li>
                <li>The system uses substring matching, so "visa" will match "credit_card_visa"</li>
                <li>Set one channel as "Default Fallback" for unmatched payment methods</li>
                <li>Test with actual {selectedPG.name} responses to ensure correct matching</li>
              </ul>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-4 mt-6 border-t border-white/5">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

      {/* Channel Rate Manager Modal */}
      {showChannelRatesModal && selectedUser && selectedPG && (
        <ChannelRateManager
          userId={selectedUser.id}
          pgId={selectedPG}
          pgName={userRates.find((r: any) => r.paymentGateway.id === selectedPG)?.paymentGateway.name || ''}
          onClose={() => {
            setShowChannelRatesModal(false);
            refetchUserRates();
          }}
        />
      )}

export default AdminDashboard;