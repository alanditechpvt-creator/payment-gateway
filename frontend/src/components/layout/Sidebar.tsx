'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useAuthStore, useSidebarStore } from '@/lib/store';
import {
  HomeIcon,
  UsersIcon,
  CreditCardIcon,
  WalletIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  BuildingLibraryIcon,
  ArrowLeftOnRectangleIcon,
  SparklesIcon,
  XMarkIcon,
  Bars3Icon,
  UserGroupIcon,
  CurrencyRupeeIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Transactions', href: '/dashboard/transactions', icon: DocumentTextIcon },
  { name: 'CC Payment', href: '/dashboard/cc-payment', icon: CreditCardIcon },
  { name: 'Wallet', href: '/dashboard/wallet', icon: WalletIcon },
  { name: 'Ledger', href: '/dashboard/ledger', icon: BookOpenIcon },
  { name: 'Beneficiaries', href: '/dashboard/beneficiaries', icon: UserGroupIcon },
  { name: 'Rate Management', href: '/dashboard/rates', icon: CurrencyRupeeIcon, roles: ['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR'] },
  { name: 'Users', href: '/dashboard/users', icon: UsersIcon, permission: 'canCreateUsers' },
  { name: 'Payment Gateways', href: '/dashboard/gateways', icon: CreditCardIcon, permission: 'canManagePG' },
  { name: 'Schemas', href: '/dashboard/schemas', icon: ChartBarIcon, permission: 'canCreateSchema' },
  { name: 'Reports', href: '/dashboard/reports', icon: BuildingLibraryIcon, permission: 'canViewReports' },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { isOpen, toggle, close } = useSidebarStore();
  
  const filteredNavigation = navigation.filter((item: any) => {
    // Check role-based access
    if (item.roles && !item.roles.includes(user?.role)) {
      return false;
    }
    // Check permission-based access
    if (item.permission) {
      if (user?.role === 'ADMIN') return true;
      // Handle both array and object permissions
      const perms = Array.isArray(user?.permissions) ? user?.permissions[0] : user?.permissions;
      return perms?.[item.permission as keyof typeof perms];
    }
    return true;
  });
  
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };
  
  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={toggle}
        className="fixed top-4 left-4 z-50 p-2 rounded-xl glass lg:hidden"
      >
        {isOpen ? (
          <XMarkIcon className="w-6 h-6" />
        ) : (
          <Bars3Icon className="w-6 h-6" />
        )}
      </button>
      
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : -280,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={clsx(
          'fixed left-0 top-0 bottom-0 w-[280px] z-50',
          'glass border-r border-white/5',
          'flex flex-col',
          'lg:translate-x-0 lg:opacity-100'
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold">PaymentGateway</h1>
              <p className="text-xs text-white/40 capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</p>
            </div>
          </Link>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => window.innerWidth < 1024 && close()}
                className={clsx('sidebar-link', isActive && 'active')}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* User section */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/50 to-accent-500/50 flex items-center justify-center font-semibold">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email}
              </p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-danger-500/10 hover:text-danger-500 transition-colors"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}

