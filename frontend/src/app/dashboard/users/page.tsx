'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, schemaApi, rateApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  UsersIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyRupeeIcon,
} from '@heroicons/react/24/outline';

const ALLOWED_CHILD_ROLES: Record<string, string[]> = {
  ADMIN: ['WHITE_LABEL', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'],
  WHITE_LABEL: ['MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'],
  MASTER_DISTRIBUTOR: ['DISTRIBUTOR', 'RETAILER'],
  DISTRIBUTOR: ['RETAILER'],
  RETAILER: [],
};

export default function UsersPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  
  // Auto-open modal if action=add in URL
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowModal(true);
    }
  }, [searchParams]);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    role: '',
    schemaId: '',
  });
  const [creating, setCreating] = useState(false);
  
  // Rate form state
  const [selectedPG, setSelectedPG] = useState('');
  const [payinRate, setPayinRate] = useState('');
  const [payoutRate, setPayoutRate] = useState('');

  // Can assign rates check
  const canAssignRates = user?.role === 'ADMIN' || user?.role === 'WHITE_LABEL' || user?.role === 'MASTER_DISTRIBUTOR';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, roleFilter, statusFilter, search],
    queryFn: () => userApi.getUsers({
      page,
      limit: 20,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
  });

  const { data: schemasData } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => schemaApi.getSchemas(),
  });

  // Fetch available PGs for rate assignment
  const { data: availablePGsData } = useQuery({
    queryKey: ['available-pgs-for-assignment'],
    queryFn: () => rateApi.getAvailablePGsForAssignment(),
    enabled: canAssignRates,
  });

  // Fetch selected user's rates
  const { data: userRatesData, refetch: refetchUserRates } = useQuery({
    queryKey: ['user-rates', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return null;
      // Get children rates to find this specific user's rates
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

  const users = data?.data?.data || [];
  const pagination = data?.data?.pagination || { total: 0, pages: 1 };
  const schemas = schemasData?.data?.data || schemasData?.data || [];
  const allowedRoles = user?.role ? ALLOWED_CHILD_ROLES[user.role] || [] : [];
  const availablePGs = availablePGsData?.data?.data || [];
  const userRates = userRatesData?.rates || [];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.role) {
      toast.error('Please select a role');
      return;
    }

    try {
      setCreating(true);
      await userApi.createUser(formData);
      toast.success('User created successfully! Onboarding email sent.');
      setShowModal(false);
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        businessName: '',
        role: '',
        schemaId: '',
      });
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (userId: string, approved: boolean) => {
    try {
      await userApi.approveUser(userId, approved);
      toast.success(approved ? 'User approved!' : 'User rejected');
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-400';
      case 'PENDING_APPROVAL': return 'bg-amber-500/10 text-amber-400';
      case 'PENDING_ONBOARDING': return 'bg-blue-500/10 text-blue-400';
      case 'SUSPENDED': return 'bg-red-500/10 text-red-400';
      default: return 'bg-white/10 text-white/60';
    }
  };

  if (allowedRoles.length === 0) {
    return (
      <div className="text-center py-20">
        <UsersIcon className="w-12 h-12 mx-auto mb-4 text-white/20" />
        <p className="text-white/50">You don&apos;t have permission to create users</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-white/50">Manage users in your hierarchy</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Roles</option>
            {allowedRoles.map(role => (
              <option key={role} value={role}>{role.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_ONBOARDING">Pending Onboarding</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {users.map((u: any) => (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center font-semibold">
                          {u.firstName?.[0] || u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">
                            {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                          </p>
                          <p className="text-sm text-white/40">{u.email}</p>
                          {u.status === 'PENDING_ONBOARDING' && u.onboardingToken && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs text-blue-400">Onboarding:</span>
                              <code className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded max-w-[180px] truncate">
                                {`${window.location.origin}/onboarding/${u.onboardingToken}`}
                              </code>
                              <button
                                onClick={() => {
                                  const link = `${window.location.origin}/onboarding/${u.onboardingToken}`;
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
                      <span className="px-2.5 py-1 rounded-lg bg-primary-500/10 text-primary-400 text-xs font-medium">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusColor(u.status)}`}>
                        {u.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/50">
                      {format(new Date(u.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <a
                          href={`/dashboard/users/${u.id}`}
                          className="p-1.5 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20"
                          title="View Profile"
                        >
                          <UserCircleIcon className="w-4 h-4" />
                        </a>
                        {canAssignRates && (
                          <button
                            onClick={() => openRatesModal(u)}
                            className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                            title="Manage Rates"
                          >
                            <CurrencyRupeeIcon className="w-4 h-4" />
                          </button>
                        )}
                        {(u.status === 'PENDING_APPROVAL' || u.status === 'PENDING_ONBOARDING') && (
                          <>
                            <button
                              onClick={() => handleApprove(u.id, true)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              title="Approve"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApprove(u.id, false)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              title="Reject"
                            >
                              <XCircleIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
            <p className="text-sm text-white/50">
              Page {page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserCircleIcon className="w-6 h-6 text-primary-400" />
                Create New User
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Business Name</label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  required
                >
                  <option value="">Select Role</option>
                  {allowedRoles.map(role => (
                    <option key={role} value={role}>{role.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Schema</label>
                <select
                  value={formData.schemaId}
                  onChange={(e) => setFormData({ ...formData, schemaId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="">No Schema</option>
                  {schemas.map((schema: any) => (
                    <option key={schema.id} value={schema.id}>{schema.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 btn-primary"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Rate Management Modal */}
      <AnimatePresence>
        {showRatesModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowRatesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <CurrencyRupeeIcon className="w-6 h-6 text-amber-400" />
                    Manage Rates
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                  </p>
                </div>
                <button
                  onClick={() => setShowRatesModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
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
                  <h3 className="text-lg font-medium text-white mb-3">
                    {selectedPG ? 'Update Rate' : 'Assign New Rate'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-2">Payment Gateway</label>
                      <select
                        value={selectedPG}
                        onChange={(e) => {
                          setSelectedPG(e.target.value);
                          const pg = availablePGs.find((p: any) => p.id === e.target.value);
                          if (pg) {
                            // Check if user already has this rate
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
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      >
                        <option value="">Select Payment Gateway</option>
                        {availablePGs.map((pg: any) => (
                          <option key={pg.id} value={pg.id}>
                            {pg.name} (Min: {(pg.minPayinRate * 100).toFixed(2)}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedPG && (
                      <>
                        <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-sm">
                          <p className="text-emerald-400">
                            Your base rate for this PG: {(availablePGs.find((p: any) => p.id === selectedPG)?.minPayinRate * 100 || 0).toFixed(2)}%
                          </p>
                          <p className="text-white/50 text-xs mt-1">
                            You can only assign rates equal to or higher than your base rate.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Payin Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={payinRate}
                              onChange={(e) => setPayinRate(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                              placeholder="e.g., 1.5"
                            />
                            {payinRate && availablePGs.find((p: any) => p.id === selectedPG) && (
                              <p className="text-xs text-emerald-400 mt-1">
                                Your profit: {(parseFloat(payinRate) - availablePGs.find((p: any) => p.id === selectedPG).minPayinRate * 100).toFixed(2)}%
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Payout Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={payoutRate}
                              onChange={(e) => setPayoutRate(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                              placeholder="e.g., 1.5"
                            />
                            {payoutRate && availablePGs.find((p: any) => p.id === selectedPG) && (
                              <p className="text-xs text-blue-400 mt-1">
                                Your profit: {(parseFloat(payoutRate) - availablePGs.find((p: any) => p.id === selectedPG).minPayoutRate * 100).toFixed(2)}%
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

