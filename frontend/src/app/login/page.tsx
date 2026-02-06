'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Turnstile, { useCaptcha } from '@/components/Turnstile';
import { 
  SparklesIcon, 
  EnvelopeIcon, 
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface LoginForm {
  email: string;
  password: string;
}

interface CaptchaConfig {
  required: boolean;
  siteKey?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaConfig, setCaptchaConfig] = useState<CaptchaConfig>({ required: false });
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [attemptsWarning, setAttemptsWarning] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0); // Key to force re-render of Turnstile
  const { setToken, getToken, clearToken } = useCaptcha();
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoginForm>();
  const watchEmail = watch('email');

  // Check if CAPTCHA is required when email changes
  const checkCaptcha = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) return;
    
    try {
      const response = await authApi.checkCaptcha(email);
      const config = response.data.data;
      setCaptchaConfig(config);
      if (!config.required) {
        setCaptchaVerified(true);
      } else {
        setCaptchaVerified(false);
        clearToken();
      }
    } catch (error) {
      // If check fails, don't require CAPTCHA
      setCaptchaConfig({ required: false });
      setCaptchaVerified(true);
    }
  }, [clearToken]);

  // Debounced email check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchEmail) {
        checkCaptcha(watchEmail);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [watchEmail, checkCaptcha]);

  const handleCaptchaVerify = (token: string) => {
    setToken(token);
    setCaptchaVerified(true);
  };

  const handleCaptchaExpire = () => {
    clearToken();
    setCaptchaVerified(false);
  };
  
  const onSubmit = async (data: LoginForm) => {
    // Check if CAPTCHA is required but not verified
    if (captchaConfig.required && !captchaVerified) {
      toast.error('Please complete the CAPTCHA verification');
      return;
    }

    setIsLoading(true);
    setAttemptsWarning(null);
    
    try {
      const captchaToken = captchaConfig.required ? (getToken() || undefined) : undefined;
      const response = await authApi.login(data.email, data.password, captchaToken, false);
      const { user, accessToken, refreshToken } = response.data.data;
      
      setAuth(user, accessToken, refreshToken);
      toast.success('Welcome back!');
      
      // Redirect based on role
      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.error || 'Login failed';
      
      // IMPORTANT: Reset CAPTCHA after ANY failed login attempt
      // The token is single-use, so we must get a new one
      if (captchaConfig.required) {
        clearToken();
        setCaptchaVerified(false);
        // Force re-render of Turnstile widget by toggling the key
        setCaptchaKey(prev => prev + 1);
      }
      
      // Check for CAPTCHA requirement
      if (errorData?.data?.captchaRequired) {
        checkCaptcha(data.email);
        toast.error('CAPTCHA verification required');
        return;
      }
      
      // Check for remaining attempts warning
      if (errorData?.data?.attemptsRemaining !== undefined) {
        const remaining = errorData.data.attemptsRemaining;
        if (remaining <= 5) {
          setAttemptsWarning(`${remaining} login attempts remaining before account lockout`);
        }
      }
      
      // Re-check CAPTCHA after failed attempt
      checkCaptcha(data.email);
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-mesh flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <SparklesIcon className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-display font-bold">PaymentGateway</span>
        </Link>
        
        {/* Login Card */}
        <div className="glass-card">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-display font-bold mb-2">Welcome back</h1>
            <p className="text-white/60">Sign in to your account to continue</p>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="email"
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="input-field pl-12"
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-danger-500">{errors.email.message}</p>
              )}
            </div>
            
            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Password
              </label>
              <div className="relative">
                <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  className="input-field pl-12 pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-500">{errors.password.message}</p>
              )}
            </div>
            
            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-primary-400 hover:text-primary-300">
                Forgot password?
              </Link>
            </div>

            {/* Attempts Warning */}
            {attemptsWarning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
              >
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <span className="text-sm text-amber-400">{attemptsWarning}</span>
              </motion.div>
            )}

            {/* CAPTCHA */}
            {captchaConfig.required && captchaConfig.siteKey && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <ShieldExclamationIcon className="w-4 h-4" />
                  <span>Security verification required</span>
                </div>
                <Turnstile
                  key={captchaKey}
                  siteKey={captchaConfig.siteKey}
                  onVerify={handleCaptchaVerify}
                  onExpire={handleCaptchaExpire}
                  theme="dark"
                />
              </motion.div>
            )}
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (captchaConfig.required && !captchaVerified)}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRightIcon className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>
          
          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#111118] text-white/40">Need access?</span>
            </div>
          </div>
          
          {/* Contact Admin */}
          <p className="text-center text-white/60 text-sm">
            Contact your administrator for account creation
          </p>
        </div>
        
        {/* Admin Login Link */}
        <p className="text-center mt-6 text-white/40 text-sm">
          Admin?{' '}
          <Link href="/admin/login" className="text-primary-400 hover:text-primary-300">
            Login here
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

