'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pgApi, rateApi, transactionApi, beneficiaryApi, payoutProfileApi, configApi, systemSettingsApi, walletApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import RazorpayCheckout from '@/components/RazorpayCheckout';
import { SabpaisaCheckout } from '@/components/SabpaisaCheckout';
import { CashfreeCheckout } from '@/components/CashfreeCheckout';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CreditCardIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserPlusIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
  WalletIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const BENEFICIARY_PAGE_SIZE = 8;
const DEFAULT_PAYOUT_SLABS = [
  { minAmount: 0, maxAmount: 50000, flatCharge: 10 },
  { minAmount: 50001, maxAmount: 200000, flatCharge: 18 },
  { minAmount: 200001, maxAmount: null, flatCharge: 25 },
];

function getPayoutCharge(amount: number, config: any): { charges: number; totalDeduction: number } {
  const slabs = (Array.isArray(config?.slabs) && config.slabs.length > 0) ? config.slabs : DEFAULT_PAYOUT_SLABS;
  const chargeType = (config?.payoutChargeType || 'SLAB') as 'SLAB' | 'PERCENTAGE';
  let charges = 0;
  if (chargeType === 'PERCENTAGE') {
    const rate = config?.payoutRate ?? 0;
    charges = amount * rate;
  } else {
    const applicableSlab = slabs.find((s: any) =>
      amount >= s.minAmount && (s.maxAmount == null || amount <= s.maxAmount)
    );
    charges = applicableSlab?.flatCharge ?? slabs[0]?.flatCharge ?? 10;
  }
  return { charges, totalDeduction: amount + charges };
}

