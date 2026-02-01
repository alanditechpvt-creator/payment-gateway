'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bbpsApi, pgApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  CreditCardIcon,
  BanknotesIcon,
  PhoneIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';

export default function CCPaymentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Form State
  const [mobileNumber, setMobileNumber] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [billDetails, setBillDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPG, setSelectedPG] = useState('');

  // Fetch PGs
  const { data: pgsData } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => pgApi.getAvailablePGs(),
  });
  
  // Filter PGs that support payout (assuming CC payment uses payout channels)
  // or maybe we need a specific flag. For now, using all available or filtering if property exists.
  // The backend code for available PGs usually returns list.
  // Let's assume we can use any active PG for now, or maybe filtering by 'supportsPayout' if available.
  const availablePGs = pgsData?.data?.data || [];
  const payoutPGs = availablePGs.filter((pg: any) => pg.supportsPayout !== false); // Default to true if undefined

  // Fetch Bill Mutation
  const fetchBillMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await bbpsApi.fetchBill(data);
      return res.data;
    },
    onSuccess: (data) => {
      setBillDetails(data.data);
      toast.success('Bill fetched successfully');
    },
    onError: (error: any) => {
      console.error('Fetch Bill Error:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to fetch bill');
    },
  });

  // Pay Bill Mutation
  const payBillMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await bbpsApi.payBill(data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Payment initiated successfully');
      router.push('/dashboard/transactions');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Payment failed');
    },
  });

  const handleFetchBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileNumber.length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }
    fetchBillMutation.mutate({
      category: 'CREDIT_CARD',
      mobileNumber,
      cardLast4: cardLast4 || undefined,
    });
  };

  const handlePay = () => {
    if (!selectedPG) {
      toast.error('Please select a payment gateway');
      return;
    }
    
    payBillMutation.mutate({
      amount: billDetails.billAmount,
      mobileNumber: billDetails.params.mobileNumber,
      cardLast4: billDetails.params.cardLast4,
      billerName: billDetails.billerName,
      pgId: selectedPG,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
          <CreditCardIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Credit Card Payment</h1>
          <p className="text-white/60">Pay your credit card bills instantly</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fetch Bill Form */}
        <div className="glass p-6 rounded-2xl space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowPathIcon className="w-5 h-5 text-primary-400" />
            Fetch Bill Details
          </h2>

          <form onSubmit={handleFetchBill} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Registered Mobile Number
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary-500 transition-colors"
                  placeholder="Enter 10 digit mobile number"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Last 4 Digits of Card (Optional)
              </label>
              <div className="relative">
                <CreditCardIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary-500 transition-colors"
                  placeholder="e.g. 1234"
                  maxLength={4}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={fetchBillMutation.isPending}
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {fetchBillMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Fetch Bill'
              )}
            </button>
          </form>
        </div>

        {/* Bill Details & Payment */}
        <div className="space-y-6">
          {billDetails ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-6 rounded-2xl space-y-6 border-l-4 border-l-green-500"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{billDetails.billerName}</h3>
                  <p className="text-white/60 text-sm">{billDetails.customerName}</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                  Verified
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bill Date</span>
                  <span className="font-medium">{billDetails.billDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Due Date</span>
                  <span className="font-medium">{billDetails.dueDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Bill Number</span>
                  <span className="font-medium">{billDetails.billNumber}</span>
                </div>
                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-white/60">Bill Amount</span>
                  <span className="text-2xl font-bold text-white">
                    ₹{billDetails.billAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Payment Gateway Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-white/70">
                  Select Payment Gateway
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {payoutPGs.map((pg: any) => (
                    <button
                      key={pg.id}
                      onClick={() => setSelectedPG(pg.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        selectedPG === pg.id
                          ? 'bg-primary-500/20 border-primary-500'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <BuildingLibraryIcon className={`w-5 h-5 ${selectedPG === pg.id ? 'text-primary-400' : 'text-white/40'}`} />
                        <span className="font-medium">{pg.name}</span>
                      </div>
                      {selectedPG === pg.id && (
                        <CheckCircleIcon className="w-5 h-5 text-primary-400" />
                      )}
                    </button>
                  ))}
                  
                  {payoutPGs.length === 0 && (
                    <div className="text-center p-4 text-white/40 text-sm bg-white/5 rounded-xl">
                      No payment gateways available
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={payBillMutation.isPending || !selectedPG}
                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
              >
                {payBillMutation.isPending ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <BanknotesIcon className="w-6 h-6" />
                    Pay ₹{billDetails.billAmount.toLocaleString('en-IN')}
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 glass rounded-2xl border-dashed border-2 border-white/10">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <CreditCardIcon className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-lg font-medium text-white/80 mb-2">No Bill Details</h3>
              <p className="text-white/40 max-w-xs">
                Enter your registered mobile number and card details to fetch your latest credit card bill.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
