import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import TransactionService, { Transaction } from '../../services/TransactionService';
import { useResponsive } from '../../hooks/useResponsive';
import { ResponsiveText, ResponsiveView } from '../../components';

const TransactionHistoryScreen = () => {
  const navigation = useNavigation();
  const { theme, user } = useAuth();
  const { spacing, fontSizes, iconSizes, borderRadius: borderRadiusValues, dimensions, responsiveHeight, responsiveWidth } = useResponsive();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const transactionService = TransactionService.getInstance();

  // Calculate responsive values
  const isSmallScreen = (dimensions?.width || 360) < 360;
  const isSmallDevice = dimensions?.isSmallDevice || false;
  const minTouchTarget = 44;
  
  // Calculate header padding
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerPaddingTop = Platform.OS === 'ios' 
    ? (spacing?.md || 12) + (isSmallDevice ? (spacing?.xs || 4) : (spacing?.sm || 8))
    : statusBarHeight + (spacing?.sm || 8);

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

  // Create responsive styles using useMemo
  const styles = useMemo(() => StyleSheet.create({
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
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingTop: headerPaddingTop,
      paddingBottom: spacing?.sm || 8,
      backgroundColor: theme === 'light' ? '#F5F5F5' : '#232526',
      borderBottomWidth: 1,
      borderBottomColor: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
    },
    backButton: {
      padding: spacing?.xs || 4,
      backgroundColor: theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
      borderRadius: borderRadiusValues?.lg || 20,
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: fontSizes?.xl || 20,
      fontWeight: 'bold',
      color: theme === 'light' ? '#333' : '#fff',
      flex: 1,
      textAlign: 'center',
    },
    placeholder: {
      width: minTouchTarget,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: responsiveHeight(15) || 120,
    },
    loadingText: {
      marginTop: spacing?.md || 12,
      fontSize: fontSizes?.md || 16,
      color: theme === 'light' ? '#333' : '#fff',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? (spacing?.md || 12) : (spacing?.xl || 24),
      paddingTop: responsiveHeight(15) || 120,
    },
    emptyText: {
      fontSize: fontSizes?.xl || 20,
      fontWeight: 'bold',
      marginTop: spacing?.md || 12,
      color: theme === 'light' ? '#666' : '#ccc',
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: fontSizes?.sm || 14,
      marginTop: spacing?.sm || 8,
      textAlign: 'center',
      color: theme === 'light' ? '#888' : '#aaa',
      paddingHorizontal: spacing?.md || 12,
    },
    listContainer: {
      padding: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingBottom: spacing?.xl || 24,
      flexGrow: 1,
    },
    transactionCard: {
      borderRadius: borderRadiusValues?.md || 12,
      padding: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      marginBottom: spacing?.sm || 8,
      backgroundColor: theme === 'light' ? '#fff' : '#2a2a2a',
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
      marginRight: spacing?.sm || 8,
      width: responsiveWidth(12) || 48,
      height: responsiveWidth(12) || 48,
      minWidth: 40,
      minHeight: 40,
      maxWidth: 56,
      maxHeight: 56,
      justifyContent: 'center',
      alignItems: 'center',
    },
    transactionInfo: {
      flex: 1,
      minWidth: 0,
    },
    businessName: {
      fontSize: fontSizes?.md || 16,
      fontWeight: '600',
      marginBottom: spacing?.xs || 4,
      color: theme === 'light' ? '#333' : '#fff',
    },
    transactionDate: {
      fontSize: fontSizes?.xs || 12,
      color: theme === 'light' ? '#666' : '#aaa',
    },
    pointsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing?.xs || 4,
      flexShrink: 0,
    },
    pointsText: {
      fontSize: fontSizes?.lg || 18,
      fontWeight: 'bold',
      color: '#FF5733',
    },
    statusContainer: {
      marginTop: spacing?.sm || 8,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    statusBadge: {
      paddingHorizontal: isSmallScreen ? (spacing?.sm || 8) : (spacing?.md || 12),
      paddingVertical: spacing?.xs || 4,
      borderRadius: borderRadiusValues?.md || 12,
      minHeight: minTouchTarget / 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusText: {
      color: '#FFF',
      fontSize: fontSizes?.xs || 12,
      fontWeight: '600',
    },
  }), [spacing, fontSizes, iconSizes, borderRadiusValues, dimensions, isSmallScreen, isSmallDevice, minTouchTarget, headerPaddingTop, responsiveHeight, responsiveWidth, theme]);

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <ResponsiveView style={styles.transactionCard}>
      <ResponsiveView style={styles.transactionHeader}>
        <ResponsiveView style={styles.transactionIconContainer}>
          <Ionicons 
            name="arrow-up-circle" 
            size={iconSizes?.lg || 32} 
            color="#FF5733" 
          />
        </ResponsiveView>
        <ResponsiveView style={styles.transactionInfo}>
          <ResponsiveText size="md" weight="600" color={theme === 'light' ? '#333' : '#fff'} style={styles.businessName}>
            {item.businessName}
          </ResponsiveText>
          <ResponsiveText size="xs" color={theme === 'light' ? '#666' : '#aaa'} style={styles.transactionDate}>
            {formatDate(item.timestamp)}
          </ResponsiveText>
        </ResponsiveView>
        <ResponsiveView style={styles.pointsContainer}>
          <ResponsiveText size="lg" weight="bold" color="#FF5733" style={styles.pointsText}>
            -{item.points}
          </ResponsiveText>
          <Ionicons name="star" size={iconSizes?.sm || 16} color="#FFD700" />
        </ResponsiveView>
      </ResponsiveView>
      <ResponsiveView style={styles.statusContainer}>
        <ResponsiveView style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'completed' ? '#4CAF50' : '#FF9800' }
        ]}>
          <ResponsiveText size="xs" weight="600" color="#fff" style={styles.statusText}>
            {item.status === 'completed' ? 'Completed' : item.status}
          </ResponsiveText>
        </ResponsiveView>
      </ResponsiveView>
    </ResponsiveView>
  );

  return (
    <LinearGradient colors={theme === 'light' ? lightGradient : darkGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <ResponsiveView style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={iconSizes?.md || 24} color={theme === 'light' ? '#333' : '#fff'} />
          </TouchableOpacity>
          <ResponsiveText size="xl" weight="bold" color={theme === 'light' ? '#333' : '#fff'} style={styles.headerTitle}>
            Transaction History
          </ResponsiveText>
          <View style={styles.placeholder} />
        </ResponsiveView>

        {loading && transactions.length === 0 ? (
          <ResponsiveView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme === 'light' ? '#667eea' : '#fff'} />
            <ResponsiveText size="md" color={theme === 'light' ? '#333' : '#fff'} style={styles.loadingText}>
              Loading transactions...
            </ResponsiveText>
          </ResponsiveView>
        ) : transactions.length === 0 ? (
          <ResponsiveView style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={iconSizes?.xxxxl || 64} color={theme === 'light' ? '#999' : '#666'} />
            <ResponsiveText size="xl" weight="bold" color={theme === 'light' ? '#666' : '#ccc'} style={styles.emptyText}>
              No transactions yet
            </ResponsiveText>
            <ResponsiveText size="sm" color={theme === 'light' ? '#888' : '#aaa'} style={styles.emptySubtext}>
              Your point transfers will appear here
            </ResponsiveText>
          </ResponsiveView>
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
                colors={['#667eea']}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

export default TransactionHistoryScreen;
