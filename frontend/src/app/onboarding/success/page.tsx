'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function OnboardingSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 max-w-md text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircleIcon className="w-12 h-12 text-emerald-400" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white mb-2"
        >
          Onboarding Complete!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-slate-400 mb-6"
        >
          Thank you for completing your onboarding. Your account is now pending approval.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <ClockIcon className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="text-left">
              <p className="text-amber-400 font-medium">Pending Approval</p>
              <p className="text-sm text-slate-400">
                An administrator will review your details and approve your account shortly.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-slate-500 mb-6"
        >
          You will receive an email notification once your account is approved.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
          >
            Go to Login
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

