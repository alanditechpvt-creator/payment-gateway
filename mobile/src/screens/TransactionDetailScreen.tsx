import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { transactionApi } from '../api';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: { params: { transactionId: string } };
};

export default function TransactionDetailScreen({ route }: Props) {
  const transactionId = route.params?.transactionId;

  const { data, isLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => transactionApi.getTransactionById(transactionId),
    enabled: !!transactionId,
  });

  const tx = data?.data?.data ?? data?.data;

  const handleShare = async () => {
    if (!tx) return;
    const lines = [
      'PaymentGateway Transaction Receipt',
      '================================',
      `Transaction ID: ${tx.transactionId || tx.id}`,
      `Type: ${tx.type}`,
      `Status: ${tx.status}`,
      `Amount: ₹${Number(tx.amount || 0).toFixed(2)}`,
      `Net Amount: ₹${Number(tx.netAmount || 0).toFixed(2)}`,
      `PG: ${tx.paymentGateway?.name || tx.pgName || tx.pgId}`,
      `Created At: ${new Date(tx.createdAt).toLocaleString()}`,
      tx.customerName ? `Customer: ${tx.customerName}` : '',
      tx.customerEmail ? `Customer Email: ${tx.customerEmail}` : '',
    ].filter(Boolean);

    await Share.share({ message: lines.join('\n') });
  };

  if (!transactionId || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Transaction not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Transaction Receipt</Text>
        <Text style={styles.label}>Transaction ID</Text>
        <Text style={styles.value}>{tx.transactionId || tx.id}</Text>

        <Text style={styles.label}>Type</Text>
        <Text style={styles.value}>{tx.type}</Text>

        <Text style={styles.label}>Status</Text>
        <Text style={[styles.value, styles.status]}>{tx.status}</Text>

        <Text style={styles.label}>Amount</Text>
        <Text style={styles.value}>₹{Number(tx.amount || 0).toFixed(2)}</Text>

        <Text style={styles.label}>Net Amount</Text>
        <Text style={styles.value}>₹{Number(tx.netAmount || 0).toFixed(2)}</Text>

        <Text style={styles.label}>Payment Gateway</Text>
        <Text style={styles.value}>{tx.paymentGateway?.name || tx.pgName || tx.pgId}</Text>

        <Text style={styles.label}>Created At</Text>
        <Text style={styles.value}>{new Date(tx.createdAt).toLocaleString()}</Text>

        {tx.customerName ? (
          <>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{tx.customerName}</Text>
          </>
        ) : null}
        {tx.customerEmail ? (
          <>
            <Text style={styles.label}>Customer Email</Text>
            <Text style={styles.value}>{tx.customerEmail}</Text>
          </>
        ) : null}
      </View>
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareText}>Share receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  empty: { color: '#71717a' },
  card: {
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  label: { fontSize: 13, color: '#9ca3af', marginTop: 10 },
  value: { fontSize: 15, color: '#e5e7eb', marginTop: 2 },
  status: { fontWeight: '600', color: '#fbbf24' },
  shareBtn: {
    marginTop: 20,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

