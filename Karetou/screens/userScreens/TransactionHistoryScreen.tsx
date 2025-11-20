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
import { useAuth } from '../../contexts/AuthContext';
import TransactionService, { Transaction } from '../../services/TransactionService';

const TransactionHistoryScreen = () => {
  const navigation = useNavigation();
  const { theme, user } = useAuth();
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
      const userTransactions = await transactionService.getUserTransactions(user.uid);
      setTransactions(userTransactions);
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
            name="arrow-up-circle" 
            size={32} 
            color="#FF5733" 
          />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={[
            styles.businessName,
            { color: theme === 'dark' ? '#FFF' : '#333' }
          ]}>
            {item.businessName}
          </Text>
          <Text style={[
            styles.transactionDate,
            { color: theme === 'dark' ? '#AAA' : '#666' }
          ]}>
            {formatDate(item.timestamp)}
          </Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsText}>-{item.points}</Text>
          <Ionicons name="star" size={16} color="#FFD700" />
        </View>
      </View>
      <View style={styles.statusContainer}>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'completed' ? '#4CAF50' : '#FF9800' }
        ]}>
          <Text style={styles.statusText}>
            {item.status === 'completed' ? 'Completed' : item.status}
          </Text>
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
          >
            <Ionicons name="arrow-back" size={24} color={theme === 'dark' ? '#FFF' : '#333'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme === 'dark' ? '#FFF' : '#333' }]}>
            Transaction History
          </Text>
          <View style={styles.placeholder} />
        </View>

        {loading && transactions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, { color: theme === 'dark' ? '#FFF' : '#333' }]}>
              Loading transactions...
            </Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#999" />
            <Text style={[styles.emptyText, { color: theme === 'dark' ? '#CCC' : '#666' }]}>
              No transactions yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme === 'dark' ? '#AAA' : '#888' }]}>
              Your point transfers will appear here
            </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 34,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 15,
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
  },
  transactionIconContainer: {
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5733',
  },
  statusContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TransactionHistoryScreen;