// Payout Charges Breakdown Component with Slab Support
function PayoutChargesBreakdown({ amount, pgId }: { amount: number; pgId: string }) {
  const { data: configData, isLoading } = useQuery({
    queryKey: ['global-payout-config'],
    queryFn: () => systemSettingsApi.getPayoutConfig(),
  });

  const config = configData?.data?.data;
  // Use configured slabs or default (0-50k = ₹10 as per applicable PG)
  const defaultSlabs = [
    { minAmount: 0, maxAmount: 50000, flatCharge: 10 },
    { minAmount: 50001, maxAmount: 200000, flatCharge: 18 },
    { minAmount: 200001, maxAmount: null, flatCharge: 25 },
  ];
  const slabs = (Array.isArray(config?.slabs) && config.slabs.length > 0) ? config.slabs : defaultSlabs;
  const chargeType = (config?.payoutChargeType || 'SLAB') as 'SLAB' | 'PERCENTAGE';

  // Find applicable slab
  const applicableSlab = slabs.find((slab: any) => 
    amount >= slab.minAmount && (slab.maxAmount === null || amount <= slab.maxAmount)
  );

  // Calculate charges (slabs applied in backend; no need to show ranges to user)
  let charges = 0;
  if (chargeType === 'PERCENTAGE') {
    const rate = config?.payoutRate || 0;
    charges = amount * rate;
  } else if (applicableSlab) {
    charges = applicableSlab.flatCharge;
  } else {
    const fallback = slabs[0];
    charges = fallback?.flatCharge ?? 10;
  }

  const totalDeduction = amount + charges;

  if (isLoading) {
    return (
      <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-violet-500/30 rounded-full"></div>
          <span className="text-sm text-white/50">Calculating charges...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl"
    >
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Payout Amount:</span>
          <span>₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Charges:</span>
          <span className="text-amber-400">+ ₹{charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="flex justify-between font-semibold">
            <span>Total Wallet Deduction:</span>
            <span className="text-violet-400">₹{totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-2">
          ₹{amount.toLocaleString('en-IN')} will be sent to beneficiary.
        </p>
      </div>
    </motion.div>
  );
}

function NewTransactionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  
  const defaultType = searchParams.get('type') === 'payout' ? 'PAYOUT' : 'PAYIN';
  
  const [transactionType, setTransactionType] = useState<'PAYIN' | 'PAYOUT'>(defaultType);
  const [selectedPG, setSelectedPG] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [paymentLink, setPaymentLink] = useState<string>('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<string>('');
  const [isLinkOnlyMode, setIsLinkOnlyMode] = useState(false);
  
  // PG Mode (ONLINE = webhooks, OFFLINE = manual check)
  const [pgMode, setPgMode] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  
  // Payout profile flow: enter mobile -> load or create profile -> show beneficiaries under that profile
  const [profileMobile, setProfileMobile] = useState('');
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [showCreateProfileForm, setShowCreateProfileForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', email: '' });
  // Beneficiary states
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('');
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [newBeneficiary, setNewBeneficiary] = useState({
    name: '',
    nickName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    accountType: 'SAVINGS',
    phone: '',
  });
  const [isLookingUpIfsc, setIsLookingUpIfsc] = useState(false);
  const [ifscDetails, setIfscDetails] = useState<any>(null);
  const [beneficiaryErrors, setBeneficiaryErrors] = useState<Record<string, string>>({});
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [beneficiaryPage, setBeneficiaryPage] = useState(1);

  // Optional browser location for payin/payout
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        // Non-blocking: user may deny; we just won't send location
        toast('Location access is disabled. Enable it to store transaction location.', {
          duration: 4000,
          icon: 'ℹ️',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Payin rates (i) modal – schema-based rates per channel (per PG)
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [ratesModalPGCode, setRatesModalPGCode] = useState<string | null>(null); // which PG's rates to show (null = all)
  const [ratesModalData, setRatesModalData] = useState<Record<string, { paymentGateway?: { code: string }; rates: { channelName: string; channelCode: string; rateDisplay: string }[] }> | null>(null);
  const [loadingRatesModal, setLoadingRatesModal] = useState(false);

  // Fetch PG Mode configuration
  const { data: pgModeData } = useQuery({
    queryKey: ['pg-mode'],
    queryFn: () => configApi.getPGMode(),
    enabled: isAuthenticated,
  });

  // Update PG Mode state when data is fetched (TanStack Query v5 compat)
  useEffect(() => {
    if (pgModeData?.data?.mode) {
      setPgMode(pgModeData.data.mode);
    }
  }, [pgModeData]);

  // Fetch available PGs - only when authenticated
  const { data: pgsData, isLoading: loadingPGs } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => pgApi.getAvailablePGs(),
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch beneficiaries for payout (when no profile selected, fallback list)
  const { data: beneficiariesData, isLoading: loadingBeneficiaries } = useQuery({
    queryKey: ['beneficiaries', currentProfile?.id],
    queryFn: () => beneficiaryApi.getBeneficiaries({ isActive: true, profileId: currentProfile?.id }),
    enabled: isAuthenticated && transactionType === 'PAYOUT' && !!currentProfile?.id,
  });
  // Refetch current profile (e.g. after adding beneficiary)
  const { data: profileData, refetch: refetchCurrentProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['payout-profile', currentProfile?.id],
    queryFn: () => payoutProfileApi.getById(currentProfile!.id),
    enabled: isAuthenticated && transactionType === 'PAYOUT' && !!currentProfile?.id,
  });
  const profileWithBeneficiaries = profileData?.data?.data ?? currentProfile;
  const loadingBeneficiaryList = currentProfile ? loadingProfile : loadingBeneficiaries;

  // Fetch Global Payout Config for auto-selection
  const { data: globalPayoutConfig } = useQuery({
    queryKey: ['global-payout-config'],
    queryFn: () => systemSettingsApi.getPayoutConfig(),
    enabled: isAuthenticated && transactionType === 'PAYOUT',
  });

  // Fetch wallet balance for PAYOUT (to block if insufficient)
  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getWallet(),
    enabled: isAuthenticated && transactionType === 'PAYOUT',
  });
  
  const activePayoutPgId = globalPayoutConfig?.data?.data?.activePgId;
  const walletBalance = Number(walletData?.data?.data?.balance ?? 0);
  const payoutAmountNum = amount ? parseFloat(amount) : 0;
  const payoutChargeResult = transactionType === 'PAYOUT' && payoutAmountNum > 0 && globalPayoutConfig?.data?.data
    ? getPayoutCharge(payoutAmountNum, globalPayoutConfig.data.data)
    : null;
  const insufficientBalance = transactionType === 'PAYOUT' && payoutChargeResult != null && walletBalance < payoutChargeResult.totalDeduction;

  const availablePGs = pgsData?.data?.data || pgsData?.data || [];
  const beneficiaries = transactionType === 'PAYOUT' && profileWithBeneficiaries?.beneficiaries
    ? profileWithBeneficiaries.beneficiaries
    : (beneficiariesData?.data?.data || []);

  // Beneficiary search and pagination
  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiarySearch.trim()) return beneficiaries;
    const q = beneficiarySearch.trim().toLowerCase();
    return beneficiaries.filter((b: any) =>
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.nickName && b.nickName.toLowerCase().includes(q)) ||
      (b.accountNumber && b.accountNumber.toString().includes(q)) ||
      (b.bankName && b.bankName.toLowerCase().includes(q)) ||
      (b.ifscCode && b.ifscCode.toLowerCase().includes(q))
    );
  }, [beneficiaries, beneficiarySearch]);
  const totalBeneficiaryPages = Math.max(1, Math.ceil(filteredBeneficiaries.length / BENEFICIARY_PAGE_SIZE));
  const paginatedBeneficiaries = useMemo(() => {
    const start = (beneficiaryPage - 1) * BENEFICIARY_PAGE_SIZE;
    return filteredBeneficiaries.slice(start, start + BENEFICIARY_PAGE_SIZE);
  }, [filteredBeneficiaries, beneficiaryPage]);
  useEffect(() => {
    setBeneficiaryPage(1);
  }, [beneficiarySearch]);
  useEffect(() => {
    if (beneficiaryPage > totalBeneficiaryPages) setBeneficiaryPage(1);
  }, [beneficiaryPage, totalBeneficiaryPages]);
  
  // Filter PGs based on transaction type; for PAYOUT deduplicate by code so we show one per PG name
  const filteredPGs = useMemo(() => {
    if (!Array.isArray(availablePGs)) return [];
    const filtered = availablePGs.filter((pg: any) => {
      const supportedTypes = pg.supportedTypes || 'PAYIN,PAYOUT';
      if (transactionType === 'PAYIN') {
        return supportedTypes.includes('PAYIN') || pg.supportsPayin;
      }
      return supportedTypes.includes('PAYOUT') || pg.supportsPayout;
    });
    if (transactionType === 'PAYOUT') {
      const byCode = new Map<string, any>();
      for (const pg of filtered) {
        const code = (pg.code || pg.name || pg.id || '').toString().toLowerCase();
        if (!byCode.has(code)) byCode.set(code, pg);
      }
      return Array.from(byCode.values());
    }
    return filtered;
  }, [availablePGs, transactionType]);
  
  // Auto-select first PG when transaction type changes
  useEffect(() => {
    // If Payout and we have an active global PG, try to select it
    if (transactionType === 'PAYOUT' && activePayoutPgId) {
       const isAvailable = filteredPGs.some((pg: any) => pg.id === activePayoutPgId);
       if (isAvailable) {
         setSelectedPG(activePayoutPgId);
         return; 
       }
    }

    if (filteredPGs.length > 0) {
      // Check if current selection is valid for the new type
      const isCurrentValid = filteredPGs.some((pg: any) => pg.id === selectedPG);
      if (!isCurrentValid) {
        setSelectedPG(filteredPGs[0].id);
      }
    }
  }, [transactionType, filteredPGs.length, activePayoutPgId]); // Only re-run when type changes or PG count changes

  // Get selected PG details
  const selectedPGDetails = Array.isArray(availablePGs) ? availablePGs.find((pg: any) => pg.id === selectedPG) : null;
  
  // Get selected beneficiary details
  const selectedBeneficiaryDetails = beneficiaries.find((b: any) => b.id === selectedBeneficiary);

  // Auto-load beneficiary + profile details when user selects a beneficiary (PAYOUT) — no need to ask again
  useEffect(() => {
    if (transactionType === 'PAYOUT' && selectedBeneficiaryDetails) {
      setCustomerName(selectedBeneficiaryDetails.name || '');
      if (currentProfile) {
        setCustomerEmail(currentProfile.email || '');
        setCustomerPhone(currentProfile.mobile || '');
      }
    }
  }, [transactionType, selectedBeneficiaryDetails?.id, selectedBeneficiaryDetails?.name, currentProfile?.email, currentProfile?.mobile]);

  // Validation helpers
  const validateBeneficiaryForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!newBeneficiary.name || newBeneficiary.name.trim().length < 3) {
      errors.name = 'Name must be at least 3 characters';
    }
    
    const cleanedAccount = newBeneficiary.accountNumber.replace(/\D/g, '');
    if (!cleanedAccount || cleanedAccount.length < 9 || cleanedAccount.length > 18) {
      errors.accountNumber = 'Account number must be 9-18 digits';
    }
    
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!newBeneficiary.ifscCode || !ifscRegex.test(newBeneficiary.ifscCode.toUpperCase())) {
      errors.ifscCode = 'Invalid IFSC format';
    }
    
    if (newBeneficiary.phone) {
      const cleanedPhone = newBeneficiary.phone.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanedPhone)) {
        errors.phone = 'Invalid mobile number';
      }
    }
    
    setBeneficiaryErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // IFSC lookup for inline form
  const lookupIfscInline = async (ifsc: string) => {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc.toUpperCase())) {
      setIfscDetails(null);
      return;
    }
    
    setIsLookingUpIfsc(true);
    try {
      const response = await beneficiaryApi.lookupIfsc(ifsc);
      const details = response.data.data;
      setIfscDetails(details);
      
      if (details.valid && details.bank) {
        setNewBeneficiary(prev => ({ ...prev, bankName: details.bank }));
        setBeneficiaryErrors(prev => ({ ...prev, ifscCode: '' }));
      }
    } catch {
      setIfscDetails(null);
    } finally {
      setIsLookingUpIfsc(false);
    }
  };
  
  // Debounced IFSC lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newBeneficiary.ifscCode.length === 11) {
        lookupIfscInline(newBeneficiary.ifscCode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newBeneficiary.ifscCode]);

  // Lookup profile by mobile
  const lookupProfileMutation = useMutation({
    mutationFn: (mobile: string) => payoutProfileApi.getByMobile(mobile),
    onSuccess: (res) => {
      const profile = res.data?.data;
      if (profile) {
        setCurrentProfile(profile);
        setShowCreateProfileForm(false);
        toast.success(`Profile found: ${profile.name}`);
      } else {
        setShowCreateProfileForm(true);
        setNewProfile({ name: '', email: '' });
      }
    },
    onError: (err: any) => {
      if (err.response?.status === 404 || err.response?.data?.error?.toLowerCase?.().includes('not found')) {
        setShowCreateProfileForm(true);
        setNewProfile({ name: '', email: '' });
      } else {
        toast.error(err.response?.data?.error || 'Failed to lookup profile');
      }
    },
  });

  // Create payout profile (max 3 per user)
  const createProfileMutation = useMutation({
    mutationFn: (data: { mobile: string; name: string; email?: string }) => payoutProfileApi.create(data),
    onSuccess: async (res) => {
      const created = res.data?.data;
      if (created) {
        const { data: full } = await payoutProfileApi.getById(created.id);
        setCurrentProfile(full?.data || created);
        setShowCreateProfileForm(false);
        queryClient.invalidateQueries({ queryKey: ['payout-profile'] });
        toast.success('Profile created. Add beneficiaries below.');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create profile');
    },
  });

  // Add beneficiary mutation (with optional profileId)
  const addBeneficiaryMutation = useMutation({
    mutationFn: (data: any) => beneficiaryApi.createBeneficiary(data),
    onSuccess: (response) => {
      const newBenef = response.data.data;
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['payout-profile', currentProfile?.id] });
      refetchCurrentProfile();
      setSelectedBeneficiary(newBenef.id);
      setShowAddBeneficiary(false);
      setNewBeneficiary({
        name: '',
        nickName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        accountType: 'SAVINGS',
        phone: '',
      });
      setIfscDetails(null);
      setBeneficiaryErrors({});
      toast.success('Beneficiary added successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add beneficiary');
    },
  });

  const handleAddBeneficiary = async () => {
    if (!validateBeneficiaryForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    const payload: any = { ...newBeneficiary };
    if (currentProfile?.id) payload.profileId = currentProfile.id;
    addBeneficiaryMutation.mutate(payload);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPG) {
      toast.error('Please select a payment gateway');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Validate min/max amount
    if (selectedPGDetails) {
      const amountNum = parseFloat(amount);
      if (selectedPGDetails.minTransaction && amountNum < selectedPGDetails.minTransaction) {
        toast.error(`Minimum amount is ₹${selectedPGDetails.minTransaction}`);
        return;
      }
      if (selectedPGDetails.maxTransaction && amountNum > selectedPGDetails.maxTransaction) {
        toast.error(`Maximum amount is ₹${selectedPGDetails.maxTransaction}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // For PAYIN: customer fields optional; fallback to logged-in user if empty
      const resolvedName =
        customerName?.trim() ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
        user?.email ||
        'Guest';
      const resolvedEmail = customerEmail?.trim() || user?.email || '';
      const resolvedPhone = customerPhone?.trim() || user?.phone || '';

      const payload: any = {
        type: transactionType,
        pgId: selectedPG,
        amount: parseFloat(amount),
        customerName: transactionType === 'PAYIN' ? resolvedName : customerName,
        customerEmail: transactionType === 'PAYIN' ? resolvedEmail : customerEmail,
        customerPhone: transactionType === 'PAYIN' ? resolvedPhone : customerPhone,
      };

      if (location) {
        payload.locationLatitude = location.latitude;
        payload.locationLongitude = location.longitude;
        if (typeof location.accuracy === 'number') {
          payload.locationAccuracyM = location.accuracy;
        }
        payload.locationSource = 'WEB';
      }

      if (transactionType === 'PAYOUT') {
        if (!selectedBeneficiary) {
          toast.error('Please select a beneficiary');
          setIsSubmitting(false);
          return;
        }
        payload.beneficiaryId = selectedBeneficiary;
        payload.beneficiaryAccount = selectedBeneficiaryDetails?.accountNumber;
        payload.beneficiaryIfsc = selectedBeneficiaryDetails?.ifscCode;
        payload.beneficiaryName = selectedBeneficiaryDetails?.name;
      }

      const response = await transactionApi.createTransaction(payload);
      const data = response.data.data;
      
      setResult({
        success: true,
        data: data,
      });
      
      // Set payment link if returned
      if (data.paymentLink) {
        setPaymentLink(data.paymentLink);
        // For live testing, redirect immediately to PG payment page
        // Skip auto-redirect for Razorpay and Sabpaisa to use embedded checkout
        if (transactionType === 'PAYIN' && 
            selectedPGDetails?.code !== 'RAZORPAY' && 
            selectedPGDetails?.code !== 'SABPAISA') {
          try {
            // Only auto-redirect if in ONLINE mode
            if (pgMode === 'ONLINE') {
              setIsRedirecting(true);
              window.location.href = data.paymentLink;
            }
            // In OFFLINE mode, we show the success page with manual controls
            // and the "Open Payment Page" button (which opens in new tab)
          } catch {}
        }
      }
      
      toast.success(`${transactionType} initiated successfully!`);
      if (transactionType === 'PAYOUT') {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.response?.data?.error || 'Transaction failed',
      });
      toast.error(error.response?.data?.error || 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle updating transaction status (manual)
  const handleUpdateStatus = async (transactionId: string, status: 'SUCCESS' | 'FAILED') => {
    try {
      const response = await transactionApi.updateTransactionStatus(transactionId, status);
      setResult({
        success: true,
        data: response.data.data,
      });
      toast.success(status === 'SUCCESS' 
        ? 'Payment successful! Amount credited to wallet.' 
        : 'Transaction marked as failed.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  // Check status directly with Payment Gateway (OFFLINE mode)
  const handleCheckPGStatus = async (transactionId: string) => {
    setIsCheckingStatus(true);
    try {
      const response = await transactionApi.checkPGStatus(transactionId);
      const checkResult = response.data.data;
      
      if (checkResult.autoUpdated) {
        // Status was auto-updated based on PG response
        setResult({
          success: true,
          data: checkResult.transaction,
        });
        toast.success(checkResult.message);
      } else {
        // Still pending or need manual action
        toast(checkResult.message, { icon: 'ℹ️' });
        if (checkResult.pgStatus) {
          toast(`PG Status: ${checkResult.pgStatus}`, { icon: 'ℹ️' });
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to check status with PG');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Reset form for new transaction
  const resetForm = () => {
    setResult(null);
    setAmount('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setPaymentLink('');
    setGeneratedPaymentLink('');
    setIsLinkOnlyMode(false);
    setSelectedBeneficiary('');
    setShowAddBeneficiary(false);
  };

  const handleGeneratePaymentLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!selectedPG || !amount || (transactionType === 'PAYOUT' && !selectedBeneficiary)) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsGeneratingLink(true);
    try {
      // For PAYIN: customer fields optional; fallback to logged-in user if empty
      const resolvedName =
        customerName?.trim() ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
        user?.email ||
        'Guest';
      const resolvedEmail = customerEmail?.trim() || user?.email || '';
      const resolvedPhone = customerPhone?.trim() || user?.phone || '';

      const payload: any = {
        pgId: selectedPG,
        amount: parseFloat(amount),
        type: transactionType,
        customerName: transactionType === 'PAYIN' ? resolvedName : (customerName || undefined),
        customerEmail: transactionType === 'PAYIN' ? resolvedEmail : (customerEmail || undefined),
        customerPhone: transactionType === 'PAYIN' ? resolvedPhone : (customerPhone || undefined),
      };

      if (location) {
        payload.locationLatitude = location.latitude;
        payload.locationLongitude = location.longitude;
        if (typeof location.accuracy === 'number') {
          payload.locationAccuracyM = location.accuracy;
        }
        payload.locationSource = 'WEB';
      }

      if (transactionType === 'PAYOUT') {
        payload.beneficiaryId = selectedBeneficiary;
      }

      const response = await transactionApi.createTransaction(payload);
      const txnData = response.data?.data || response.data;
      
      console.log('Transaction created:', txnData);
      
      // Use the actual payment gateway URL from the response
      let linkUrl = txnData.paymentUrl || txnData.redirectUrl;
      
      // For some gateways, the payment URL might be in the backend format
      // Convert it to a shareable link format
      if (!linkUrl && txnData.transactionId) {
        // If no direct payment URL, use backend payment endpoint
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4100';
        const pgCode = selectedPGDetails?.code?.toLowerCase();
        
        console.log('Using backend URL for payment link:', backendUrl);
        
        if (pgCode === 'sabpaisa') {
          linkUrl = `${backendUrl}/api/sabpaisa/pay/${txnData.transactionId}`;
        } else if (pgCode === 'razorpay') {
          // For Razorpay, we need the frontend URL
          linkUrl = `${window.location.origin}/payment/${txnData.transactionId}`;
        } else if (pgCode === 'cashfree') {
          // For Cashfree, we need the frontend URL
          linkUrl = `${window.location.origin}/payment/${txnData.transactionId}`;
        } else {
          // Generic fallback - use backend pay endpoint if available
          linkUrl = `${backendUrl}/api/pg/pay/${txnData.transactionId}`;
        }
      }
      
      setGeneratedPaymentLink(linkUrl);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(linkUrl);
      toast.success('🔗 Payment link copied to clipboard!');
      
      // Set link-only mode to prevent auto-redirect
      setIsLinkOnlyMode(true);
      
      // Set result to show the success screen with the link
      setResult({
        success: true,
        data: txnData,
        error: null,
      });
      
      if (txnData.paymentUrl) {
        setPaymentLink(txnData.paymentUrl);
      }
    } catch (error: any) {
      console.error('Failed to generate payment link:', error);
      toast.error(error.response?.data?.message || 'Failed to generate payment link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyPaymentLink = async () => {
    if (generatedPaymentLink) {
      await navigator.clipboard.writeText(generatedPaymentLink);
      toast.success('Payment link copied!');
    }
  };

  if (result) {
    if (isRedirecting) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white">Redirecting to Payment Gateway...</h2>
            <p className="text-white/50 mt-2">Please do not close this window</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto"
        >
          <div className={`glass rounded-2xl p-8 text-center ${
            result.success ? 'border border-emerald-500/30' : 'border border-red-500/30'
          }`}>
            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
              result.success ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              {result.success ? (
                <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
              ) : (
                <XCircleIcon className="w-10 h-10 text-red-400" />
              )}
            </div>
            
            <h2 className={`text-2xl font-bold mb-2 ${
              result.success ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {result.success ? 'Transaction Initiated!' : 'Transaction Failed'}
            </h2>
            
            {result.success ? (
              <div className="space-y-4 mt-6">
                {/* Payment Link - Show at the top if generated */}
                {generatedPaymentLink && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <p className="text-sm font-medium text-blue-400">Shareable Payment Link</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3 mb-3">
                      <p className="text-xs font-mono text-white/70 break-all">{generatedPaymentLink}</p>
                    </div>
                    <button
                      onClick={copyPaymentLink}
                      className="w-full py-2.5 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Payment Link
                    </button>
                    <p className="text-xs text-white/40 mt-2 text-center">
                      Share this link with anyone to complete the payment
                    </p>
                  </div>
                )}
                
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-sm text-white/50 mb-1">Transaction ID</p>
                  <p className="font-mono font-semibold">{result.data.transactionId}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-sm text-white/50 mb-1">Amount</p>
                    <p className="font-semibold">₹{result.data.amount?.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-sm text-white/50 mb-1">Status</p>
                    <p className="font-semibold text-amber-400">{result.data.status}</p>
                  </div>
                </div>
                
                {result.data.type === 'PAYIN' && result.data.status === 'PENDING' && !isLinkOnlyMode && (
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    {/* Mode indicator */}
                    <div className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${
                      pgMode === 'OFFLINE' 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {pgMode === 'OFFLINE' 
                        ? '🔌 Offline Mode - Use "Check Status" to verify payment'
                        : '🌐 Online Mode - Waiting for webhook callback'}
                    </div>
                    
                    <p className="text-sm text-white/60 text-center">
                      Complete payment on the gateway, then verify status below
                    </p>
                    
                    {/* SabPaisa Embedded Checkout */}
                    {result.data.type === 'PAYIN' && selectedPGDetails?.code === 'SABPAISA' && (
                      <div className="mt-4">
                        <SabpaisaCheckout
                          transactionId={result.data.transactionId}
                          amount={result.data.amount}
                          customerName={result.data.customerName || result.data.initiator?.firstName || customerName || 'Guest'}
                          customerEmail={result.data.customerEmail || result.data.initiator?.email || customerEmail || ''}
                          customerPhone={result.data.customerPhone || result.data.initiator?.phone || customerPhone || ''}
                          autoSubmit={pgMode === 'ONLINE'}
                          onSuccess={(txnId) => {
                            toast.success('Payment initiated successfully');
                          }}
                          onError={(error) => {
                            toast.error(error);
                          }}
                        />
                      </div>
                    )}

                    {paymentLink && selectedPGDetails?.code !== 'RAZORPAY' && selectedPGDetails?.code !== 'CASHFREE' && selectedPGDetails?.code !== 'SABPAISA' && (
                      <a
                        href={paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-center hover:from-blue-600 hover:to-cyan-600 transition-all"
                      >
                        🔗 Open Payment Page
                      </a>
                    )}

                    {/* Razorpay Embedded Checkout */}
                    {result.data.type === 'PAYIN' && selectedPGDetails?.code === 'RAZORPAY' && (
                      <div className="mt-4 flex flex-col items-center">
                        <RazorpayCheckout
                          transactionId={result.data.id}
                          amount={result.data.amount}
                          customerName={result.data.customerName || result.data.initiator?.firstName || customerName || 'Guest'}
                          customerEmail={result.data.customerEmail || result.data.initiator?.email || customerEmail || ''}
                          customerPhone={result.data.customerPhone || result.data.initiator?.phone || customerPhone || ''}
                          description={`Payin Transaction ${result.data.id}`}
                          autoOpen={true}
                          onSuccess={(paymentId, orderId) => {
                            toast.success('Payment completed successfully!');
                            // Backend is already updated via verify endpoint, just update local UI
                            setResult((prev: any) => ({
                              ...prev,
                              data: {
                                ...prev.data,
                                status: 'SUCCESS'
                              }
                            }));
                          }}
                          onError={(err) => {
                            toast.error(`Payment failed: ${err}`);
                          }}
                        />
                        <p className="text-xs text-white/40 mt-2">
                          Secure payment via Razorpay
                        </p>
                      </div>
                    )}

                    {/* Cashfree Embedded Checkout */}
                    {result.data.type === 'PAYIN' && selectedPGDetails?.code === 'CASHFREE' && (() => {
                      let paymentSessionId = '';
                      let environment = 'sandbox';
                      try {
                        if (result.data.pgResponse) {
                          const parsed = JSON.parse(result.data.pgResponse);
                          paymentSessionId = parsed.raw?.paymentSessionId;
                          environment = parsed.raw?.environment || 'sandbox';
                        }
                      } catch (e) {
                        console.error('Failed to parse pgResponse', e);
                      }

                      if (!paymentSessionId) return null;

                      return (
                        <div className="mt-4 flex flex-col items-center">
                          <CashfreeCheckout
                            transactionId={result.data.id}
                            paymentSessionId={paymentSessionId}
                            amount={result.data.amount}
                            autoOpen={true}
                            isProduction={environment === 'production'}
                            onSuccess={(orderId) => {
                              toast.success('Payment completed successfully!');
                              setResult((prev: any) => ({
                                ...prev,
                                data: {
                                  ...prev.data,
                                  status: 'SUCCESS'
                                }
                              }));
                            }}
                            onError={(err) => {
                              toast.error(`Payment failed: ${err}`);
                            }}
                          />
                          <p className="text-xs text-white/40 mt-2">
                            Secure payment via Cashfree
                          </p>
                        </div>
                      );
                    })()}
                    
                    {/* Check Status and manual controls - show only in OFFLINE mode */}
                    {pgMode === 'OFFLINE' && (
                      <>
                        <button
                          onClick={() => handleCheckPGStatus(result.data.id)}
                          disabled={isCheckingStatus}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50"
                        >
                          {isCheckingStatus ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Checking with PG...
                            </span>
                          ) : (
                            '🔍 Check Status with Payment Gateway'
                          )}
                        </button>
                        
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-[#0a0a0f] text-white/40">or manually update</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => handleUpdateStatus(result.data.id, 'SUCCESS')}
                            className="py-3 px-4 rounded-xl bg-emerald-500/20 text-emerald-400 font-semibold hover:bg-emerald-500/30 transition-all border border-emerald-500/30"
                          >
                            ✓ Mark as Success
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(result.data.id, 'FAILED')}
                            className="py-3 px-4 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-all border border-red-500/30"
                          >
                            ✗ Mark as Failed
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Link-only mode message */}
                {isLinkOnlyMode && result.data.status === 'PENDING' && (
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-sm text-white/60 text-center">
                      ✅ Payment link created successfully. Share the link above with your customer to complete the payment.
                    </p>
                  </div>
                )}
                
                {result.data.status !== 'PENDING' && (
                  <p className="text-sm text-white/50 text-center">
                    {result.data.status === 'SUCCESS' 
                      ? '✓ Amount credited to wallet after commission deduction'
                      : 'Transaction was not successful'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-white/60 mt-4">{result.error}</p>
            )}
            
            <div className="flex gap-4 mt-8">
              <button
                onClick={resetForm}
                className="flex-1 btn-secondary"
              >
                New Transaction
              </button>
              <button
                onClick={() => router.push('/dashboard/transactions')}
                className="flex-1 btn-primary"
              >
                View Transactions
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">New Transaction</h1>
            <p className="text-white/50">Initiate a new payin or payout</p>
          </div>
        </div>

        {/* Transaction Type Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-2 mb-6"
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTransactionType('PAYIN')}
              className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all ${
                transactionType === 'PAYIN'
                  ? 'bg-emerald-500 text-white'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <ArrowDownIcon className="w-5 h-5" />
              <span>Payin</span>
            </button>
            <button
              onClick={() => setTransactionType('PAYOUT')}
              className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all ${
                transactionType === 'PAYOUT'
                  ? 'bg-violet-500 text-white'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <ArrowUpIcon className="w-5 h-5" />
              <span>Payout</span>
            </button>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit}>
          {/* Select Payment Gateway — compact for PAYOUT (single PG name, small box) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`glass rounded-2xl mb-6 ${transactionType === 'PAYOUT' ? 'p-2.5 mb-3' : 'p-6'}`}
          >
            <h3 className={`font-semibold flex items-center gap-2 ${transactionType === 'PAYOUT' ? 'mb-2 text-sm' : 'mb-4'}`}>
              <CreditCardIcon className={transactionType === 'PAYOUT' ? 'w-4 h-4' : 'w-5 h-5'} />
              Select Payment Gateway
            </h3>
            
            {loadingPGs ? (
              <div className={`flex items-center justify-center ${transactionType === 'PAYOUT' ? 'py-3' : 'py-8'}`}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
              </div>
            ) : filteredPGs.length === 0 ? (
              <div className={`text-center text-white/50 ${transactionType === 'PAYOUT' ? 'py-3 text-xs' : 'py-8'}`}>
                <p className="text-sm">No payment gateways available for {transactionType.toLowerCase()}</p>
                <p className="text-xs mt-1">Contact your administrator to get gateways assigned.</p>
              </div>
            ) : (
              <div className={`grid gap-2 ${transactionType === 'PAYOUT' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 gap-4'}`}>
                {filteredPGs.map((pg: any) => (
                  <div
                    key={pg.id}
                    className={`relative rounded-lg border-2 text-left transition-all ${
                      transactionType === 'PAYOUT' ? 'p-2' : 'p-4'
                    } ${
                      selectedPG === pg.id
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-white/10 hover:border-white/30 bg-white/5'
                    }`}
                  >
                    {transactionType === 'PAYIN' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setRatesModalPGCode(pg.code);
                          setShowRatesModal(true);
                          setLoadingRatesModal(true);
                          try {
                            const res = await rateApi.getMyPayinRates();
                            const data = res.data?.data?.ratesByPG ?? {};
                            setRatesModalData(data);
                          } catch {
                            setRatesModalData(null);
                            toast.error('Could not load rate details');
                          } finally {
                            setLoadingRatesModal(false);
                          }
                        }}
                        className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
                        title={`View rate details for ${pg.name}`}
                      >
                        <InformationCircleIcon className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedPG(pg.id)}
                      className="w-full text-left"
                    >
                      <div className={`flex items-center gap-2 ${transactionType === 'PAYOUT' ? 'gap-2' : 'gap-3 mb-2'}`}>
                        <div className={`rounded-lg bg-white/10 flex items-center justify-center shrink-0 ${transactionType === 'PAYOUT' ? 'w-7 h-7' : 'w-10 h-10'}`}>
                          <CreditCardIcon className={transactionType === 'PAYOUT' ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
                        </div>
                        <div className="min-w-0">
                          <p className={`font-medium truncate ${transactionType === 'PAYOUT' ? 'text-sm' : ''}`}>{pg.name}</p>
                          {transactionType === 'PAYIN' && (
                            <p className="text-xs text-white/50">{pg.code}</p>
                          )}
                        </div>
                      </div>
                      {/* Rate row: only for PAYIN; PAYOUT uses slabs (not shown here) */}
                      {transactionType === 'PAYIN' && (
                        <>
                          <div className="flex justify-between text-sm items-center mt-2">
                            <span className="text-white/50">Rate (VISA normal):</span>
                            <span className="text-emerald-400 font-medium">
                              {`${pg.customPayinRate ?? pg.payinRate ?? 0}%`}
                            </span>
                          </div>
                          {pg.minTransaction && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-white/50">Min:</span>
                              <span>₹{pg.minTransaction?.toLocaleString()}</span>
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Payin rates (i) modal – all rates as per schema */}
          {showRatesModal && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => { setShowRatesModal(false); setRatesModalPGCode(null); }}
            >
              <div
                className="bg-slate-900 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-hidden border border-white/10 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {ratesModalPGCode
                      ? `Rates for ${(availablePGs as any[]).find((p: any) => p.code === ratesModalPGCode)?.name || ratesModalPGCode}`
                      : 'Rates as per your schema'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setShowRatesModal(false); setRatesModalPGCode(null); }}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/70"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-white/50 mb-4">
                  Payin rates by card/channel (schema rates). Your charges are based on these.
                </p>
                <div className="overflow-y-auto max-h-[60vh] space-y-4">
                  {loadingRatesModal ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
                    </div>
                  ) : ratesModalData && Object.keys(ratesModalData).length > 0 ? (
                    (() => {
                      const entries = ratesModalPGCode
                        ? Object.entries(ratesModalData).filter(([code]) => (code || '').toLowerCase() === (ratesModalPGCode || '').toLowerCase())
                        : Object.entries(ratesModalData);
                      return entries.map(([pgCode, pgData]: [string, any]) => {
                        const pgName = (availablePGs as any[]).find((p: any) => p.code === pgCode)?.name || pgCode;
                        return (
                      <div key={pgCode} className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h4 className="font-medium text-white mb-2">{pgName}</h4>
                        <div className="grid gap-1.5 text-sm">
                          {(pgData.rates || []).map((r: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-white/80">
                              <span>{r.channelName || r.channelCode}</span>
                              <span className="font-mono text-emerald-400">
                                {r.schemaRateDisplay ?? (r.schemaRate != null ? `${(Number(r.schemaRate) * 100).toFixed(2)}%` : r.rateDisplay)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ); });
                    })()
                  ) : (
                    <p className="text-white/50">No rate details available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payout Account — above Transaction Details when PAYOUT */}
          {transactionType === 'PAYOUT' && (
            <>
              {/* When profile loaded: two-column layout (main | beneficiary side panel) for better visibility and less page scroll */}
              {currentProfile ? (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(300px,360px)] gap-6 items-start mb-6">
                  {/* Left: Payout Account card (profile + add beneficiary only) */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass rounded-2xl p-6"
                  >
                    <h3 className="font-semibold flex items-center gap-2 mb-4">
                      <BuildingLibraryIcon className="w-5 h-5 text-violet-400" />
                      Payout Account
                    </h3>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <p className="text-white font-medium">{currentProfile.name}</p>
                        <p className="text-sm text-white/50">Mobile: {currentProfile.mobile}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCurrentProfile(null); setProfileMobile(''); setShowCreateProfileForm(false); setSelectedBeneficiary(''); }}
                        className="text-sm text-violet-400 hover:text-violet-300"
                      >
                        Use different number
                      </button>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-white/70">Add beneficiary</span>
                      <button
                        type="button"
                        onClick={() => setShowAddBeneficiary(!showAddBeneficiary)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 text-sm font-medium transition-colors"
                      >
                        <UserPlusIcon className="w-4 h-4" />
                        {showAddBeneficiary ? 'Cancel' : 'Add New'}
                      </button>
                    </div>
                    {showAddBeneficiary && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 bg-white/5 rounded-xl border border-violet-500/20"
                      >
                        <h4 className="font-medium mb-4 text-violet-400">Add New Beneficiary</h4>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/70 mb-1">Name *</label>
                              <input
                                type="text"
                                value={newBeneficiary.name}
                                onChange={(e) => { setNewBeneficiary({ ...newBeneficiary, name: e.target.value }); setBeneficiaryErrors(prev => ({ ...prev, name: '' })); }}
                                className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white text-sm ${beneficiaryErrors.name ? 'border-red-500' : 'border-white/10'}`}
                                placeholder="Account holder name"
                              />
                              {beneficiaryErrors.name && <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.name}</p>}
                            </div>
                            <div>
                              <label className="block text-sm text-white/70 mb-1">Nick Name</label>
                              <input type="text" value={newBeneficiary.nickName} onChange={(e) => setNewBeneficiary({ ...newBeneficiary, nickName: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm" placeholder="e.g., Office Rent" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/70 mb-1">Account Number *</label>
                              <input type="text" value={newBeneficiary.accountNumber} onChange={(e) => { setNewBeneficiary({ ...newBeneficiary, accountNumber: e.target.value.replace(/\D/g, '') }); setBeneficiaryErrors(prev => ({ ...prev, accountNumber: '' })); }} className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white font-mono text-sm ${beneficiaryErrors.accountNumber ? 'border-red-500' : 'border-white/10'}`} placeholder="1234567890" maxLength={18} />
                              {beneficiaryErrors.accountNumber && <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.accountNumber}</p>}
                            </div>
                            <div>
                              <label className="block text-sm text-white/70 mb-1">IFSC Code *</label>
                              <div className="relative">
                                <input type="text" value={newBeneficiary.ifscCode} onChange={(e) => { setNewBeneficiary({ ...newBeneficiary, ifscCode: e.target.value.toUpperCase() }); setBeneficiaryErrors(prev => ({ ...prev, ifscCode: '' })); }} className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white font-mono text-sm uppercase ${beneficiaryErrors.ifscCode ? 'border-red-500' : ifscDetails?.valid ? 'border-emerald-500' : 'border-white/10'}`} placeholder="HDFC0001234" maxLength={11} />
                                {isLookingUpIfsc && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />}
                                {ifscDetails?.valid && !isLookingUpIfsc && <CheckCircleIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
                              </div>
                              {beneficiaryErrors.ifscCode && <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.ifscCode}</p>}
                            </div>
                          </div>
                          {ifscDetails?.valid && (
                            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                              <p className="text-sm text-emerald-400 font-medium">{ifscDetails.bank}</p>
                              {ifscDetails.branch && <p className="text-xs text-white/60">{ifscDetails.branch}, {ifscDetails.city}</p>}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/70 mb-1">Account Type</label>
                              <select value={newBeneficiary.accountType} onChange={(e) => setNewBeneficiary({ ...newBeneficiary, accountType: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
                                <option value="SAVINGS">Savings</option>
                                <option value="CURRENT">Current</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-white/70 mb-1">Mobile Number</label>
                              <input type="tel" value={newBeneficiary.phone} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setNewBeneficiary({ ...newBeneficiary, phone: v }); setBeneficiaryErrors(prev => ({ ...prev, phone: '' })); }} className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white text-sm ${beneficiaryErrors.phone ? 'border-red-500' : 'border-white/10'}`} placeholder="9876543210" maxLength={10} />
                              {beneficiaryErrors.phone && <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.phone}</p>}
                            </div>
                          </div>
                          <button type="button" onClick={handleAddBeneficiary} disabled={addBeneficiaryMutation.isPending} className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50">
                            {addBeneficiaryMutation.isPending ? 'Adding...' : 'Add Beneficiary'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Right: Beneficiary list side panel — sticky on desktop, scrollable fixed height on mobile */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-2xl p-4 lg:p-5 flex flex-col lg:sticky lg:top-4 min-h-[280px] max-h-[55vh] lg:max-h-[calc(100vh-6rem)]"
                  >
                    <h3 className="font-semibold text-violet-400 mb-3 flex items-center gap-2 text-sm lg:text-base">
                      <BanknotesIcon className="w-5 h-5" />
                      Select Beneficiary
                    </h3>
                    {loadingBeneficiaryList ? (
                      <div className="flex items-center justify-center flex-1 py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" />
                      </div>
                    ) : beneficiaries.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-6 text-white/50 text-center">
                        <BanknotesIcon className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm font-medium text-white/70">No beneficiaries yet</p>
                        <p className="text-xs mt-1">Add one using &quot;Add New&quot; on the left</p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                              type="text"
                              value={beneficiarySearch}
                              onChange={(e) => setBeneficiarySearch(e.target.value)}
                              placeholder="Search name, bank, IFSC..."
                              className="w-full pl-8 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                            />
                            {beneficiarySearch && (
                              <button type="button" onClick={() => setBeneficiarySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-white/50 mt-1">{filteredBeneficiaries.length} found</p>
                        </div>
                        {filteredBeneficiaries.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center py-4 text-white/50 text-center">
                            <p className="text-sm">No match for search.</p>
                            <button type="button" onClick={() => setBeneficiarySearch('')} className="mt-2 text-violet-400 hover:text-violet-300 text-sm">Clear</button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 -mx-1 px-1">
                              {paginatedBeneficiaries.map((benef: any) => (
                                <button
                                  key={benef.id}
                                  type="button"
                                  onClick={() => setSelectedBeneficiary(benef.id)}
                                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${selectedBeneficiary === benef.id ? 'border-violet-500 bg-violet-500/15' : 'border-white/10 hover:border-white/30 bg-white/5'}`}
                                >
                                  <p className="font-semibold text-white text-sm truncate">{benef.name}</p>
                                  {benef.nickName && <p className="text-xs text-white/50 truncate">{benef.nickName}</p>}
                                  <p className="text-xs text-white/60 mt-1 font-mono">****{String(benef.accountNumber).slice(-4)} · {benef.ifscCode}</p>
                                  {benef.isVerified && <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs">Verified</span>}
                                </button>
                              ))}
                            </div>
                            {totalBeneficiaryPages > 1 && (
                              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-white/10 shrink-0">
                                <span className="text-xs text-white/50">Page {beneficiaryPage} of {totalBeneficiaryPages}</span>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => setBeneficiaryPage((p) => Math.max(1, p - 1))} disabled={beneficiaryPage <= 1} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white"><ChevronLeftIcon className="w-4 h-4" /></button>
                                  <button type="button" onClick={() => setBeneficiaryPage((p) => Math.min(totalBeneficiaryPages, p + 1))} disabled={beneficiaryPage >= totalBeneficiaryPages} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white"><ChevronRightIcon className="w-4 h-4" /></button>
                                </div>
                              </div>
                            )}
                            {selectedBeneficiaryDetails && (
                              <div className="mt-3 p-2.5 bg-violet-500/10 rounded-lg border border-violet-500/20 shrink-0">
                                <p className="text-xs text-white/50">Payout to</p>
                                <p className="font-medium text-white text-sm">{selectedBeneficiaryDetails.name}</p>
                                <p className="text-xs text-white/60 font-mono">{selectedBeneficiaryDetails.accountNumber} · {selectedBeneficiaryDetails.ifscCode}</p>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </motion.div>
                </div>
              ) : (
                /* Step 1: No profile — full-width Payout Account card (mobile / create profile) */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="glass rounded-2xl p-6 mb-6"
                >
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <BuildingLibraryIcon className="w-5 h-5 text-violet-400" />
                    Payout Account
                  </h3>
                  <div className="space-y-4">
                  {!showCreateProfileForm ? (
                    <>
                      <p className="text-sm text-white/60">Enter the mobile number linked to your payout profile. You can have up to 3 profiles.</p>
                      <div className="flex gap-3 flex-wrap">
                        <input
                          type="tel"
                          value={profileMobile}
                          onChange={(e) => setProfileMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile number"
                          className="flex-1 min-w-[180px] px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono"
                          maxLength={10}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const m = profileMobile.replace(/\D/g, '').slice(-10);
                            if (m.length !== 10 || !/^[6-9]/.test(m)) {
                              toast.error('Enter a valid 10-digit mobile number');
                              return;
                            }
                            lookupProfileMutation.mutate(m);
                          }}
                          disabled={lookupProfileMutation.isPending}
                          className="px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium disabled:opacity-50"
                        >
                          {lookupProfileMutation.isPending ? 'Finding...' : 'Find / Continue'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-white/60">No profile for this number. Create one (max 3 profiles per user).</p>
                      <div className="p-4 bg-white/5 rounded-xl border border-violet-500/20 space-y-4">
                        <div>
                          <label className="block text-sm text-white/70 mb-1">Mobile</label>
                          <p className="font-mono text-white">{profileMobile || '—'}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-white/70 mb-1">Name *</label>
                          <input
                            type="text"
                            value={newProfile.name}
                            onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            placeholder="Full name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-white/70 mb-1">Email</label>
                          <input
                            type="email"
                            value={newProfile.email}
                            onChange={(e) => setNewProfile({ ...newProfile, email: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            placeholder="email@example.com"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => createProfileMutation.mutate({ mobile: profileMobile.replace(/\D/g, '').slice(-10), name: newProfile.name.trim(), email: newProfile.email.trim() || undefined })}
                            disabled={createProfileMutation.isPending || !newProfile.name.trim()}
                            className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium disabled:opacity-50"
                          >
                            {createProfileMutation.isPending ? 'Creating...' : 'Create Profile'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCreateProfileForm(false)}
                            className="px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                  </motion.div>
              )}
            </>
          )}
          {/* Transaction Details — below Payout Account for PAYOUT */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 mb-6"
          >
            <h3 className="font-semibold mb-4">Transaction Details</h3>
            
            {/* For PAYOUT: wallet balance and beneficiary summary */}
            {transactionType === 'PAYOUT' && (
              <div className="mb-4 space-y-3">
                <div className="p-3 rounded-xl border bg-white/5 border-white/10 flex items-center justify-between">
                  <span className="text-sm text-white/70 flex items-center gap-2">
                    <WalletIcon className="w-5 h-5 text-violet-400" />
                    Available balance
                  </span>
                  <span className="font-semibold text-white">
                    ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {payoutChargeResult != null && (
                  <div className="p-3 rounded-xl border bg-white/5 border-white/10 flex items-center justify-between text-sm">
                    <span className="text-white/70">Total deduction (amount + charges)</span>
                    <span className="font-medium text-violet-300">
                      ₹{payoutChargeResult.totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {insufficientBalance && (
                  <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
                    <ExclamationCircleIcon className="w-5 h-5 shrink-0" />
                    Insufficient balance. Required ₹{payoutChargeResult?.totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Add funds to wallet to proceed.
                  </div>
                )}
                {selectedBeneficiaryDetails && (
                  <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
                    <p className="text-xs text-white/50 mb-1">Beneficiary (auto-loaded)</p>
                    <p className="font-medium text-white">{selectedBeneficiaryDetails.name}</p>
                    <p className="text-sm text-white/70 font-mono mt-0.5">
                      A/C: {selectedBeneficiaryDetails.accountNumber} • IFSC: {selectedBeneficiaryDetails.ifscCode}
                    </p>
                    {selectedBeneficiaryDetails.bankName && (
                      <p className="text-xs text-white/50 mt-1">{selectedBeneficiaryDetails.bankName}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  {transactionType === 'PAYOUT' ? 'Payout Amount (₹)' : 'Amount (₹)'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-semibold placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="Enter amount"
                  min="1"
                  required
                />
                {transactionType === 'PAYOUT' && (
                  <p className="text-xs text-white/50 mt-1">Amount to be sent to beneficiary</p>
                )}
              </div>
              
              {/* Payout Charges Breakdown with Slabs */}
              {transactionType === 'PAYOUT' && amount && parseFloat(amount) > 0 && selectedPGDetails && (
                <PayoutChargesBreakdown 
                  amount={parseFloat(amount)} 
                  pgId={selectedPG}
                />
              )}
              
              {/* Customer fields: only for PAYIN; optional - uses your profile if empty */}
              {transactionType !== 'PAYOUT' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-2">Customer Name (optional)</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        placeholder="Uses your name if empty"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-2">Customer Phone (optional)</label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        placeholder="Uses your phone if empty"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Customer Email (optional)</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      placeholder="Uses your email if empty"
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* PCI Compliance Notice for Payin */}
          {transactionType === 'PAYIN' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6 mb-6 border border-blue-500/20"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <CreditCardIcon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Secure Payment</h3>
                  <p className="text-white/60 text-sm">
                    You will be redirected to <span className="text-primary-400 font-medium">{selectedPGDetails?.name || 'Payment Gateway'}</span>'s 
                    secure page to complete the payment. Card details are never stored on our servers.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
                    <span className="px-2 py-1 rounded bg-white/5">🔒 PCI DSS Compliant</span>
                    <span className="px-2 py-1 rounded bg-white/5">🛡️ 256-bit Encryption</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Show what's missing or insufficient balance */}
            {(insufficientBalance || !selectedPG || !amount || (transactionType === 'PAYOUT' && !selectedBeneficiary)) && (
              <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-sm text-amber-400">
                  {insufficientBalance
                    ? 'Insufficient wallet balance. Add funds or reduce amount to proceed.'
                    : `Please complete: ${[
                        !selectedPG && 'Select a payment gateway',
                        !amount && 'Enter amount',
                        transactionType === 'PAYOUT' && !selectedBeneficiary && 'Select a beneficiary',
                      ].filter(Boolean).join(', ')}`}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !selectedPG || !amount || (transactionType === 'PAYOUT' && !selectedBeneficiary) || insufficientBalance}
                className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  transactionType === 'PAYIN'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                    : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  `Initiate ${transactionType}`
                )}
              </button>
              
              {transactionType === 'PAYIN' && (
                <button
                  type="button"
                  onClick={handleGeneratePaymentLink}
                  disabled={isGeneratingLink || !selectedPG || !amount}
                  className="px-6 py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 flex items-center gap-2 whitespace-nowrap"
                  title="Generate a shareable payment link"
                >
                  {isGeneratingLink ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">Copy Link</span>
                </button>
              )}
            </div>
          </motion.div>
        </form>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function NewTransactionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    }>
      <NewTransactionContent />
    </Suspense>
  );
}

