'use client';

/**
 * News Ticker Component
 * 
 * Displays scrolling announcements/news from admin
 */

import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { announcementApi } from '@/lib/api';
import {
  MegaphoneIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'PROMO';
  priority: number;
  bgColor?: string;
  textColor?: string;
  icon?: string;
}

const typeConfig = {
  INFO: {
    icon: InformationCircleIcon,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    textClass: 'text-blue-400',
    iconClass: 'text-blue-400',
  },
  WARNING: {
    icon: ExclamationTriangleIcon,
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    textClass: 'text-amber-400',
    iconClass: 'text-amber-400',
  },
  ALERT: {
    icon: BellAlertIcon,
    bgClass: 'bg-red-500/10 border-red-500/30',
    textClass: 'text-red-400',
    iconClass: 'text-red-400',
  },
  PROMO: {
    icon: SparklesIcon,
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
    textClass: 'text-emerald-400',
    iconClass: 'text-emerald-400',
  },
};

export default function NewsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const tickerRef = useRef<HTMLDivElement>(null);

  const { data: response } = useQuery({
    queryKey: ['announcements-active'],
    queryFn: () => announcementApi.getActive(),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const announcements: Announcement[] = (response?.data?.data || []).filter(
    (a: Announcement) => !dismissedIds.has(a.id)
  );

  // Auto-rotate announcements
  useEffect(() => {
    if (announcements.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, [announcements.length]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(Array.from(prev).concat(id)));
  };

  if (!announcements.length) return null;

  const current = announcements[currentIndex % announcements.length];
  if (!current) return null;

  const config = typeConfig[current.type] || typeConfig.INFO;
  const IconComponent = config.icon;

  // Custom colors from announcement
  const customBg = current.bgColor ? { backgroundColor: current.bgColor } : {};
  const customText = current.textColor ? { color: current.textColor } : {};

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mb-6"
        >
          <div
            ref={tickerRef}
            className={`relative overflow-hidden rounded-xl border ${config.bgClass} p-4`}
            style={customBg}
          >
            {/* Background animation */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            </div>

            <div className="relative flex items-center gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 ${config.iconClass}`} style={customText}>
                <IconComponent className="w-6 h-6" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    {/* Title */}
                    {current.title && (
                      <span
                        className={`font-semibold ${config.textClass} flex-shrink-0`}
                        style={customText}
                      >
                        {current.title}:
                      </span>
                    )}

                    {/* Scrolling message */}
                    <div className="flex-1 overflow-hidden">
                      <div className="whitespace-nowrap animate-marquee">
                        <span className="text-white/80" style={customText}>
                          {current.message}
                        </span>
                        <span className="mx-8 text-white/30">•</span>
                        <span className="text-white/80" style={customText}>
                          {current.message}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Pagination dots */}
              {announcements.length > 1 && (
                <div className="flex gap-1.5 flex-shrink-0">
                  {announcements.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentIndex % announcements.length
                          ? 'bg-white/60 scale-125'
                          : 'bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(current.id)}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact News Ticker - single line version
 */
export function NewsTickerCompact() {
  const { data: response } = useQuery({
    queryKey: ['announcements-active'],
    queryFn: () => announcementApi.getActive(),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const announcements: Announcement[] = response?.data?.data || [];

  if (!announcements.length) return null;

  // Combine all messages
  const combinedMessage = announcements
    .map((a) => `${a.title ? a.title + ': ' : ''}${a.message}`)
    .join('  •  ');

  return (
    <div className="bg-gradient-to-r from-primary-600/20 via-accent-600/20 to-primary-600/20 border-y border-white/10 py-2 overflow-hidden">
      <div className="flex items-center gap-3 px-4">
        <MegaphoneIcon className="w-5 h-5 text-primary-400 flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div className="whitespace-nowrap animate-marquee-slow">
            <span className="text-white/80">{combinedMessage}</span>
            <span className="mx-16" />
            <span className="text-white/80">{combinedMessage}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

