'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { transactionApi } from '@/lib/api';
import { SabpaisaCheckout } from '@/components/SabpaisaCheckout';
import RazorpayCheckout from '@/components/RazorpayCheckout';
import { CashfreeCheckout } from '@/components/CashfreeCheckout';
import toast from 'react-hot-toast';
import { 
  CreditCardIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

export default function PaymentLinkPage() {
  const params = useParams();
  const router = useRouter();
  const transactionId = params.transactionId as string;
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch transaction details
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => transactionApi.getTransactionByIdPublic(transactionId),
    enabled: !!transactionId,
    retry: 1,
  });

  const transaction = data?.data?.data || data?.data;
  const pgDetails = transaction?.paymentGateway;

  // Auto-redirect for non-embedded payment gateways
  useEffect(() => {
    if (transaction && transaction.paymentUrl && 
        !['RAZORPAY', 'SABPAISA', 'CASHFREE'].includes(pgDetails?.code)) {
      // Redirect to payment URL for other gateways
      window.location.href = transaction.paymentUrl;
    }
  }, [transaction, pgDetails]);

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white">Loading Payment...</h2>
          <p className="text-white/50 mt-2">Please wait</p>
        </motion.div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass rounded-2xl p-8 border border-red-500/30"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-red-500/10">
            <ExclamationCircleIcon className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-red-400 text-center mb-2">Payment Link Invalid</h2>
          <p className="text-white/60 text-center mb-6">
            This payment link is invalid or has expired.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
          >
            Go to Home
          </button>
        </motion.div>
      </div>
    );
  }

  // Check transaction status
  if (transaction.status === 'SUCCESS') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass rounded-2xl p-8 border border-emerald-500/30"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-emerald-500/10">
            <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-400 text-center mb-2">Payment Completed</h2>
          <p className="text-white/60 text-center mb-6">
            This payment has already been processed successfully.
          </p>
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <p className="text-sm text-white/50 mb-1">Transaction ID</p>
            <p className="font-mono text-sm">{transaction.transactionId}</p>
            <p className="text-sm text-white/50 mb-1 mt-3">Amount</p>
            <p className="font-semibold text-lg">₹{transaction.amount?.toLocaleString()}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (transaction.status === 'FAILED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass rounded-2xl p-8 border border-red-500/30"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-red-500/10">
            <XCircleIcon className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-red-400 text-center mb-2">Payment Failed</h2>
          <p className="text-white/60 text-center mb-6">
            This payment transaction has failed.
          </p>
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <p className="text-sm text-white/50 mb-1">Transaction ID</p>
            <p className="font-mono text-sm">{transaction.transactionId}</p>
            <p className="text-sm text-white/50 mb-1 mt-3">Amount</p>
            <p className="font-semibold text-lg">₹{transaction.amount?.toLocaleString()}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show payment interface for PENDING transactions
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full glass rounded-2xl p-8 border border-violet-500/30"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gradient-to-r from-violet-500/20 to-purple-500/20">
            <CreditCardIcon className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Payment</h1>
          <p className="text-white/60">Secure payment via {pgDetails?.displayName || 'Payment Gateway'}</p>
        </div>

        {/* Transaction Details */}
        <div className="bg-white/5 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-white/50 mb-1">Amount to Pay</p>
              <p className="text-2xl font-bold text-emerald-400">₹{transaction.amount?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-white/50 mb-1">Transaction ID</p>
              <p className="font-mono text-sm">{transaction.transactionId}</p>
            </div>
          </div>
          
          {transaction.customerName && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm text-white/50 mb-1">Customer Name</p>
              <p className="font-medium">{transaction.customerName}</p>
            </div>
          )}
        </div>

        {/* Payment Gateway Specific Checkout */}
        {pgDetails?.code === 'SABPAISA' && (
          <SabpaisaCheckout
            transactionId={transaction.transactionId}
            amount={transaction.amount}
            customerName={transaction.customerName || 'Guest'}
            customerEmail={transaction.customerEmail || ''}
            customerPhone={transaction.customerPhone || ''}
            autoSubmit={true}
            onSuccess={(txnId) => {
              toast.success('Payment initiated successfully');
            }}
            onError={(error) => {
              toast.error(error);
            }}
          />
        )}

        {pgDetails?.code === 'RAZORPAY' && (
          <div className="flex flex-col items-center">
            <RazorpayCheckout
              transactionId={transaction.id}
              amount={transaction.amount}
              customerName={transaction.customerName || 'Guest'}
              customerEmail={transaction.customerEmail || ''}
              customerPhone={transaction.customerPhone || ''}
              description={`Transaction ${transaction.transactionId}`}
              autoOpen={true}
              onSuccess={(paymentId, orderId) => {
                toast.success('Payment completed successfully!');
                refetch();
              }}
              onError={(err) => {
                toast.error(`Payment failed: ${err}`);
              }}
            />
            <p className="text-xs text-white/40 mt-4">Secure payment via Razorpay</p>
          </div>
        )}

        {pgDetails?.code === 'CASHFREE' && (() => {
          let paymentSessionId = '';
          let environment = 'sandbox';
          try {
            if (transaction.pgResponse) {
              const parsed = JSON.parse(transaction.pgResponse);
              paymentSessionId = parsed.raw?.paymentSessionId;
              environment = parsed.raw?.environment || 'sandbox';
            }
          } catch (e) {
            console.error('Failed to parse pgResponse', e);
          }

          if (!paymentSessionId) {
            return (
              <div className="text-center text-white/60">
                <p>Unable to load payment session. Please try again.</p>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center">
              <CashfreeCheckout
                transactionId={transaction.id}
                paymentSessionId={paymentSessionId}
                amount={transaction.amount}
                autoOpen={true}
                isProduction={environment === 'production'}
                onSuccess={(orderId) => {
                  toast.success('Payment completed successfully!');
                  refetch();
                }}
                onError={(err) => {
                  toast.error(`Payment failed: ${err}`);
                }}
              />
              <p className="text-xs text-white/40 mt-4">Secure payment via Cashfree</p>
            </div>
          );
        })()}

        {/* Refresh Status Button */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <button
            onClick={handleRefresh}
            disabled={isProcessing}
            className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-white/40">
          <p>🔒 This is a secure payment link</p>
          <p>Your payment information is encrypted and secure</p>
        </div>
      </motion.div>
    </div>
  );
}
