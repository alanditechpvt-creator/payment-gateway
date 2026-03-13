import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rateApi } from '../api';
import { useAuthStore } from '../store/auth';
import { Ionicons } from '@expo/vector-icons';

export default function RateHierarchyScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedPgId, setSelectedPgId] = useState<string | null>(null);

  const canAssign =
    user && ['ADMIN', 'WHITE_LABEL', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR'].includes(user.role);

  // My rates (to use as source for bulk copy)
  const { data: myRatesRes, isLoading: myRatesLoading } = useQuery({
    queryKey: ['my-rates'],
    queryFn: () => rateApi.getMyRates(),
    enabled: !!canAssign,
  });

  // Available PGs for assignment (names / ids)
  const { data: pgRes, isLoading: pgLoading } = useQuery({
    queryKey: ['rate-available-pgs'],
    queryFn: () => rateApi.getAvailablePGsForAssignment(),
    enabled: !!canAssign,
  });

  const { data: childrenRes, isLoading: childrenLoading } = useQuery({
    queryKey: ['children-rates', selectedPgId],
    queryFn: () => rateApi.getChildrenRates(selectedPgId || undefined),
    enabled: !!canAssign,
  });

  const bulkMutation = useMutation({
    mutationFn: (assignments: Array<{ targetUserId: string; pgId: string; payinRate: number; payoutRate: number }>) =>
      rateApi.bulkAssignRates(assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children-rates'] });
      Alert.alert('Success', 'Rates applied to downline users');
    },
    onError: (e: any) => {
      Alert.alert('Error', e.response?.data?.error || 'Failed to apply rates');
    },
  });

  if (!canAssign) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={56} color="#71717a" />
        <Text style={styles.emptyTitle}>No permission</Text>
        <Text style={styles.emptyText}>Only Admin / WL / MD / Distributor can manage downline rates.</Text>
      </View>
    );
  }

  const myRatesData = myRatesRes?.data?.data ?? myRatesRes?.data ?? {};
  const myRatesArr: any[] = myRatesData.rates ?? myRatesData ?? [];
  const pgs: any[] = pgRes?.data?.data ?? pgRes?.data ?? [];
  const children: any[] = childrenRes?.data?.data ?? childrenRes?.data ?? [];

  const currentPgId = selectedPgId || (pgs[0]?.pgId || pgs[0]?.id || null);

  const myRateForCurrentPg = myRatesArr.find(
    (r) => r.pgId === currentPgId || r.paymentGateway?.id === currentPgId
  );

  const handleBulkApply = () => {
    if (!currentPgId) {
      Alert.alert('Error', 'Select a payment gateway first');
      return;
    }
    if (!myRateForCurrentPg) {
      Alert.alert('Error', 'You do not have a base rate for this PG yet.');
      return;
    }
    if (!children.length) {
      Alert.alert('Error', 'No downline users found to apply rates to.');
      return;
    }

    Alert.alert(
      'Apply rates',
      'Apply your current rate for this PG to all downline users?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            const payinRate = Number(myRateForCurrentPg.payinRate ?? 0);
            const payoutRate = Number(myRateForCurrentPg.payoutRate ?? 0);
            const assignments = children.map((c: any) => ({
              targetUserId: c.userId || c.id,
              pgId: currentPgId,
              payinRate,
              payoutRate,
            }));
            bulkMutation.mutate(assignments);
          },
        },
      ]
    );
  };

  const renderChild = ({ item }: { item: any }) => {
    const rate = item.rate || item;
    const userInfo = item.user || item;
    return (
      <View style={styles.childCard}>
        <View style={styles.childHeader}>
          <Text style={styles.childName}>
            {userInfo.firstName || userInfo.lastName
              ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
              : userInfo.email}
          </Text>
          <Text style={styles.childRole}>{userInfo.role?.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.childEmail}>{userInfo.email}</Text>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Payin</Text>
          <Text style={styles.rateValue}>
            {rate.payinRate != null ? `${(Number(rate.payinRate) * 100).toFixed(2)}%` : '-'}
          </Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Payout</Text>
          <Text style={styles.rateValue}>
            {rate.payoutRate != null ? `${(Number(rate.payoutRate) * 100).toFixed(2)}%` : 'Slab'}
          </Text>
        </View>
      </View>
    );
  };

  if (myRatesLoading || pgLoading || childrenLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Downline rates</Text>
      <Text style={styles.subtitle}>View and bulk-apply your rates to your downline users.</Text>

      {/* PG selector */}
      <View style={styles.pgSelector}>
        {pgs.length === 0 ? (
          <Text style={styles.emptyText}>No payment gateways available for assignment.</Text>
        ) : (
          <View style={styles.pgChips}>
            {pgs.map((pg: any) => {
              const id = pg.pgId || pg.id;
              const active = (currentPgId || '') === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.pgChip, active && styles.pgChipActive]}
                  onPress={() => setSelectedPgId(id)}
                >
                  <Text style={[styles.pgChipText, active && styles.pgChipTextActive]}>
                    {pg.paymentGateway?.name || pg.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* My rate for current PG */}
      {currentPgId && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>My rate for selected PG</Text>
          {myRateForCurrentPg ? (
            <>
              <Text style={styles.sectionLine}>
                Payin:{' '}
                <Text style={styles.sectionValue}>
                  {(Number(myRateForCurrentPg.payinRate || 0) * 100).toFixed(2)}%
                </Text>
              </Text>
              <Text style={styles.sectionLine}>
                Payout:{' '}
                <Text style={styles.sectionValue}>
                  {myRateForCurrentPg.payoutRate != null
                    ? `${(Number(myRateForCurrentPg.payoutRate) * 100).toFixed(2)}%`
                    : 'Slab'}
                </Text>
              </Text>
            </>
          ) : (
            <Text style={styles.emptyText}>
              You do not have a base rate for this PG yet.
            </Text>
          )}
        </View>
      )}

      {/* Children list */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Downline users</Text>
          {children.length > 0 && (
            <TouchableOpacity
              style={styles.bulkBtn}
              onPress={handleBulkApply}
              disabled={bulkMutation.isPending}
            >
              <Ionicons name="copy-outline" size={18} color="#6366f1" />
              <Text style={styles.bulkBtnText}>
                {bulkMutation.isPending ? 'Applying...' : 'Apply my rate to all'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {children.length === 0 ? (
          <Text style={styles.emptyText}>No downline users found.</Text>
        ) : (
          <FlatList
            data={children}
            keyExtractor={(item) => item.userId || item.id}
            renderItem={renderChild}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#71717a', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#71717a', marginTop: 4 },
  pgSelector: { marginBottom: 12 },
  pgChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pgChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
  },
  pgChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pgChipText: { color: '#e5e7eb', fontSize: 13 },
  pgChipTextActive: { color: '#fff', fontWeight: '600' },
  sectionCard: {
    backgroundColor: '#111118',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 8 },
  sectionLine: { fontSize: 14, color: '#a1a1aa', marginTop: 2 },
  sectionValue: { color: '#22c55e', fontWeight: '600' },
  childCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  childHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  childRole: { fontSize: 12, color: '#a5b4fc' },
  childEmail: { fontSize: 13, color: '#9ca3af', marginTop: 2, marginBottom: 6 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  rateLabel: { fontSize: 13, color: '#9ca3af' },
  rateValue: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4f46e5',
    gap: 6,
  },
  bulkBtnText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
});

