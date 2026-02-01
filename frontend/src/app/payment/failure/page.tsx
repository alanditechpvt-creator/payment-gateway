'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { XCircleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';

function PaymentFailureContent() {
  const searchParams = useSearchParams();
  const txnId = searchParams.get('txnId');
  const reason = searchParams.get('reason') || 'Transaction was declined or failed to process.';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-slate-800/50 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-red-500/10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-red-500/20"
        >
          <XCircleIcon className="w-14 h-14 text-red-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-white mb-2"
        >
          Payment Failed
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-slate-400 mb-6"
        >
          We couldn't complete your transaction.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900/50 rounded-xl p-4 mb-8 border border-slate-700 text-left"
        >
          {txnId && (
            <div className="mb-3 pb-3 border-b border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Transaction ID</p>
              <p className="text-sm font-mono text-slate-300 break-all">{txnId}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Error Reason</p>
            <p className="text-sm text-red-400">{decodeURIComponent(reason)}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          <Link
            href="/dashboard/transactions/new"
            className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold hover:from-red-600 hover:to-rose-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Try Again
          </Link>
          
          <Link
            href="/dashboard/transactions"
            className="block w-full py-3 px-4 rounded-xl bg-slate-700/50 text-slate-300 font-semibold hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <HomeIcon className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
      <PaymentFailureContent />
    </Suspense>
  );
}
