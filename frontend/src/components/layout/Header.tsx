'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useSidebarStore } from '@/lib/store';
import {
  BellIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

export function Header({ title }: { title?: string }) {
  const { user } = useAuthStore();
  const { toggle } = useSidebarStore();
  const [showNotifications, setShowNotifications] = useState(false);
  
  return (
    <header className="sticky top-0 z-30 glass border-b border-white/5">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <div className="lg:hidden w-10" /> {/* Spacer for mobile menu button */}
          {title && (
            <h1 className="text-xl font-display font-semibold">{title}</h1>
          )}
        </div>
        
        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <MagnifyingGlassIcon className="w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none outline-none text-sm placeholder-white/40 w-48"
            />
            <kbd className="px-2 py-0.5 rounded bg-white/10 text-xs text-white/40">⌘K</kbd>
          </div>
          
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <BellIcon className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent-500 rounded-full" />
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 glass-card"
                >
                  <h3 className="font-semibold mb-4">Notifications</h3>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                      <p className="text-sm font-medium">New user registered</p>
                      <p className="text-xs text-white/50 mt-1">2 minutes ago</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                      <p className="text-sm font-medium">Transaction completed</p>
                      <p className="text-xs text-white/50 mt-1">15 minutes ago</p>
                    </div>
                  </div>
                  <button className="w-full mt-4 text-sm text-primary-400 hover:text-primary-300">
                    View all notifications
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* User menu */}
          <button className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center font-semibold text-sm">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
            </div>
            <ChevronDownIcon className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </div>
    </header>
  );
}

