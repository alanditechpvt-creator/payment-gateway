import React, { useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'PaymentWebView'>;
};

import { transactionApi, api } from '../api';

export default function PaymentWebViewScreen({ navigation, route }: Props) {
  const { url, html, type, pgCode, successUrl, failureUrl, transactionId, orderId: routeOrderId } = route.params || {};
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to extract params from URL
  const getParams = (url: string) => {
    const params: any = {};
    const parser = url.split('?')[1];
    if (parser) {
      const vars = parser.split('&');
      for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split('=');
        params[pair[0]] = decodeURIComponent(pair[1]);
      }
    }
    return params;
  };
  
  // Verify transaction status on backend
  const verifyTransaction = async (referenceId: string) => {
    if (!referenceId) {
       navigation.goBack();
       return;
    }
    
    try {
      setIsLoading(true);
      console.log('Verifying transaction status for:', referenceId);
      
      // Call backend to verify status with PG
      const response = await api.get(`/webhooks/status/${referenceId}`);
      
      console.log('Verification response:', response.data);

      if (response.data.success && (response.data.status === 'SUCCESS' || response.data.status === 'PAID')) {
         Alert.alert('Payment Successful', 'Your transaction has been verified successfully.', [
             { text: 'OK', onPress: () => navigation.goBack() }
         ]);
      } else if (response.data.status === 'FAILED' || response.data.status === 'FAILURE') {
         Alert.alert('Payment Failed', 'Transaction marked as failed by payment gateway.', [
             { text: 'OK', onPress: () => navigation.goBack() }
         ]);
      } else {
         // Still pending
         const status = response.data.status || 'PENDING';
         Alert.alert('Payment Processing', `Current status: ${status}. Please check your transaction history shortly.`, [
             { text: 'OK', onPress: () => navigation.goBack() }
         ]);
      }
    } catch (error) {
      console.error('Verification failed', error);
      Alert.alert('Payment Processing', 'We received your payment request. Please check transaction history for updates.', [
         { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;

    // Check for success/failure callbacks
    // Note: Adjust these checks based on your actual return URLs
    // Sabpaisa: Check for /payment/success or /payment/failure
    if (url.includes('status=SUCCESS') || url.includes('payment_status=Credit') || url.includes('/payment/success') || url.includes('/status/success') || (successUrl && url.startsWith(successUrl))) {
      // Success
      // Try to get orderId from params if available, or use the one passed in route
      const params = getParams(url);
      const verifyId = params.txnId || params.order_id || params.orderId || routeOrderId;
      
      if (verifyId) {
          verifyTransaction(verifyId);
      } else {
          navigation.goBack();
          Alert.alert('Payment Successful', 'Your transaction has been processed successfully.');
      }
      return;
    }

    if (url.includes('status=FAILED') || url.includes('payment_status=Failed') || url.includes('/payment/failure') || url.includes('/status/failure') || (failureUrl && url.startsWith(failureUrl))) {
      // Failure
      const params = getParams(url);
      const verifyId = params.txnId || params.order_id || params.orderId || routeOrderId;
      
      if (verifyId) {
          // Even if failed, verify to update backend
          verifyTransaction(verifyId);
      } else {
          navigation.goBack();
          Alert.alert('Payment Failed', 'Your transaction could not be processed.');
      }
      return;
    }
  };

  const renderContent = () => {
    if (type === 'RAZORPAY' && url) {
      // Extract key_id and order_id from the constructing URL provided by backend
      // Backend URL format: https://checkout.razorpay.com/?key_id=...&order_id=...
      const params = getParams(url);
      const keyId = params.key_id;
      const orderId = params.order_id;
      
      // Custom HTML for Razorpay
      // We use the standard checkout.js
      const razorpayHtml = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f0f0; font-family: sans-serif; }
              .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div id="loader" class="loader"></div>
            <p style="margin-top: 20px; text-align: center;">Initializing Payment...</p>
            <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
            <script>
              var options = {
                "key": "${keyId}",
                "order_id": "${orderId}",
                "name": "Merchant Name",
                "description": "Transaction Payment",
                "image": "https://your-logo-url.com/logo.png",
                "handler": function (response){
                  // Send success to React Native
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SUCCESS',
                    payload: response
                  }));
                },
                "modal": {
                  "ondismiss": function(){
                    // Send dismiss to React Native
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'DISMISS'
                    }));
                  }
                },
                "theme": {
                  "color": "#3399cc"
                }
              };
              
              // Auto open
              var rzp1 = new Razorpay(options);
              rzp1.on('payment.failed', function (response){
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'FAILED',
                  payload: response.error
                }));
              });
              
              // Wait a bit for page load then open
              setTimeout(function() {
                 rzp1.open();
                 document.getElementById('loader').style.display = 'none';
              }, 500);
            </script>
          </body>
        </html>
      `;
      
      return (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: razorpayHtml }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'SUCCESS') {
                console.log('Razorpay Success:', data.payload);
                // Use the order_id from payload or params
                const verifyId = data.payload.razorpay_order_id || orderId || routeOrderId;
                verifyTransaction(verifyId);
              } else if (data.type === 'FAILED') {
                 // Even if failed, verify to update backend
                 const verifyId = data.payload.metadata?.order_id || orderId || routeOrderId;
                 if (verifyId) verifyTransaction(verifyId);
                 else {
                    navigation.goBack();
                    Alert.alert('Payment Failed', data.payload.description);
                 }
              } else if (data.type === 'DISMISS') {
                navigation.goBack();
              }
            } catch (e) {
              console.error('WebView message parse error', e);
            }
          }}
          style={{ flex: 1 }}
        />
      );
    }

    // Default: Load URL directly (Cashfree, SabPaisa, RunPaisa, etc.)
    return (
      <WebView
        ref={webViewRef}
        source={
          type === 'HTML' ? { html: html || '' } : { 
            uri: url || '',
            headers: {
              'ngrok-skip-browser-warning': 'true',
              'User-Agent': 'PaymentGatewayApp/1.0',
            }
          }
        }
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            console.log('WebView Message:', data);
            
            if (data.type === 'PAYMENT_SUCCESS' || data.type === 'SUCCESS') {
               const verifyId = data.txnId || data.payload?.razorpay_order_id || routeOrderId;
               verifyTransaction(verifyId);
            } else if (data.type === 'PAYMENT_FAILURE' || data.type === 'FAILED') {
               const verifyId = data.txnId || data.payload?.metadata?.order_id || routeOrderId;
               if (verifyId) verifyTransaction(verifyId);
               else {
                   navigation.goBack();
                   Alert.alert('Payment Failed', data.reason || data.payload?.description || 'Transaction failed');
               }
            }
          } catch (e) {
            console.log('WebView message parse error (might be non-JSON):', event.nativeEvent.data);
          }
        }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        style={{ flex: 1 }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {renderContent()}
      {isLoading && (type !== 'RAZORPAY') && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
