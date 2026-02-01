'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, updateUser, _hasHydrated } = useAuthStore();
  
  // Fetch fresh user data on dashboard load
  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.me(),
    enabled: isAuthenticated && _hasHydrated,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Update store with fresh user data
  useEffect(() => {
    if (userData?.data?.data) {
      updateUser(userData.data.data);
    }
  }, [userData, updateUser]);
  
  // Only redirect after hydration is complete
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router, _hasHydrated]);
  
  // Show loading while hydrating or if not authenticated yet
  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="lg:ml-[280px] min-h-screen">
        {children}
      </main>
    </div>
  );
}

