import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { rateApi } from '../api';

export default function RatesScreen() {
  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['my-rates'],
    queryFn: () => rateApi.getMyRates(),
  });

  const res = data?.data?.data ?? data?.data;
  const rates = Array.isArray(res?.rates) ? res.rates : (Array.isArray(res) ? res : []);

  if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#6366f1" />}>
      <Text style={styles.title}>My rates</Text>
      <Text style={styles.subtitle}>Rates assigned to you</Text>
      {rates.length === 0 ? (
        <Text style={styles.empty}>No rates assigned yet.</Text>
      ) : (
        rates.map((r: any) => (
          <View key={r.pgId || r.id} style={styles.card}>
            <Text style={styles.pgName}>{r.paymentGateway?.name || r.pgName || 'PG'}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Payin</Text>
              <Text style={styles.value}>{r.payinRate != null ? `${(Number(r.payinRate) * 100).toFixed(2)}%` : '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Payout</Text>
              <Text style={styles.value}>{r.payoutRate != null ? `${(Number(r.payoutRate) * 100).toFixed(2)}%` : 'Slab'}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#71717a', marginBottom: 20 },
  card: { backgroundColor: '#111118', borderRadius: 12, padding: 16, marginBottom: 12 },
  pgName: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, color: '#a1a1aa' },
  value: { fontSize: 14, fontWeight: '600', color: '#10b981' },
  empty: { textAlign: 'center', color: '#71717a', marginTop: 24 },
});
