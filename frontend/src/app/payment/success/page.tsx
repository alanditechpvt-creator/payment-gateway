'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircleIcon, ArrowRightIcon, HomeIcon } from '@heroicons/react/24/outline';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txnId = searchParams.get('txnId');
  const [countdown, setCountdown] = useState(10);

  // Auto-redirect to dashboard after 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard/transactions');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-slate-800/50 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-emerald-500/10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/20"
        >
          <CheckCircleIcon className="w-14 h-14 text-emerald-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-white mb-2"
        >
          Payment Successful!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-slate-400 mb-6"
        >
          Your transaction has been processed successfully.
        </motion.p>

        {txnId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-900/50 rounded-xl p-4 mb-8 border border-slate-700"
          >
            <p className="text-sm text-slate-500 mb-1">Transaction ID</p>
            <p className="text-lg font-mono text-emerald-400 break-all">{txnId}</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          <Link
            href="/dashboard/transactions"
            className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <HomeIcon className="w-5 h-5" />
            Go to Dashboard ({countdown}s)
          </Link>
          
          <Link
            href="/dashboard/transactions/new"
            className="block w-full py-3 px-4 rounded-xl bg-slate-700/50 text-slate-300 font-semibold hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <ArrowRightIcon className="w-5 h-5" />
            New Transaction
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
