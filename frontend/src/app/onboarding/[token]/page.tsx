'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { onboardingApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  UserCircleIcon,
  IdentificationIcon,
  DocumentIcon,
  CameraIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface OnboardingInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  businessName: string;
  panNumber: string;
  aadhaarNumber: string;
  profilePhoto: File | null;
  aadhaarFront: File | null;
  aadhaarBack: File | null;
  emailOtp: string;
}

export default function OnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [onboardingInfo, setOnboardingInfo] = useState<OnboardingInfo | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [step, setStep] = useState<'verify' | 'form' | 'success' | 'error'>('verify');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    panNumber: '',
    aadhaarNumber: '',
    profilePhoto: null,
    aadhaarFront: null,
    aadhaarBack: null,
    emailOtp: '',
  });

  const [previews, setPreviews] = useState({
    profilePhoto: '',
    aadhaarFront: '',
    aadhaarBack: '',
  });

  const fetchOnboardingInfo = useCallback(async () => {
    try {
      const response = await onboardingApi.getOnboardingInfo(token);
      const data = response.data.data;
      setOnboardingInfo(data);
      setFormData((prev) => ({
        ...prev,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
      }));
      setStep('form');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired onboarding link');
      setStep('error');
      toast.error(err.response?.data?.error || 'Invalid or expired onboarding link');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOnboardingInfo();
  }, [fetchOnboardingInfo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'profilePhoto' | 'aadhaarFront' | 'aadhaarBack'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, [field]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const sendOtp = async () => {
    try {
      setSubmitting(true);
      await onboardingApi.sendEmailOTP(token);
      setOtpSent(true);
      toast.success('OTP sent to your email!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setSubmitting(true);
      await onboardingApi.verifyEmailOTP(token, formData.emailOtp);
      setOtpVerified(true);
      toast.success('Email verified successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
      toast.error('Please enter first and last name');
      return false;
    }
    if (!/^\d{10}$/.test(formData.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return false;
    }
    if (!formData.panNumber || !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(formData.panNumber.toUpperCase())) {
      toast.error('Please enter a valid PAN number (e.g., ABCDE1234F)');
      return false;
    }
    if (!formData.aadhaarNumber || !/^\d{12}$/.test(formData.aadhaarNumber)) {
      toast.error('Please enter a valid 12-digit Aadhaar number');
      return false;
    }
    if (!formData.aadhaarFront || !formData.aadhaarBack) {
      toast.error('Please upload both sides of your Aadhaar card');
      return false;
    }
    if (!formData.profilePhoto) {
      toast.error('Please upload your profile photo');
      return false;
    }
    if (!otpVerified) {
      toast.error('Please verify your email with OTP');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const submitData = new FormData();
      submitData.append('firstName', formData.firstName.trim());
      submitData.append('lastName', formData.lastName.trim());
      submitData.append('phone', formData.phone);
      submitData.append('businessName', formData.businessName);
      submitData.append('panNumber', formData.panNumber.toUpperCase());
      submitData.append('aadhaarNumber', formData.aadhaarNumber);
      if (formData.profilePhoto) submitData.append('profilePhoto', formData.profilePhoto);
      if (formData.aadhaarFront) submitData.append('aadhaarFront', formData.aadhaarFront);
      if (formData.aadhaarBack) submitData.append('aadhaarBack', formData.aadhaarBack);

      await onboardingApi.completeOnboarding(token, submitData);
      toast.success('Onboarding completed! Awaiting approval.');
      setStep('success');
      setTimeout(() => router.push('/onboarding/success'), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state – same as admin
  if (loading || step === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-white text-lg">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  // Error state – same as admin
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
          <p className="text-white/70 mb-6">{error || 'This onboarding link is invalid or has expired. Please contact your administrator for a new invitation.'}</p>
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

  // Success state – same as admin
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
          <p className="text-white/70 mb-6">Thank you for completing your onboarding. Your account is now pending approval. Redirecting...</p>
        </motion.div>
      </div>
    );
  }

  // Main form – same structure as admin: single page with sections
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Complete Your Onboarding</h1>
        <p className="text-white/70 mb-2">
          Welcome, {onboardingInfo?.firstName || onboardingInfo?.lastName || onboardingInfo?.email}! Please complete your profile and KYC to get started.
        </p>
        {onboardingInfo && (
          <p className="text-purple-400 text-sm mb-8">
            Registering as: <span className="font-semibold">{onboardingInfo.role.replace('_', ' ')}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information – same section style as admin */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <UserCircleIcon className="w-6 h-6 text-purple-400" />
              Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="First name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                maxLength={10}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="10-digit mobile number"
                required
              />
            </div>
          </div>

          {/* Business Details – same as admin */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <IdentificationIcon className="w-6 h-6 text-purple-400" />
              Business Details
            </h2>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Business Name</label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your business or company name (optional)"
              />
            </div>
          </div>

          {/* Tax & KYC – PAN, Aadhaar, uploads like admin tax section style */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <DocumentIcon className="w-6 h-6 text-purple-400" />
              Tax & KYC Documents
            </h2>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">PAN Number *</label>
              <input
                type="text"
                name="panNumber"
                value={formData.panNumber}
                onChange={handleInputChange}
                maxLength={10}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                placeholder="ABCDE1234F"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Aadhaar Number *</label>
              <input
                type="text"
                name="aadhaarNumber"
                value={formData.aadhaarNumber}
                onChange={handleInputChange}
                maxLength={12}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="12-digit Aadhaar number"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Aadhaar Front *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'aadhaarFront')}
                  className="hidden"
                  id="aadhaarFront"
                />
                <label
                  htmlFor="aadhaarFront"
                  className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-purple-500/50 bg-white/5 transition-colors"
                >
                  {previews.aadhaarFront ? (
                    <img src={previews.aadhaarFront} alt="Aadhaar Front" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <DocumentTextIcon className="w-8 h-8 text-white/40 mb-2" />
                      <span className="text-sm text-white/60">Upload front</span>
                    </>
                  )}
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Aadhaar Back *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'aadhaarBack')}
                  className="hidden"
                  id="aadhaarBack"
                />
                <label
                  htmlFor="aadhaarBack"
                  className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-purple-500/50 bg-white/5 transition-colors"
                >
                  {previews.aadhaarBack ? (
                    <img src={previews.aadhaarBack} alt="Aadhaar Back" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <DocumentTextIcon className="w-8 h-8 text-white/40 mb-2" />
                      <span className="text-sm text-white/60">Upload back</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Profile Photo – same card style */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <CameraIcon className="w-6 h-6 text-purple-400" />
              Profile Photo *
            </h2>
            <div className="flex flex-col items-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'profilePhoto')}
                className="hidden"
                id="profilePhoto"
              />
              <label
                htmlFor="profilePhoto"
                className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed border-white/20 rounded-full cursor-pointer hover:border-purple-500/50 bg-white/5 transition-colors overflow-hidden"
              >
                {previews.profilePhoto ? (
                  <img src={previews.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <CameraIcon className="w-12 h-12 text-white/40 mb-2" />
                    <span className="text-sm text-white/60 text-center px-2">Upload photo</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Email Verification – same section card */}
          <div className="bg-white/5 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <EnvelopeIcon className="w-6 h-6 text-purple-400" />
              Email Verification *
            </h2>
            <p className="text-white/70 text-sm">
              We&apos;ll send a verification code to: <span className="font-semibold text-purple-400">{onboardingInfo?.email}</span>
            </p>
            {!otpSent ? (
              <button
                type="button"
                onClick={sendOtp}
                disabled={submitting}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Verification Code'}
              </button>
            ) : !otpVerified ? (
              <div className="space-y-3">
                <input
                  type="text"
                  name="emailOtp"
                  value={formData.emailOtp}
                  onChange={handleInputChange}
                  maxLength={6}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-center text-xl tracking-widest placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter 6-digit OTP"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={submitting || formData.emailOtp.length < 6}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Verifying...' : 'Verify Code'}
                  </button>
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={submitting}
                    className="px-6 py-3 text-white/70 hover:text-white text-sm"
                  >
                    Resend
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircleIcon className="w-6 h-6" />
                <span className="font-medium">Email verified</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !otpVerified}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {submitting ? 'Completing Onboarding...' : 'Complete Onboarding'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
