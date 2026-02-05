'use client';

import React, { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface RazorpayCheckoutProps {
  transactionId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onSuccess?: (paymentId: string, orderId: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  description?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  autoOpen?: boolean;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const RazorpayCheckout: React.FC<RazorpayCheckoutProps> = ({
  transactionId,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onError,
  onClose,
  description,
  razorpayOrderId,
  razorpayKeyId,
  autoOpen = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const hasAutoOpened = useRef(false);

  // Load Razorpay script
  React.useEffect(() => {
    if (isScriptLoaded || scriptRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
    };
    script.onerror = (e) => {
      console.error('Razorpay script load error:', e);
      toast.error('Failed to load Razorpay script. Please check your internet connection or disable ad blockers.');
    };
    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
    };
  }, [isScriptLoaded]);

  const handlePaymentClick = useCallback(async () => {
    if (!isScriptLoaded) {
      toast.error('Razorpay script is still loading. Please wait...');
      return;
    }

    setIsLoading(true);

    try {
      let rzpOrderId = razorpayOrderId;
      let rzpKeyId = razorpayKeyId;

      if (!rzpOrderId) {
        // Step 1: Create order
        const orderResponse = await api.post('/razorpay/orders', {
          transactionId,
          amount,
          description: description || `Payment for transaction ${transactionId}`,
        });

        if (!orderResponse.data.success) {
          throw new Error(orderResponse.data.error || 'Failed to create order');
        }

        rzpOrderId = orderResponse.data.data.razorpayOrderId;
        rzpKeyId = orderResponse.data.data.keyId;
      }

      if (!rzpKeyId) {
        // Fallback to fetch key if not provided (though ideally backend should provide it)
        // For now assume it was provided or we can't proceed efficiently without refetching config
        // But let's proceed with what we have
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key: rzpKeyId,
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        name: 'Payment Gateway',
        description: description || `Payment for transaction ${transactionId}`,
        order_id: rzpOrderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        handler: async function (response: any) {
          try {
            // Step 3: Verify payment on backend
            const verifyResponse = await api.post('/razorpay/verify', {
              transactionId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (!verifyResponse.data.success) {
              throw new Error(verifyResponse.data.error || 'Payment verification failed');
            }

            toast.success('Payment successful!');
            onSuccess?.(response.razorpay_payment_id, response.razorpay_order_id);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Payment verification failed';
            toast.error(errorMsg);
            onError?.(errorMsg);
          }
        },
        modal: {
          ondismiss: function () {
            toast('Payment cancelled', { icon: 'ℹ️' });
            onClose?.();
          },
        },
        theme: {
          color: '#3b82f6', // Tailwind blue-500
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Something went wrong';
      toast.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [
    transactionId,
    amount,
    customerName,
    customerEmail,
    customerPhone,
    description,
    isScriptLoaded,
    onSuccess,
    onError,
    onClose,
  ]);

  // Reset auto-open flag when transaction ID changes
  React.useEffect(() => {
    hasAutoOpened.current = false;
  }, [transactionId]);

  // Auto-open checkout if enabled
  React.useEffect(() => {
    if (autoOpen && isScriptLoaded && !isLoading && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      handlePaymentClick();
    }
  }, [autoOpen, isScriptLoaded, isLoading, handlePaymentClick]);

  return (
    <button
      onClick={handlePaymentClick}
      disabled={isLoading || !isScriptLoaded}
      className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : !isScriptLoaded ? (
        'Loading Razorpay...'
      ) : (
        <>
          <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          Pay ₹{amount.toFixed(2)}
        </>
      )}
    </button>
  );
};

export default RazorpayCheckout;
