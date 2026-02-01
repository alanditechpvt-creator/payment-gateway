'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { beneficiaryApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingLibraryIcon,
  UserIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

// Validation helpers
const validateEmail = (email: string): boolean => {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string): boolean => {
  if (!phone) return true; // Optional field
  const cleaned = phone.replace(/\D/g, '');
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(cleaned);
};

const validateIfsc = (ifsc: string): boolean => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
};

const validateAccountNumber = (accountNumber: string): boolean => {
  const cleaned = accountNumber.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 18;
};

export default function BeneficiariesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    nickName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    accountType: 'SAVINGS',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLookingUpIfsc, setIsLookingUpIfsc] = useState(false);
  const [ifscDetails, setIfscDetails] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['beneficiaries', search],
    queryFn: () => beneficiaryApi.getBeneficiaries({ search: search || undefined }),
  });

  const beneficiaries = data?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => beneficiaryApi.createBeneficiary(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      setShowAddModal(false);
      resetForm();
      toast.success('Beneficiary added successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add beneficiary');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => beneficiaryApi.updateBeneficiary(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      setEditingBeneficiary(null);
      resetForm();
      toast.success('Beneficiary updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update beneficiary');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => beneficiaryApi.deleteBeneficiary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      toast.success('Beneficiary removed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to remove beneficiary');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => beneficiaryApi.verifyBeneficiary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      toast.success('Beneficiary verified!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Verification failed');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      nickName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      accountType: 'SAVINGS',
      email: '',
      phone: '',
    });
    setErrors({});
    setIfscDetails(null);
  };

  // IFSC Lookup
  const lookupIfsc = useCallback(async (ifsc: string) => {
    if (!validateIfsc(ifsc)) {
      setIfscDetails(null);
      return;
    }
    
    setIsLookingUpIfsc(true);
    try {
      const response = await beneficiaryApi.lookupIfsc(ifsc);
      const details = response.data.data;
      setIfscDetails(details);
      
      if (details.valid && details.bank) {
        setFormData(prev => ({
          ...prev,
          bankName: details.bank,
        }));
        setErrors(prev => ({ ...prev, ifscCode: '' }));
      } else {
        setErrors(prev => ({ ...prev, ifscCode: 'IFSC code not found' }));
      }
    } catch (error) {
      setIfscDetails(null);
      setErrors(prev => ({ ...prev, ifscCode: 'Failed to lookup IFSC' }));
    } finally {
      setIsLookingUpIfsc(false);
    }
  }, []);

  // Debounced IFSC lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.ifscCode.length === 11) {
        lookupIfsc(formData.ifscCode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.ifscCode, lookupIfsc]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name || formData.name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }
    
    if (!formData.accountNumber || !validateAccountNumber(formData.accountNumber)) {
      newErrors.accountNumber = 'Account number must be 9-18 digits';
    }
    
    if (!formData.ifscCode || !validateIfsc(formData.ifscCode)) {
      newErrors.ifscCode = 'Invalid IFSC format (e.g., HDFC0001234)';
    }
    
    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    
    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Invalid mobile number (10 digits starting with 6-9)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    if (editingBeneficiary) {
      updateMutation.mutate({ id: editingBeneficiary.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (benef: any) => {
    setEditingBeneficiary(benef);
    setFormData({
      name: benef.name,
      nickName: benef.nickName || '',
      accountNumber: benef.accountNumber,
      ifscCode: benef.ifscCode,
      bankName: benef.bankName || '',
      accountType: benef.accountType || 'SAVINGS',
      email: benef.email || '',
      phone: benef.phone || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this beneficiary?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Beneficiaries</h1>
          <p className="text-white/50">Manage your payout beneficiaries</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingBeneficiary(null); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Add Beneficiary
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, account number, or bank..."
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
      </div>

      {/* Beneficiaries List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <BuildingLibraryIcon className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <h3 className="text-lg font-semibold mb-2">No Beneficiaries Found</h3>
          <p className="text-white/50 mb-6">Add beneficiaries to enable quick payouts</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors"
          >
            Add Your First Beneficiary
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {beneficiaries.map((benef: any) => (
            <motion.div
              key={benef.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass rounded-xl p-5 ${!benef.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{benef.name}</h3>
                      {benef.isVerified && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-1">
                          <CheckCircleIcon className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                      {!benef.isActive && (
                        <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 text-xs">
                          Inactive
                        </span>
                      )}
                    </div>
                    {benef.nickName && (
                      <p className="text-sm text-white/50">{benef.nickName}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/60">
                      <span className="font-mono">A/C: {benef.accountNumber}</span>
                      <span className="font-mono">{benef.ifscCode}</span>
                      <span>{benef.bankName}</span>
                      <span className="capitalize px-2 py-0.5 rounded bg-white/5">{benef.accountType?.toLowerCase()}</span>
                    </div>
                    {(benef.email || benef.phone) && (
                      <div className="mt-2 flex items-center gap-4 text-sm text-white/40">
                        {benef.email && <span>{benef.email}</span>}
                        {benef.phone && <span>{benef.phone}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!benef.isVerified && (
                    <button
                      onClick={() => verifyMutation.mutate(benef.id)}
                      disabled={verifyMutation.isPending}
                      className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      title="Verify"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(benef)}
                    className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(benef.id)}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 w-full max-w-lg"
          >
            <h2 className="text-xl font-bold mb-6">
              {editingBeneficiary ? 'Edit Beneficiary' : 'Add New Beneficiary'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white ${
                      errors.name ? 'border-red-500' : 'border-white/10'
                    }`}
                    placeholder="Account holder name"
                  />
                  {errors.name && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <ExclamationCircleIcon className="w-3 h-3" />
                      {errors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Nick Name</label>
                  <input
                    type="text"
                    value={formData.nickName}
                    onChange={(e) => setFormData({ ...formData, nickName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white"
                    placeholder="e.g., Office Rent"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Account Number *</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, '') });
                      setErrors(prev => ({ ...prev, accountNumber: '' }));
                    }}
                    className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white font-mono ${
                      errors.accountNumber ? 'border-red-500' : 'border-white/10'
                    }`}
                    placeholder="1234567890"
                    maxLength={18}
                  />
                  {errors.accountNumber && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <ExclamationCircleIcon className="w-3 h-3" />
                      {errors.accountNumber}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">IFSC Code *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.ifscCode}
                      onChange={(e) => {
                        setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() });
                        setErrors(prev => ({ ...prev, ifscCode: '' }));
                      }}
                      className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white font-mono uppercase ${
                        errors.ifscCode ? 'border-red-500' : ifscDetails?.valid ? 'border-emerald-500' : 'border-white/10'
                      }`}
                      placeholder="HDFC0001234"
                      maxLength={11}
                    />
                    {isLookingUpIfsc && (
                      <ArrowPathIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 animate-spin" />
                    )}
                    {ifscDetails?.valid && !isLookingUpIfsc && (
                      <CheckCircleIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  {errors.ifscCode && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <ExclamationCircleIcon className="w-3 h-3" />
                      {errors.ifscCode}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Bank Details from IFSC */}
              {ifscDetails?.valid && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                >
                  <p className="text-sm text-emerald-400 font-medium">{ifscDetails.bank}</p>
                  {ifscDetails.branch && (
                    <p className="text-xs text-white/60 mt-1">{ifscDetails.branch}</p>
                  )}
                  {ifscDetails.city && ifscDetails.state && (
                    <p className="text-xs text-white/40">{ifscDetails.city}, {ifscDetails.state}</p>
                  )}
                </motion.div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white"
                    placeholder="Auto-detected from IFSC"
                    readOnly={!!ifscDetails?.valid}
                  />
                  <p className="text-xs text-white/40 mt-1">Auto-filled from IFSC lookup</p>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Account Type</label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white"
                  >
                    <option value="SAVINGS">Savings</option>
                    <option value="CURRENT">Current</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white ${
                      errors.email ? 'border-red-500' : 'border-white/10'
                    }`}
                    placeholder="beneficiary@email.com"
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <ExclamationCircleIcon className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: value });
                      setErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white ${
                      errors.phone ? 'border-red-500' : 'border-white/10'
                    }`}
                    placeholder="9876543210"
                    maxLength={10}
                  />
                  {errors.phone && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <ExclamationCircleIcon className="w-3 h-3" />
                      {errors.phone}
                    </p>
                  )}
                  <p className="text-xs text-white/40 mt-1">10 digit mobile number</p>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingBeneficiary(null); resetForm(); }}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending 
                    ? 'Saving...' 
                    : editingBeneficiary ? 'Update' : 'Add Beneficiary'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

