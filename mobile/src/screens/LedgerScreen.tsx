import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '../api';
import { format } from 'date-fns';

export default function LedgerScreen() {
  const [page, setPage] = useState(1);
  const limit = 30;
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const params: any = { page, limit };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['ledger', page, startDate, endDate],
    queryFn: () => ledgerApi.getMyLedger(params),
  });

  const res = data?.data?.data ?? data?.data;
  const entries = res?.entries ?? [];
  const summary = res?.summary ?? {};
  const pagination = res?.pagination ?? { totalPages: 1, page: 1 };

  const renderItem = ({ item }: { item: any }) => {
    const credit = item.credit || 0;
    const debit = item.debit || 0;
    return (
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.date}>{format(new Date(item.date), 'dd MMM yyyy')}</Text>
          <Text style={styles.desc} numberOfLines={1}>{item.description || item.type}</Text>
        </View>
        <View style={styles.amounts}>
          {credit > 0 && <Text style={[styles.amount, styles.credit]}>+{credit.toFixed(2)}</Text>}
          {debit > 0 && <Text style={[styles.amount, styles.debit]}>-{debit.toFixed(2)}</Text>}
        </View>
        <Text style={styles.balance}>{Number(item.balance || 0).toFixed(2)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Ledger Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Opening</Text>
          <Text style={styles.summaryValue}>{Number(summary.openingBalance || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, styles.credit]}>Credits</Text>
          <Text style={[styles.summaryValue, styles.credit]}>{Number(summary.totalCredits || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, styles.debit]}>Debits</Text>
          <Text style={[styles.summaryValue, styles.debit]}>{Number(summary.totalDebits || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Closing</Text>
          <Text style={styles.summaryValue}>{Number(summary.closingBalance || 0).toFixed(2)}</Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Entries</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={styles.empty}>No ledger entries.</Text>}
        />
      )}
      {pagination.totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={styles.pageBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.pageText}>Page {page} of {pagination.totalPages}</Text>
          <TouchableOpacity onPress={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages} style={styles.pageBtn}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', padding: 16 },
  summary: { backgroundColor: '#111118', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#a1a1aa' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  cell: { flex: 1 },
  date: { fontSize: 12, color: '#71717a', marginBottom: 2 },
  desc: { fontSize: 14, color: '#fff' },
  amounts: { minWidth: 80, alignItems: 'flex-end' },
  amount: { fontSize: 14, fontWeight: '600' },
  credit: { color: '#10b981' },
  debit: { color: '#ef4444' },
  balance: { fontSize: 12, color: '#a1a1aa', marginLeft: 8 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: '#71717a', marginTop: 24 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 16 },
  pageBtn: { padding: 8 },
  pageText: { color: '#a1a1aa', fontSize: 14 },
});
