'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface SabpaisaCheckoutProps {
  transactionId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onSuccess?: (txnId: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  description?: string;
  autoSubmit?: boolean;
}

export const SabpaisaCheckout: React.FC<SabpaisaCheckoutProps> = ({
  transactionId,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onError,
  onClose,
  description,
  autoSubmit = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasCreatedPayment = useRef(false);
  const hasAutoSubmitted = useRef(false);

  const createPayment = async () => {
    // Prevent multiple calls
    if (hasCreatedPayment.current || isLoading) {
      return null;
    }
    
    hasCreatedPayment.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      // Create payment request to get encrypted data
      const response = await api.post('/sabpaisa/create-payment', {
        amount,
        payerName: customerName,
        payerEmail: customerEmail,
        payerMobile: customerPhone,
        clientTxnId: transactionId,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create payment');
      }

      setPaymentData(response.data.data);
      toast.success('Redirecting to payment gateway...');
      
      return response.data.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Payment creation failed';
      setError(errorMsg);
      toast.error(errorMsg);
      onError?.(errorMsg);
      hasCreatedPayment.current = false; // Reset on error
      setIsLoading(false);
      return null;
    }
  };

  // Auto-submit form once payment data is loaded
  useEffect(() => {
    if (paymentData && formRef.current && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      // Small delay to ensure form is rendered
      setTimeout(() => {
        formRef.current?.submit();
      }, 500);
    }
  }, [paymentData]);

  // Reset flags when transaction ID changes
  useEffect(() => {
    hasCreatedPayment.current = false;
    hasAutoSubmitted.current = false;
    setPaymentData(null);
    setError(null);
  }, [transactionId]);

  // Auto-create payment if enabled (runs only once)
  useEffect(() => {
    if (autoSubmit && !hasCreatedPayment.current && !paymentData && !error) {
      createPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit]); // Only depend on autoSubmit to prevent loops

  const handlePaymentClick = async () => {
    if (paymentData) {
      // If payment data already exists, submit the form
      formRef.current?.submit();
    } else {
      // Create new payment
      await createPayment();
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden form for SabPaisa submission */}
      {paymentData && (
        <form
          ref={formRef}
          method="POST"
          action={paymentData.actionUrl}
          className="hidden"
        >
          <input type="hidden" name="encData" value={paymentData.encData} />
          <input type="hidden" name="clientCode" value={paymentData.clientCode} />
        </form>
      )}

      {/* Error Display */}
      {error && !isLoading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              hasCreatedPayment.current = false;
              createPayment();
            }}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Payment Button */}
      {!autoSubmit && !error && (
        <button
          onClick={handlePaymentClick}
          disabled={isLoading}
          className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : paymentData ? (
            <>
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              Proceed to Payment
            </>
          ) : (
            <>
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Pay ₹{amount.toFixed(2)}
            </>
          )}
        </button>
      )}

      {/* Loading indicator for auto-submit */}
      {autoSubmit && isLoading && !error && (
        <div className="text-center py-8">
          <div className="inline-block">
            <svg className="animate-spin h-12 w-12 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="mt-4 text-gray-600">Preparing payment gateway...</p>
          <p className="mt-2 text-sm text-gray-500">Please do not close or refresh this page</p>
        </div>
      )}
    </div>
  );
};

export default SabpaisaCheckout;
