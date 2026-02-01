import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { walletApi, userApi } from '../api';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function TransferScreen({ navigation }: Props) {
  const [toUserId, setToUserId] = useState('');
  const [toUserName, setToUserName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users to transfer to
  const { data: usersData } = useQuery({
    queryKey: ['transfer-users', searchQuery],
    queryFn: () => userApi.getUsers({ 
      search: searchQuery,
      limit: 50 
    }),
  });

  const users = usersData?.data?.data || [];

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: (payload) =>
      walletApi.transfer(payload.toUserId, payload.amount, payload.description),
  });

  const handleTransfer = async () => {
    // Validation
    if (!toUserId) {
      Alert.alert('Error', 'Please select a recipient');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const result = await transferMutation.mutateAsync({
        toUserId,
        amount: Number(amount),
        description: description || `Transfer to ${toUserName}`,
      });

      Alert.alert('Success', 'Wallet transfer completed successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setToUserId('');
            setToUserName('');
            setAmount('');
            setDescription('');
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to transfer wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (user: any) => {
    setToUserId(user.id);
    setToUserName(`${user.firstName} ${user.lastName}`.trim() || user.email);
    setShowUserModal(false);
    setSearchQuery('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.header}>
          <Ionicons name="swap-horizontal" size={32} color="#fff" />
          <Text style={styles.headerTitle}>Wallet Transfer</Text>
          <Text style={styles.headerSubtitle}>Transfer funds to another user</Text>
        </LinearGradient>

        {/* Form */}
        <View style={styles.form}>
          {/* Recipient Section */}
          <Text style={styles.sectionTitle}>Recipient</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Recipient *</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowUserModal(true)}
              disabled={isLoading}
            >
              <View style={styles.selectButtonContent}>
                <Ionicons name="person-circle-outline" size={20} color="#71717a" />
                <Text
                  style={[
                    styles.selectButtonText,
                    toUserId && styles.selectButtonTextActive,
                  ]}
                >
                  {toUserName || 'Tap to select recipient'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#71717a" />
            </TouchableOpacity>
          </View>

          {/* Amount Section */}
          <Text style={styles.sectionTitle}>Transfer Amount</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount *</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={[styles.input, { paddingLeft: 10 }]}
                placeholder="Enter amount"
                placeholderTextColor="#71717a"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Add any notes or description"
                placeholderTextColor="#71717a"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Transfer Button */}
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          >
            <TouchableOpacity
              style={styles.submitButtonContent}
              onPress={handleTransfer}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Transfer Funds</Text>
                </>
              )}
            </TouchableOpacity>
          </LinearGradient>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* User Selection Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Recipient</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#71717a" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name or email..."
                placeholderTextColor="#71717a"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Users List */}
            {users.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#71717a" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No users found' : 'No users available'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userItem}
                    onPress={() => handleSelectUser(item)}
                  >
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {(item.firstName?.[0] || item.email[0]).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {`${item.firstName} ${item.lastName}`.trim() || item.email}
                      </Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                      <Text style={styles.userRole}>{item.role}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#71717a" />
                  </TouchableOpacity>
                )}
                scrollEnabled={true}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  form: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 12,
    marginTop: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  selectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectButtonText: {
    color: '#71717a',
    fontSize: 16,
    marginLeft: 8,
  },
  selectButtonTextActive: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  currencySymbol: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
    marginRight: 4,
  },
  textAreaContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 100,
  },
  textarea: {
    textAlignVertical: 'top',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    marginTop: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cancelButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  userEmail: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 2,
  },
  userRole: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#71717a',
    fontSize: 16,
    marginTop: 12,
  },
});
