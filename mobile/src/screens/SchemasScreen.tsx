import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { schemaApi } from '../api';

export default function SchemasScreen() {
  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => schemaApi.getSchemas(),
  });

  const list = data?.data?.data ?? data?.data ?? [];

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.code}>{item.code}</Text>
      {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
      <Text style={styles.rate}>Default payin: {(Number(item.payinRate || 0) * 100).toFixed(2)}%</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#6366f1" />}
      ListEmptyComponent={<Text style={styles.empty}>No schemas.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  card: { backgroundColor: '#111118', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  name: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  code: { fontSize: 13, color: '#6366f1', marginBottom: 4 },
  desc: { fontSize: 13, color: '#a1a1aa', marginBottom: 4 },
  rate: { fontSize: 12, color: '#71717a' },
  empty: { textAlign: 'center', color: '#71717a', marginTop: 24 },
});
