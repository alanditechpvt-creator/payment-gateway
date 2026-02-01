'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface CashfreeCheckoutProps {
  transactionId: string;
  paymentSessionId: string;
  amount: number;
  onSuccess?: (orderId: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  autoOpen?: boolean;
  isProduction?: boolean;
}

declare global {
  interface Window {
    Cashfree: any;
  }
}

export const CashfreeCheckout: React.FC<CashfreeCheckoutProps> = ({
  transactionId,
  paymentSessionId,
  amount,
  onSuccess,
  onError,
  onClose,
  autoOpen = false,
  isProduction = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const hasAutoOpened = useRef(false);
  const cashfreeRef = useRef<any>(null);

  // Load Cashfree SDK
  useEffect(() => {
    if (isScriptLoaded || scriptRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
      // Initialize Cashfree instance once script is loaded
      if (window.Cashfree) {
        cashfreeRef.current = window.Cashfree({
          mode: isProduction ? 'production' : 'sandbox',
        });
      }
    };
    script.onerror = (e) => {
      console.error('Cashfree script load error:', e);
      toast.error('Failed to load Cashfree SDK. Please check your internet connection.');
    };
    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
    };
  }, [isScriptLoaded, isProduction]);

  const handlePayment = useCallback(async () => {
    if (!isScriptLoaded || !cashfreeRef.current) {
      toast.error('Cashfree SDK is still loading. Please wait...');
      return;
    }

    if (!paymentSessionId) {
      toast.error('Invalid payment session');
      return;
    }

    setIsLoading(true);

    try {
      const checkoutOptions = {
        paymentSessionId,
        redirectTarget: '_modal',
      };

      cashfreeRef.current.checkout(checkoutOptions).then((result: any) => {
        if (result.error) {
          // This will be true when there is any error during the payment
          console.error('Cashfree payment error:', result.error);
          onError?.(result.error.message || 'Payment failed');
          setIsLoading(false);
        }
        if (result.paymentDetails) {
          // This will be called whenever the payment is completed irrespective of status
          console.log('Payment completed:', result.paymentDetails);
          
          // Verify payment on backend
          api.post('/cashfree/verify', { orderId: transactionId })
            .then((res) => {
              if (res.data.success && res.data.data.status === 'SUCCESS') {
                toast.success('Payment successful!');
                onSuccess?.(transactionId);
              } else {
                toast.error('Payment verification failed or pending.');
                onError?.('Payment verification failed');
              }
            })
            .catch((err) => {
              console.error('Verification error:', err);
              toast.error('Failed to verify payment status');
              onError?.(err.message);
            })
            .finally(() => {
              setIsLoading(false);
            });
        }
      });
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      toast.error(error.message || 'Failed to initiate payment');
      setIsLoading(false);
    }
  }, [isScriptLoaded, paymentSessionId, transactionId, onSuccess, onError]);

  // Auto-open logic
  useEffect(() => {
    if (autoOpen && isScriptLoaded && !isLoading && !hasAutoOpened.current && paymentSessionId) {
      hasAutoOpened.current = true;
      handlePayment();
    }
  }, [autoOpen, isScriptLoaded, isLoading, paymentSessionId, handlePayment]);

  return (
    <button
      onClick={handlePayment}
      disabled={isLoading || !isScriptLoaded}
      className="py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Processing...
        </>
      ) : (
        'Pay with Cashfree'
      )}
    </button>
  );
};
