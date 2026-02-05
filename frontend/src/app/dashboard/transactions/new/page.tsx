'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pgApi, transactionApi, beneficiaryApi, configApi, systemSettingsApi } from '@/lib/api';
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
  TableCellsIcon,
} from '@heroicons/react/24/outline';

// Payout Charges Breakdown Component with Slab Support
function PayoutChargesBreakdown({ amount, pgId }: { amount: number; pgId: string }) {
  const { data: configData, isLoading } = useQuery({
    queryKey: ['global-payout-config'],
    queryFn: () => systemSettingsApi.getPayoutConfig(),
  });

  const config = configData?.data?.data;
  const slabs = config?.slabs || [];
  const chargeType = (config?.payoutChargeType || 'SLAB') as 'SLAB' | 'PERCENTAGE';

  // Find applicable slab
  const applicableSlab = slabs.find((slab: any) => 
    amount >= slab.minAmount && (slab.maxAmount === null || amount <= slab.maxAmount)
  );

  // Calculate charges
  let charges = 0;
  let slabLabel = '';
  
  if (chargeType === 'PERCENTAGE') {
    const rate = config?.payoutRate || 0;
    charges = amount * rate;
    slabLabel = `${(rate * 100).toFixed(2)}%`;
  } else if (applicableSlab) {
    charges = applicableSlab.flatCharge;
    slabLabel = applicableSlab.maxAmount 
      ? `₹${applicableSlab.minAmount.toLocaleString()} - ₹${applicableSlab.maxAmount.toLocaleString()}`
      : `Above ₹${applicableSlab.minAmount.toLocaleString()}`;
  } else {
    // Default fallback
    charges = 25;
    slabLabel = 'Default';
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
      <h4 className="text-sm font-medium text-violet-400 mb-3 flex items-center gap-2">
        <TableCellsIcon className="w-4 h-4" />
        Payout Charges (Slab-Based)
      </h4>
      
      {/* Slab Table */}
      <div className="mb-4 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/5">
              <th className="px-3 py-2 text-left text-white/50 font-medium">Amount Range</th>
              <th className="px-3 py-2 text-right text-white/50 font-medium">Charge</th>
            </tr>
          </thead>
          <tbody>
            {slabs.map((slab: any, index: number) => {
              const isActive = applicableSlab?.id === slab.id || 
                (applicableSlab?.minAmount === slab.minAmount && applicableSlab?.flatCharge === slab.flatCharge);
              return (
                <tr 
                  key={slab.id || index} 
                  className={`border-t border-white/5 ${isActive ? 'bg-violet-500/20' : ''}`}
                >
                  <td className="px-3 py-2">
                    {slab.maxAmount 
                      ? `₹${slab.minAmount.toLocaleString()} - ₹${slab.maxAmount.toLocaleString()}`
                      : `Above ₹${slab.minAmount.toLocaleString()}`
                    }
                    {isActive && <span className="ml-2 text-violet-400">←</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    ₹{slab.flatCharge}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Calculation */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Payout Amount:</span>
          <span>₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">
            Charges ({slabLabel}):
          </span>
          <span className="text-amber-400">+ ₹{charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="flex justify-between font-semibold">
            <span>Total Wallet Deduction:</span>
            <span className="text-violet-400">₹{totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-2">
          ₹{amount.toLocaleString('en-IN')} will be sent to beneficiary. ₹{charges.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is the flat service charge for this slab.
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

  // Fetch beneficiaries for payout
  const { data: beneficiariesData, isLoading: loadingBeneficiaries } = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: () => beneficiaryApi.getBeneficiaries({ isActive: true }),
    enabled: isAuthenticated && transactionType === 'PAYOUT',
  });

  // Fetch Global Payout Config for auto-selection
  const { data: globalPayoutConfig } = useQuery({
    queryKey: ['global-payout-config'],
    queryFn: () => systemSettingsApi.getPayoutConfig(),
    enabled: isAuthenticated && transactionType === 'PAYOUT',
  });
  
  const activePayoutPgId = globalPayoutConfig?.data?.data?.activePgId;

  const availablePGs = pgsData?.data?.data || pgsData?.data || [];
  const beneficiaries = beneficiariesData?.data?.data || [];
  
  // Filter PGs based on transaction type - check supportedTypes string
  const filteredPGs = Array.isArray(availablePGs) ? availablePGs.filter((pg: any) => {
    const supportedTypes = pg.supportedTypes || 'PAYIN,PAYOUT';
    if (transactionType === 'PAYIN') {
      return supportedTypes.includes('PAYIN') || pg.supportsPayin;
    } else {
      return supportedTypes.includes('PAYOUT') || pg.supportsPayout;
    }
  }) : [];
  
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

  // Add beneficiary mutation
  const addBeneficiaryMutation = useMutation({
    mutationFn: (data: any) => beneficiaryApi.createBeneficiary(data),
    onSuccess: (response) => {
      const newBenef = response.data.data;
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
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
    addBeneficiaryMutation.mutate(newBeneficiary);
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
      const payload: any = {
        type: transactionType,
        pgId: selectedPG,
        amount: parseFloat(amount),
        customerName,
        customerEmail,
        customerPhone,
      };

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
        toast.info(checkResult.message);
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
      const payload: any = {
        pgId: selectedPG,
        amount: parseFloat(amount),
        type: transactionType,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
      };

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
                          customerName={customerName}
                          customerEmail={customerEmail}
                          customerPhone={customerPhone}
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
                          customerName={result.data.initiator?.firstName || customerName || 'Guest'}
                          customerEmail={result.data.initiator?.email || customerEmail || ''}
                          customerPhone={result.data.initiator?.phone || customerPhone || ''}
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
          {/* Select Payment Gateway */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6 mb-6"
          >
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCardIcon className="w-5 h-5 text-primary-400" />
              Select Payment Gateway
            </h3>
            
            {loadingPGs ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
              </div>
            ) : filteredPGs.length === 0 ? (
              <div className="text-center py-8 text-white/50">
                <p>No payment gateways available for {transactionType.toLowerCase()}</p>
                <p className="text-sm mt-2">Contact your administrator to get gateways assigned.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPGs.map((pg: any) => (
                  <button
                    key={pg.id}
                    type="button"
                    onClick={() => setSelectedPG(pg.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedPG === pg.id
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-white/10 hover:border-white/30 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <CreditCardIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{pg.name}</p>
                        <p className="text-xs text-white/50">{pg.code}</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Rate:</span>
                      <span className={transactionType === 'PAYIN' ? 'text-emerald-400' : 'text-violet-400'}>
                        {transactionType === 'PAYIN' 
                          ? `${pg.customPayinRate || pg.payinRate || 0}%`
                          : `${pg.customPayoutRate || pg.payoutRate || 0}%`
                        }
                      </span>
                    </div>
                    {pg.minTransaction && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-white/50">Min:</span>
                        <span>₹{pg.minTransaction?.toLocaleString()}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Amount & Customer Details */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 mb-6"
          >
            <h3 className="font-semibold mb-4">Transaction Details</h3>
            
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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Customer Phone</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="9876543210"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="customer@example.com"
                />
              </div>
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

          {/* Beneficiary Selection for Payout */}
          {transactionType === 'PAYOUT' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <BuildingLibraryIcon className="w-5 h-5 text-violet-400" />
                  Select Beneficiary
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddBeneficiary(!showAddBeneficiary)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 text-sm font-medium transition-colors"
                >
                  <UserPlusIcon className="w-4 h-4" />
                  {showAddBeneficiary ? 'Cancel' : 'Add New'}
                </button>
              </div>
              
              {/* Add New Beneficiary Form */}
              {showAddBeneficiary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 bg-white/5 rounded-xl border border-violet-500/20"
                >
                  <h4 className="font-medium mb-4 text-violet-400">Add New Beneficiary</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Name *</label>
                        <input
                          type="text"
                          value={newBeneficiary.name}
                          onChange={(e) => {
                            setNewBeneficiary({ ...newBeneficiary, name: e.target.value });
                            setBeneficiaryErrors(prev => ({ ...prev, name: '' }));
                          }}
                          className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white text-sm ${
                            beneficiaryErrors.name ? 'border-red-500' : 'border-white/10'
                          }`}
                          placeholder="Account holder name"
                        />
                        {beneficiaryErrors.name && (
                          <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Nick Name</label>
                        <input
                          type="text"
                          value={newBeneficiary.nickName}
                          onChange={(e) => setNewBeneficiary({ ...newBeneficiary, nickName: e.target.value })}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                          placeholder="e.g., Office Rent"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Account Number *</label>
                        <input
                          type="text"
                          value={newBeneficiary.accountNumber}
                          onChange={(e) => {
                            setNewBeneficiary({ ...newBeneficiary, accountNumber: e.target.value.replace(/\D/g, '') });
                            setBeneficiaryErrors(prev => ({ ...prev, accountNumber: '' }));
                          }}
                          className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white font-mono text-sm ${
                            beneficiaryErrors.accountNumber ? 'border-red-500' : 'border-white/10'
                          }`}
                          placeholder="1234567890"
                          maxLength={18}
                        />
                        {beneficiaryErrors.accountNumber && (
                          <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.accountNumber}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">IFSC Code *</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={newBeneficiary.ifscCode}
                            onChange={(e) => {
                              setNewBeneficiary({ ...newBeneficiary, ifscCode: e.target.value.toUpperCase() });
                              setBeneficiaryErrors(prev => ({ ...prev, ifscCode: '' }));
                            }}
                            className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white font-mono text-sm uppercase ${
                              beneficiaryErrors.ifscCode ? 'border-red-500' : ifscDetails?.valid ? 'border-emerald-500' : 'border-white/10'
                            }`}
                            placeholder="HDFC0001234"
                            maxLength={11}
                          />
                          {isLookingUpIfsc && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                          )}
                          {ifscDetails?.valid && !isLookingUpIfsc && (
                            <CheckCircleIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        {beneficiaryErrors.ifscCode && (
                          <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.ifscCode}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Bank details from IFSC */}
                    {ifscDetails?.valid && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20"
                      >
                        <p className="text-sm text-emerald-400 font-medium">{ifscDetails.bank}</p>
                        {ifscDetails.branch && (
                          <p className="text-xs text-white/60">{ifscDetails.branch}, {ifscDetails.city}</p>
                        )}
                      </motion.div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Account Type</label>
                        <select
                          value={newBeneficiary.accountType}
                          onChange={(e) => setNewBeneficiary({ ...newBeneficiary, accountType: e.target.value })}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        >
                          <option value="SAVINGS">Savings</option>
                          <option value="CURRENT">Current</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Mobile Number</label>
                        <input
                          type="tel"
                          value={newBeneficiary.phone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setNewBeneficiary({ ...newBeneficiary, phone: value });
                            setBeneficiaryErrors(prev => ({ ...prev, phone: '' }));
                          }}
                          className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white text-sm ${
                            beneficiaryErrors.phone ? 'border-red-500' : 'border-white/10'
                          }`}
                          placeholder="9876543210"
                          maxLength={10}
                        />
                        {beneficiaryErrors.phone && (
                          <p className="text-red-400 text-xs mt-1">{beneficiaryErrors.phone}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddBeneficiary}
                      disabled={addBeneficiaryMutation.isPending}
                      className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50"
                    >
                      {addBeneficiaryMutation.isPending ? 'Adding...' : 'Add Beneficiary'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Beneficiary List */}
              {loadingBeneficiaries ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
                </div>
              ) : beneficiaries.length === 0 ? (
                <div className="text-center py-8 text-white/50">
                  <BanknotesIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No beneficiaries added yet</p>
                  <p className="text-sm mt-1">Click "Add New" to register a beneficiary</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {beneficiaries.map((benef: any) => (
                    <button
                      key={benef.id}
                      type="button"
                      onClick={() => setSelectedBeneficiary(benef.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedBeneficiary === benef.id
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-white/10 hover:border-white/30 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{benef.name}</p>
                          {benef.nickName && (
                            <p className="text-sm text-white/50">{benef.nickName}</p>
                          )}
                        </div>
                        {benef.isVerified && (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-white/60">
                        <span className="font-mono">A/C: ****{benef.accountNumber.slice(-4)}</span>
                        <span>{benef.bankName || benef.ifscCode}</span>
                        <span className="capitalize">{benef.accountType?.toLowerCase()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Selected Beneficiary Summary */}
              {selectedBeneficiaryDetails && (
                <div className="mt-4 p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
                  <p className="text-sm text-white/50 mb-1">Paying to:</p>
                  <p className="font-medium">{selectedBeneficiaryDetails.name}</p>
                  <p className="text-sm text-white/60 font-mono">
                    {selectedBeneficiaryDetails.accountNumber} • {selectedBeneficiaryDetails.ifscCode}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {/* Show what's missing */}
            {(!selectedPG || !amount || (transactionType === 'PAYOUT' && !selectedBeneficiary)) && (
              <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-sm text-amber-400">
                  Please complete: {' '}
                  {[
                    !selectedPG && 'Select a payment gateway',
                    !amount && 'Enter amount',
                    transactionType === 'PAYOUT' && !selectedBeneficiary && 'Select a beneficiary',
                  ].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !selectedPG || !amount || (transactionType === 'PAYOUT' && !selectedBeneficiary)}
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

