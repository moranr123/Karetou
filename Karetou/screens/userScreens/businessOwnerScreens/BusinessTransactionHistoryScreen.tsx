import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import TransactionService, { Transaction } from '../../../services/TransactionService';
import { useResponsive } from '../../../hooks/useResponsive';
import { ResponsiveText } from '../../../components';

const BusinessTransactionHistoryScreen = () => {
  const navigation = useNavigation();
  const { theme, user } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius, dimensions } = useResponsive();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const transactionService = TransactionService.getInstance();

  const lightGradient = ['#F5F5F5', '#F5F5F5'] as const;
  const darkGradient = ['#232526', '#414345'] as const;

  const loadTransactions = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      // Get all transactions for all businesses owned by this user
      const allTransactions = await transactionService.getAllBusinessOwnerTransactions(user.uid);
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  useEffect(() => {
    loadTransactions();
  }, [user?.uid]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={[
      styles.transactionCard,
      { backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff' }
    ]}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionIconContainer}>
          <Ionicons 
            name="arrow-down-circle" 
            size={iconSizes.xxl} 
            color="#4CAF50" 
          />
        </View>
        <View style={styles.transactionInfo}>
          <ResponsiveText 
            size="md" 
            weight="600" 
            color={theme === 'dark' ? '#FFF' : '#333'} 
            style={styles.senderName}
            numberOfLines={1}
          >
            {item.userName}
          </ResponsiveText>
          <ResponsiveText 
            size="sm" 
            color={theme === 'dark' ? '#AAA' : '#666'} 
            style={styles.businessName}
            numberOfLines={1}
          >
            {item.businessName}
          </ResponsiveText>
          <ResponsiveText 
            size="xs" 
            color={theme === 'dark' ? '#AAA' : '#666'} 
            style={styles.transactionDate}
          >
            {formatDate(item.timestamp)}
          </ResponsiveText>
        </View>
        <View style={styles.pointsContainer}>
          <ResponsiveText size="lg" weight="bold" color="#4CAF50" style={styles.pointsText}>
            +{item.points}
          </ResponsiveText>
          <Ionicons name="star" size={iconSizes.sm} color="#FFD700" />
        </View>
      </View>
      <View style={styles.statusContainer}>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'completed' ? '#4CAF50' : '#FF9800' }
        ]}>
          <ResponsiveText size="xs" weight="600" color="#fff" style={styles.statusText}>
            {item.status === 'completed' ? 'Completed' : item.status}
          </ResponsiveText>
        </View>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={iconSizes.lg} color={theme === 'dark' ? '#FFF' : '#333'} />
          </TouchableOpacity>
          <ResponsiveText size="lg" weight="bold" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.headerTitle}>
            Received Points
          </ResponsiveText>
          <View style={styles.placeholder} />
        </View>

        {loading && transactions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <ResponsiveText size="md" color={theme === 'dark' ? '#FFF' : '#333'} style={styles.loadingText}>
              Loading transactions...
            </ResponsiveText>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={iconSizes.xxxxl} color="#999" />
            <ResponsiveText size="lg" weight="600" color={theme === 'dark' ? '#CCC' : '#666'} style={styles.emptyText}>
              No points received yet
            </ResponsiveText>
            <ResponsiveText size="sm" color={theme === 'dark' ? '#AAA' : '#888'} style={styles.emptySubtext}>
              Points sent by users will appear here
            </ResponsiveText>
          </View>
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme === 'dark' ? '#FFF' : '#333'}
              />
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '5%',
    paddingVertical: 15,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 5,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 34,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 20,
  },
  emptySubtext: {
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  listContainer: {
    padding: '4%',
    paddingBottom: 30,
  },
  transactionCard: {
    borderRadius: 12,
    padding: '4%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  transactionIconContainer: {
    marginRight: 12,
    flexShrink: 0,
  },
  transactionInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  senderName: {
    marginBottom: 4,
  },
  businessName: {
    marginBottom: 4,
  },
  transactionDate: {
    // Styles handled by ResponsiveText
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  pointsText: {
    color: '#4CAF50',
  },
  statusContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#FFF',
  },
});

export default BusinessTransactionHistoryScreen;

