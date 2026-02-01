'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { onboardingApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  UserCircleIcon, 
  IdentificationIcon, 
  CameraIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  DocumentIcon,
  ShieldCheckIcon
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

const STEPS = [
  { id: 1, name: 'Personal Info', icon: UserCircleIcon },
  { id: 2, name: 'Business Details', icon: IdentificationIcon },
  { id: 3, name: 'KYC Documents', icon: DocumentIcon },
  { id: 4, name: 'Photo Upload', icon: CameraIcon },
  { id: 5, name: 'Email Verification', icon: EnvelopeIcon },
];

export default function OnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [onboardingInfo, setOnboardingInfo] = useState<OnboardingInfo | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
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
      setOnboardingInfo(response.data.data);
      if (response.data.data.firstName) {
        setFormData(prev => ({
          ...prev,
          firstName: response.data.data.firstName || '',
          lastName: response.data.data.lastName || '',
        }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired onboarding link');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOnboardingInfo();
  }, [fetchOnboardingInfo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'profilePhoto' | 'aadhaarFront' | 'aadhaarBack') => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, [field]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [field]: reader.result as string }));
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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.phone) {
          toast.error('Please fill all required fields');
          return false;
        }
        if (!/^\d{10}$/.test(formData.phone)) {
          toast.error('Please enter a valid 10-digit phone number');
          return false;
        }
        return true;
      case 2:
        return true; // Business name is optional
      case 3:
        if (!formData.panNumber || !formData.aadhaarNumber) {
          toast.error('Please enter PAN and Aadhaar numbers');
          return false;
        }
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.toUpperCase())) {
          toast.error('Please enter a valid PAN number (e.g., ABCDE1234F)');
          return false;
        }
        if (!/^\d{12}$/.test(formData.aadhaarNumber)) {
          toast.error('Please enter a valid 12-digit Aadhaar number');
          return false;
        }
        if (!formData.aadhaarFront || !formData.aadhaarBack) {
          toast.error('Please upload both sides of your Aadhaar card');
          return false;
        }
        return true;
      case 4:
        if (!formData.profilePhoto) {
          toast.error('Please upload your profile photo');
          return false;
        }
        return true;
      case 5:
        if (!otpVerified) {
          toast.error('Please verify your email');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setSubmitting(true);
      const submitData = new FormData();
      submitData.append('firstName', formData.firstName);
      submitData.append('lastName', formData.lastName);
      submitData.append('phone', formData.phone);
      submitData.append('businessName', formData.businessName);
      submitData.append('panNumber', formData.panNumber.toUpperCase());
      submitData.append('aadhaarNumber', formData.aadhaarNumber);
      
      if (formData.profilePhoto) {
        submitData.append('profilePhoto', formData.profilePhoto);
      }
      if (formData.aadhaarFront) {
        submitData.append('aadhaarFront', formData.aadhaarFront);
      }
      if (formData.aadhaarBack) {
        submitData.append('aadhaarBack', formData.aadhaarBack);
      }

      await onboardingApi.completeOnboarding(token, submitData);
      toast.success('Onboarding completed! Awaiting approval.');
      router.push('/onboarding/success');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800/50 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 max-w-md text-center"
        >
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Link Invalid</h1>
          <p className="text-slate-400">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to PayGate</h1>
          <p className="text-slate-400">Complete your onboarding to get started</p>
          {onboardingInfo && (
            <p className="text-purple-400 mt-2">
              Registering as: <span className="font-semibold">{onboardingInfo.role.replace('_', ' ')}</span>
            </p>
          )}
        </motion.div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all
                  ${currentStep >= step.id 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700 text-slate-400'}
                  ${currentStep === step.id ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900' : ''}
                `}>
                  {currentStep > step.id ? (
                    <CheckCircleIcon className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`hidden sm:block w-12 lg:w-24 h-1 mx-2 rounded ${
                    currentStep > step.id ? 'bg-purple-600' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map(step => (
              <span key={step.id} className={`text-xs ${
                currentStep >= step.id ? 'text-purple-400' : 'text-slate-500'
              } hidden sm:block`}>
                {step.name}
              </span>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <UserCircleIcon className="w-6 h-6 text-purple-400" />
                  Personal Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    maxLength={10}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter 10-digit phone number"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Business Details */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <IdentificationIcon className="w-6 h-6 text-purple-400" />
                  Business Details
                </h2>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Business Name <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter business name"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    Leave blank if you&apos;re registering as an individual
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: KYC Documents */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <DocumentIcon className="w-6 h-6 text-purple-400" />
                  KYC Documents
                </h2>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    PAN Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleInputChange}
                    maxLength={10}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                    placeholder="ABCDE1234F"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Aadhaar Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="aadhaarNumber"
                    value={formData.aadhaarNumber}
                    onChange={handleInputChange}
                    maxLength={12}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter 12-digit Aadhaar number"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Aadhaar Front <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, 'aadhaarFront')}
                        className="hidden"
                        id="aadhaarFront"
                      />
                      <label
                        htmlFor="aadhaarFront"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-purple-500 transition-colors bg-slate-700/30"
                      >
                        {previews.aadhaarFront ? (
                          <img src={previews.aadhaarFront} alt="Aadhaar Front" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <>
                            <DocumentIcon className="w-8 h-8 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-400">Upload front side</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Aadhaar Back <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, 'aadhaarBack')}
                        className="hidden"
                        id="aadhaarBack"
                      />
                      <label
                        htmlFor="aadhaarBack"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-purple-500 transition-colors bg-slate-700/30"
                      >
                        {previews.aadhaarBack ? (
                          <img src={previews.aadhaarBack} alt="Aadhaar Back" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <>
                            <DocumentIcon className="w-8 h-8 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-400">Upload back side</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Photo Upload */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <CameraIcon className="w-6 h-6 text-purple-400" />
                  Profile Photo
                </h2>
                
                <div className="flex flex-col items-center">
                  <div className="relative w-48 h-48">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'profilePhoto')}
                      className="hidden"
                      id="profilePhoto"
                    />
                    <label
                      htmlFor="profilePhoto"
                      className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-slate-600 rounded-full cursor-pointer hover:border-purple-500 transition-colors bg-slate-700/30 overflow-hidden"
                    >
                      {previews.profilePhoto ? (
                        <img src={previews.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <CameraIcon className="w-12 h-12 text-slate-400 mb-2" />
                          <span className="text-sm text-slate-400 text-center px-4">Click to upload photo</span>
                        </>
                      )}
                    </label>
                  </div>
                  <p className="text-sm text-slate-500 mt-4">
                    Please upload a clear photo of yourself
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 5: Email Verification */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <EnvelopeIcon className="w-6 h-6 text-purple-400" />
                  Email Verification
                </h2>

                <div className="text-center py-4">
                  <p className="text-slate-300 mb-4">
                    We&apos;ll send a verification code to: <span className="font-semibold text-purple-400">{onboardingInfo?.email}</span>
                  </p>

                  {!otpSent ? (
                    <button
                      onClick={sendOtp}
                      disabled={submitting}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Sending...' : 'Send Verification Code'}
                    </button>
                  ) : !otpVerified ? (
                    <div className="space-y-4">
                      <div className="max-w-xs mx-auto">
                        <input
                          type="text"
                          name="emailOtp"
                          value={formData.emailOtp}
                          onChange={handleInputChange}
                          maxLength={6}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-center text-2xl tracking-widest placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="• • • • • •"
                        />
                      </div>
                      <button
                        onClick={verifyOtp}
                        disabled={submitting || formData.emailOtp.length < 6}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                        {submitting ? 'Verifying...' : 'Verify Code'}
                      </button>
                      <button
                        onClick={sendOtp}
                        disabled={submitting}
                        className="block mx-auto text-sm text-purple-400 hover:text-purple-300"
                      >
                        Resend Code
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
                      </div>
                      <p className="text-emerald-400 font-medium">Email Verified Successfully!</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back
            </button>

            {currentStep < STEPS.length ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
              >
                Continue
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !otpVerified}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Complete Onboarding'}
                <CheckCircleIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

