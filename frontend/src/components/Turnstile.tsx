'use client';

/**
 * Cloudflare Turnstile CAPTCHA Component
 * 
 * A privacy-friendly, user-friendly CAPTCHA alternative
 * https://developers.cloudflare.com/turnstile/
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export default function Turnstile({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'dark',
  size = 'normal',
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'error-callback': () => onError?.(new Error('CAPTCHA verification failed')),
        'expired-callback': onExpire,
        theme,
        size,
      });
    } catch (error) {
      console.error('Turnstile render error:', error);
      onError?.(error as Error);
    }
  }, [siteKey, onVerify, onError, onExpire, theme, size]);

  useEffect(() => {
    // Check if script is already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Load Turnstile script
    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true;
      
      window.onTurnstileLoad = () => {
        renderWidget();
      };

      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      // Cleanup widget on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  return (
    <div 
      ref={containerRef} 
      className="flex justify-center my-4"
      data-testid="turnstile-container"
    />
  );
}

/**
 * Hook to manage CAPTCHA state
 * Uses a combination of ref (for immediate access) and state (for React updates)
 */
export function useCaptcha() {
  const tokenRef = useRef<string | null>(null);
  const [token, setTokenState] = useState<string | null>(null);

  const setToken = useCallback((newToken: string) => {
    tokenRef.current = newToken;
    setTokenState(newToken);
    console.log('CAPTCHA token set:', newToken ? 'token received' : 'null');
  }, []);

  const clearToken = useCallback(() => {
    tokenRef.current = null;
    setTokenState(null);
    console.log('CAPTCHA token cleared');
  }, []);

  const getToken = useCallback(() => {
    // Return from ref for immediate access, or state as fallback
    const currentToken = tokenRef.current || token;
    console.log('CAPTCHA getToken:', currentToken ? 'has token' : 'no token');
    return currentToken;
  }, [token]);

  return { setToken, clearToken, getToken, token };
}

