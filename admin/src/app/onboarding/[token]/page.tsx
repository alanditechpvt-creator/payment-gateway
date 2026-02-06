'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function OnboardingPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<'verify' | 'form' | 'success' | 'error'>('verify');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    phone: '',
    businessName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    panNumber: '',
    gstNumber: '',
  });

  // Verify token on mount
  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await authApi.verifyOnboardingToken(token);
      setUserInfo(response.data.data.user);
      setFormData({
        ...formData,
        phone: response.data.data.user.phone || '',
        businessName: response.data.data.user.businessName || '',
      });
      setStep('form');
    } catch (error: any) {
      console.error('Token verification failed:', error);
      setStep('error');
      toast.error(error.response?.data?.error || 'Invalid or expired onboarding link');
    }
  };

  const onboardingMutation = useMutation({
    mutationFn: async (data: any) => {
      return authApi.completeOnboarding(token, data);
    },
    onSuccess: () => {
      setStep('success');
      toast.success('Onboarding completed successfully!');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to complete onboarding');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!formData.phone || formData.phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    if (!formData.panNumber || formData.panNumber.length !== 10) {
      toast.error('Please enter a valid PAN number');
      return;
    }

    onboardingMutation.mutate({
      password: formData.password,
      phone: formData.phone,
      businessName: formData.businessName,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      panNumber: formData.panNumber.toUpperCase(),
      gstNumber: formData.gstNumber ? formData.gstNumber.toUpperCase() : undefined,
    });
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-white text-lg">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center"
        >
          <XCircleIcon className="w-20 h-20 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-white/70 mb-6">
            This onboarding link is invalid or has expired. Please contact your administrator for a new invitation.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center"
        >
          <CheckCircleIcon className="w-20 h-20 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Onboarding Complete!</h1>
          <p className="text-white/70 mb-6">
            Your account has been successfully set up. Redirecting to login...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Complete Your Onboarding</h1>
        <p className="text-white/70 mb-8">
          Welcome, {userInfo?.firstName || userInfo?.email}! Please complete your profile to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Password Section */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Account Security</h2>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Confirm Password *</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Re-enter your password"
                required
              />
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Personal Information</h2>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Phone Number *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="10-digit mobile number"
                required
                pattern="[0-9]{10}"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Business Name *</label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your business or company name"
                required
              />
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Address Information</h2>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Address *</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Complete address"
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">State *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Pincode *</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="6-digit pincode"
                required
                pattern="[0-9]{6}"
              />
            </div>
          </div>

          {/* Tax Information */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Tax Information</h2>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">PAN Number *</label>
              <input
                type="text"
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="ABCDE1234F"
                required
                pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">GST Number (Optional)</label>
              <input
                type="text"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={onboardingMutation.isPending}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {onboardingMutation.isPending ? 'Completing Onboarding...' : 'Complete Onboarding'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
