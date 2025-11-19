import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
  Pagination,
} from '@mui/material';
import {
  History as HistoryIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface HistoryLogEntry {
  id: string;
  action: string;
  actionType: 'approve' | 'reject' | 'edit' | 'delete' | 'view' | 'create' | 'deactivate' | 'activate' | 'login' | 'logout';
  targetType: 'business' | 'user' | 'admin' | 'report';
  targetName: string;
  targetId: string;
  adminEmail: string;
  adminId: string;
  timestamp: Timestamp;
  details?: string;
}

const HistoryLog: React.FC = () => {
  const { user } = useAuth();
  const [historyLogs, setHistoryLogs] = useState<HistoryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchHistoryLogs = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const historyRef = collection(db, 'adminHistoryLogs');
      
      let q;
      
      // Apply date filter at query level if not 'all'
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }
        
        q = query(
          historyRef,
          where('adminId', '==', user.uid),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          orderBy('timestamp', 'desc')
        );
      } else {
        q = query(
          historyRef,
          where('adminId', '==', user.uid),
          orderBy('timestamp', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);

      const logs: HistoryLogEntry[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
        } as HistoryLogEntry);
      });

      console.log('Fetched history logs:', logs.length, logs);
      setHistoryLogs(logs);
    } catch (error) {
      console.error('Error fetching history logs:', error);
      setHistoryLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryLogs();
  }, [dateFilter, user?.uid]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filter changes
  }, [dateFilter]);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'approve':
        return <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />;
      case 'reject':
        return <CancelIcon sx={{ color: '#F44336', fontSize: 20 }} />;
      case 'edit':
        return <EditIcon sx={{ color: '#2196F3', fontSize: 20 }} />;
      case 'delete':
        return <DeleteIcon sx={{ color: '#F44336', fontSize: 20 }} />;
      case 'view':
        return <ViewIcon sx={{ color: '#667eea', fontSize: 20 }} />;
      case 'create':
        return <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />;
      case 'deactivate':
        return <CancelIcon sx={{ color: '#FF9800', fontSize: 20 }} />;
      case 'activate':
        return <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />;
      case 'login':
        return <CheckIcon sx={{ color: '#2196F3', fontSize: 20 }} />;
      case 'logout':
        return <CancelIcon sx={{ color: '#9E9E9E', fontSize: 20 }} />;
      default:
        return <HistoryIcon sx={{ color: '#667eea', fontSize: 20 }} />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'approve':
      case 'activate':
      case 'create':
        return '#4CAF50';
      case 'reject':
      case 'delete':
        return '#F44336';
      case 'edit':
        return '#2196F3';
      case 'deactivate':
        return '#FF9800';
      case 'view':
      case 'login':
      case 'logout':
        return '#667eea';
      default:
        return '#667eea';
    }
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'business':
        return <BusinessIcon sx={{ fontSize: 18, color: '#667eea' }} />;
      case 'user':
      case 'admin':
        return <PersonIcon sx={{ fontSize: 18, color: '#667eea' }} />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate();
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1a1a2e' }}>
          History Log
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track all your actions and activities in the admin panel.
        </Typography>
      </Box>

      {/* History Log Card */}
      <Paper 
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', 
          borderRadius: 3, 
          border: '1px solid #e0e0e0',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a2e' }}>
            Activity Log
          </Typography>
          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
              <InputLabel>Date Filter</InputLabel>
              <Select
                value={dateFilter}
                label="Date Filter"
                onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">Last 7 Days</MenuItem>
                <MenuItem value="month">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh History Log">
              <IconButton 
                onClick={fetchHistoryLogs}
                disabled={loading}
                sx={{ 
                  bgcolor: '#667eea',
                  color: '#fff',
                  '&:hover': { bgcolor: '#5568d3' },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : historyLogs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <HistoryIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Activity Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dateFilter !== 'all' 
                ? `No activities found for the selected period.`
                : 'Activity logs will appear here as you perform actions.'}
            </Typography>
          </Box>
        ) : (
          <>
            <List sx={{ minHeight: '300px', pr: 1 }}>
              {historyLogs
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((log, index, array) => {
                  const actionColor = getActionColor(log.actionType);
                  
                  return (
                    <React.Fragment key={log.id}>
                      <ListItem 
                        alignItems="flex-start"
                        sx={{
                          mb: 1,
                          p: 2,
                          borderRadius: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.8)',
                          border: `1px solid ${actionColor}20`,
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 1)',
                            boxShadow: `0 2px 8px ${actionColor}15`,
                            transform: 'translateX(4px)',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 48 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              bgcolor: `${actionColor}15`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {getActionIcon(log.actionType)}
                          </Box>
                        </ListItemIcon>
                        <Box sx={{ flex: 1, ml: 2 }}>
                          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1a1a2e' }}>
                              {log.action}
                            </Typography>
                            <Chip 
                              label={log.actionType.toUpperCase()} 
                              size="small" 
                              sx={{ 
                                bgcolor: `${actionColor}20`,
                                color: actionColor,
                                fontWeight: 600,
                                fontSize: '0.7rem',
                              }} 
                            />
                          </Box>
                          <Box mt={1}>
                            <Typography variant="body2" color="text.primary" sx={{ mb: 0.5 }}>
                              {log.details || `${log.targetType}: ${log.targetName}`}
                            </Typography>
                            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <SettingsIcon sx={{ fontSize: 14 }} />
                                {formatTimestamp(log.timestamp)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {getTargetIcon(log.targetType)}
                                {log.targetName}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </ListItem>
                      {index < array.length - 1 && <Divider sx={{ my: 1 }} />}
                    </React.Fragment>
                  );
                })}
            </List>
            
            {/* Pagination */}
            {historyLogs.length > itemsPerPage && (
              <Box 
                display="flex" 
                justifyContent="center" 
                alignItems="center" 
                mt={3}
                gap={2}
                flexWrap="wrap"
              >
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, historyLogs.length)} of {historyLogs.length}
                </Typography>
                <Pagination
                  count={Math.ceil(historyLogs.length / itemsPerPage)}
                  page={currentPage}
                  onChange={(event, value) => setCurrentPage(value)}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                  sx={{
                    '& .MuiPaginationItem-root': {
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    },
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default HistoryLog;
