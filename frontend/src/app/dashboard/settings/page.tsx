'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  UserCircleIcon,
  KeyIcon,
  BellIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

// Helper to get correct image URL - backend returns just filename
const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_URL}/uploads/${path}`;
};

export default function SettingsPage() {
  const { user: storedUser, updateUser } = useAuthStore();
  
  // Fetch fresh user data from API
  const { data: userData, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.me(),
  });
  
  const user = userData?.data?.data || storedUser;
  
  // Update store with fresh data
  useEffect(() => {
    if (userData?.data?.data) {
      updateUser(userData.data.data);
    }
  }, [userData, updateUser]);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications'>('profile');
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setChangingPassword(true);
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserCircleIcon },
    { id: 'password', name: 'Password', icon: KeyIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-white/50">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-64 shrink-0"
        >
          <div className="glass rounded-2xl p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.name}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1"
        >
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <UserCircleIcon className="w-5 h-5 text-primary-400" />
                Profile Information
              </h2>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                </div>
              ) : (
              <div className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  {user?.profilePhoto ? (
                    <img 
                      src={getImageUrl(user.profilePhoto)} 
                      alt="Profile" 
                      className="w-20 h-20 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-2xl font-bold">
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'User'}
                    </h3>
                    <p className="text-white/50">{user?.email}</p>
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg bg-primary-500/10 text-primary-400 text-xs font-medium">
                      <ShieldCheckIcon className="w-3.5 h-3.5" />
                      {user?.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Profile Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-white/5">
                  <div>
                    <label className="block text-sm text-white/50 mb-1">Email</label>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/50 mb-1">Phone</label>
                    <p className="font-medium">{user?.phone || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/50 mb-1">Business Name</label>
                    <p className="font-medium">{user?.businessName || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/50 mb-1">Status</label>
                    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${
                      user?.status === 'ACTIVE' 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {user?.status}
                    </span>
                  </div>
                </div>

                {/* KYC Status */}
                <div className="pt-6 border-t border-white/5">
                  <h4 className="font-medium mb-3">KYC Verification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-sm text-white/50">PAN</p>
                      <p className="font-medium">{user?.panNumber || 'Not submitted'}</p>
                      <span className={`text-xs ${
                        user?.panVerified === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {user?.panVerified || 'PENDING'}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-sm text-white/50">Aadhaar</p>
                      <p className="font-medium">{user?.aadhaarNumber ? '****' + user.aadhaarNumber.slice(-4) : 'Not submitted'}</p>
                      <span className={`text-xs ${
                        user?.aadhaarVerified === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {user?.aadhaarVerified || 'PENDING'}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-sm text-white/50">Email</p>
                      <p className="font-medium">{user?.email}</p>
                      <span className={`text-xs ${
                        user?.emailVerified ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {user?.emailVerified ? 'VERIFIED' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Uploaded Documents */}
                {(user?.aadhaarFront || user?.aadhaarBack) && (
                  <div className="pt-6 border-t border-white/5">
                    <h4 className="font-medium mb-3">Uploaded Documents</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {user?.aadhaarFront && (
                        <div className="bg-white/5 rounded-xl p-4">
                          <p className="text-sm text-white/50 mb-2">Aadhaar Front</p>
                          <img 
                            src={getImageUrl(user.aadhaarFront)} 
                            alt="Aadhaar Front" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      {user?.aadhaarBack && (
                        <div className="bg-white/5 rounded-xl p-4">
                          <p className="text-sm text-white/50 mb-2">Aadhaar Back</p>
                          <img 
                            src={getImageUrl(user.aadhaarBack)} 
                            alt="Aadhaar Back" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <KeyIcon className="w-5 h-5 text-primary-400" />
                Change Password
              </h2>
              
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50 pr-10"
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showCurrentPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50 pr-10"
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showNewPassword ? (
                        <EyeSlashIcon className="w-5 h-5" />
                      ) : (
                        <EyeIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full btn-primary mt-6"
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <BellIcon className="w-5 h-5 text-primary-400" />
                Notification Preferences
              </h2>
              
              <div className="space-y-4">
                {[
                  { id: 'email_transactions', label: 'Transaction Notifications', desc: 'Receive email for successful transactions' },
                  { id: 'email_wallet', label: 'Wallet Updates', desc: 'Get notified about wallet balance changes' },
                  { id: 'email_login', label: 'Login Alerts', desc: 'Be notified of new login activities' },
                  { id: 'email_promotions', label: 'Promotional Emails', desc: 'Receive updates about new features and offers' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-white/50">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

