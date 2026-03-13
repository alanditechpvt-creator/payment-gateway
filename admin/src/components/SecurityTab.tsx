'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheckIcon, LockClosedIcon, KeyIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import { securityApi } from '@/lib/api';

export function SecurityTab() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-security-settings'],
    queryFn: () => securityApi.getSettings(),
    enabled: !!user,
  });

  const current = data?.data?.data?.current;
  const captchaMeta = data?.data?.data?.captcha;

  const [maxAttempts, setMaxAttempts] = useState<number>(20);
  const [lockoutMinutes, setLockoutMinutes] = useState<number>(30);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaAfter, setCaptchaAfter] = useState<number>(3);
  const [requireAlways, setRequireAlways] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');

  useEffect(() => {
    if (current) {
      setMaxAttempts(current.maxFailedAttempts);
      setLockoutMinutes(current.lockoutDurationMinutes);
      setCaptchaEnabled(current.captchaEnabled);
      setCaptchaAfter(current.captchaAfterFailures);
      setRequireAlways(current.requireCaptchaAlways);
    }
  }, [current]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!adminPassword) {
        throw new Error('Please enter your admin password to save changes.');
      }
      const settings = [
        { key: 'MAX_FAILED_ATTEMPTS', value: maxAttempts },
        { key: 'LOCKOUT_DURATION_MINUTES', value: lockoutMinutes },
        { key: 'CAPTCHA_ENABLED', value: captchaEnabled },
        { key: 'CAPTCHA_AFTER_FAILURES', value: captchaAfter },
        { key: 'REQUIRE_CAPTCHA_ALWAYS', value: requireAlways },
      ];
      await securityApi.bulkUpdateSettings(
        settings.map((s) => ({ key: s.key, value: String(s.value) })),
        adminPassword,
      );
    },
    onSuccess: () => {
      toast.success('Security settings updated.');
      setAdminPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin-security-settings'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to update security settings');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!unlockEmail.trim()) {
        throw new Error('Please enter an email to unlock.');
      }
      if (!unlockPassword) {
        throw new Error('Please enter your admin password.');
      }
      await securityApi.unlockAccount(unlockEmail.trim(), unlockPassword);
    },
    onSuccess: () => {
      toast.success('Account unlocked successfully.');
      setUnlockEmail('');
      setUnlockPassword('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to unlock account');
    },
  });

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-amber-400" />
          Security
        </h1>
        <p className="text-white/60">You must be logged in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheckIcon className="w-7 h-7 text-primary-400" />
          Security
        </h1>
        <p className="text-white/60">
          Manage login security, CAPTCHA, and account lockout settings.
        </p>
      </div>

      {/* Settings card */}
      <div className="admin-card space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LockClosedIcon className="w-5 h-5 text-primary-400" />
          Login & Lockout Settings
        </h2>

        {isLoading && !current ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Max failed attempts</label>
              <input
                type="number"
                min={1}
                className="input-field"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value || '0', 10))}
              />
              <p className="text-xs text-white/40 mt-1">
                After this many failed logins, the account will be locked.
              </p>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Lockout duration (minutes)</label>
              <input
                type="number"
                min={1}
                className="input-field"
                value={lockoutMinutes}
                onChange={(e) => setLockoutMinutes(parseInt(e.target.value || '0', 10))}
              />
              <p className="text-xs text-white/40 mt-1">
                How long an account stays locked after reaching max failed attempts.
              </p>
            </div>
            <div className="md:col-span-2 border-t border-white/5 pt-4 mt-2">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
                CAPTCHA (Cloudflare Turnstile)
              </h3>
              <div className="flex flex-col md:flex-row gap-4 md:items-center">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={captchaEnabled}
                    onChange={(e) => setCaptchaEnabled(e.target.checked)}
                    className="rounded border-white/30 bg-transparent text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-white/80">Enable CAPTCHA for login</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/70">Require CAPTCHA after</span>
                  <input
                    type="number"
                    min={0}
                    className="w-20 input-field px-2 py-1 text-sm"
                    value={captchaAfter}
                    onChange={(e) => setCaptchaAfter(parseInt(e.target.value || '0', 10))}
                  />
                  <span className="text-sm text-white/70">failed attempts</span>
                </div>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={requireAlways}
                    onChange={(e) => setRequireAlways(e.target.checked)}
                    className="rounded border-white/30 bg-transparent text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-white/80">Always require CAPTCHA</span>
                </label>
              </div>
              <p className="text-xs text-white/40 mt-2">
                CAPTCHA status:{' '}
                {captchaMeta?.enabled
                  ? captchaMeta.configured
                    ? 'Enabled & keys configured'
                    : 'Enabled but keys missing'
                  : 'Disabled'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
          <label className="block text-sm text-white/70 mb-1 flex items-center gap-1">
            <KeyIcon className="w-4 h-4 text-primary-400" />
            Confirm admin password to save
          </label>
          <input
            type="password"
            className="input-field max-w-sm"
            placeholder="Enter your admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isLoading}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveMutation.isLoading ? 'Saving...' : 'Save security settings'}
          </button>
        </div>
      </div>

      {/* Unlock account card */}
      <div className="admin-card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LockClosedIcon className="w-5 h-5 text-amber-400" />
          Unlock User Account
        </h2>
        <p className="text-sm text-white/60">
          Use this to unlock an account that has been locked due to too many failed login attempts
          or manual suspension. This action is audited and requires your password.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">User email to unlock</label>
            <input
              type="email"
              className="input-field"
              placeholder="user@example.com"
              value={unlockEmail}
              onChange={(e) => setUnlockEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">Your admin password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Confirm your password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => unlockMutation.mutate()}
          disabled={unlockMutation.isLoading}
          className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {unlockMutation.isLoading ? 'Unlocking...' : 'Unlock account'}
        </button>
      </div>
    </div>
  );
}

