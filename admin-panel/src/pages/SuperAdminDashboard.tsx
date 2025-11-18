import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Pagination,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  PersonAdd as PersonAddIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, where, Timestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardStats {
  totalUsers: number;
  totalAdmins: number;
  activeAdmins: number;
  inactiveAdmins: number;
}

interface RecentActivity {
  id: string;
  type: 'admin_created' | 'admin_deleted' | 'admin_activated' | 'admin_deactivated' | 'user_deactivated' | 'user_activated' | 'user_deleted' | 'business_approved' | 'business_rejected' | 'login' | 'logout';
  title: string;
  description: string;
  timestamp: string | Timestamp;
  performedBy?: {
    uid: string;
    email: string;
    role: 'superadmin' | 'admin';
  };
  targetId?: string;
  targetType?: 'user' | 'admin' | 'business';
  status?: 'pending' | 'approved' | 'rejected';
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAdmins: 0,
    activeAdmins: 0,
    inactiveAdmins: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchActivityLogs = useCallback(async () => {
    try {
      setActivityLoading(true);
      let activityQuery = query(
        collection(db, 'adminActivityLogs'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      // Apply date filter
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
        
        activityQuery = query(
          collection(db, 'adminActivityLogs'),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
      }

      const snapshot = await getDocs(activityQuery);
      const activities: RecentActivity[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp,
        } as RecentActivity);
      });
      
      setRecentActivity(activities);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setActivityLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchDashboardData();
    fetchActivityLogs();
    setCurrentPage(1); // Reset to first page when filter changes
  }, [dateFilter, fetchActivityLogs]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch users count
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;
      // Fetch admin users
      const adminsSnapshot = await getDocs(collection(db, 'adminUsers'));
      const totalAdmins = adminsSnapshot.size;
      const activeAdmins = adminsSnapshot.docs.filter(doc => doc.data().isActive).length;
      const inactiveAdmins = totalAdmins - activeAdmins;
      setStats({
        totalUsers,
        totalAdmins,
        activeAdmins,
        inactiveAdmins,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'admin_created':
        return <PersonAddIcon color="success" />;
      case 'admin_deleted':
        return <DeleteIcon color="error" />;
      case 'admin_activated':
        return <CheckIcon color="success" />;
      case 'admin_deactivated':
        return <BlockIcon color="error" />;
      case 'user_activated':
        return <CheckIcon color="success" />;
      case 'user_deactivated':
        return <BlockIcon color="error" />;
      case 'user_deleted':
        return <DeleteIcon color="error" />;
      case 'business_approved':
        return <CheckIcon color="success" />;
      case 'business_rejected':
        return <BlockIcon color="error" />;
      case 'login':
        return <LoginIcon color="info" />;
      case 'logout':
        return <LogoutIcon color="info" />;
      default:
        return <SettingsIcon color="primary" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'admin_created':
      case 'admin_activated':
      case 'user_activated':
      case 'business_approved':
        return '#4CAF50';
      case 'admin_deleted':
      case 'admin_deactivated':
      case 'user_deactivated':
      case 'user_deleted':
      case 'business_rejected':
        return '#F44336';
      case 'login':
      case 'logout':
        return '#2196F3';
      default:
        return '#667eea';
    }
  };

  const getStatusChip = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case 'pending':
        return <Chip label="Pending" color="warning" size="small" />;
      case 'approved':
        return <Chip label="Approved" color="success" size="small" />;
      case 'rejected':
        return <Chip label="Rejected" color="error" size="small" />;
      default:
        return null;
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
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1a1a2e', fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Super Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          You have full system access. Manage users, businesses, and admin accounts.
        </Typography>
      </Box>
        
      {/* Statistics Cards */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr 1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }}
        gap={{ xs: 2, sm: 3 }}
        sx={{ mb: 4 }}
      >
        <Card sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 6px 16px rgba(102, 126, 234, 0.35)',
          },
        }}>
          <CardActionArea onClick={() => navigate('/user-management')}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Total Users
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                {stats.totalUsers}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card sx={{ 
          bgcolor: '#4CAF50',
          boxShadow: '0 4px 12px rgba(76, 175, 80, 0.25)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 6px 16px rgba(76, 175, 80, 0.35)',
          },
        }}>
          <CardActionArea onClick={() => navigate('/admin-management')}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Total Admins
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                {stats.totalAdmins}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card sx={{ 
          bgcolor: '#2196F3',
          boxShadow: '0 4px 12px rgba(33, 150, 243, 0.25)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 6px 16px rgba(33, 150, 243, 0.35)',
          },
        }}>
          <CardActionArea onClick={() => navigate('/admin-management?filter=active')}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Active Admins
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                {stats.activeAdmins}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card sx={{ 
          bgcolor: '#F44336',
          boxShadow: '0 4px 12px rgba(244, 67, 54, 0.25)',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 6px 16px rgba(244, 67, 54, 0.35)',
          },
        }}>
          <CardActionArea onClick={() => navigate('/admin-management?filter=inactive')}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Inactive Admins
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                {stats.inactiveAdmins}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>
        
      {/* Recent Activity */}
      <Paper 
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', 
          borderRadius: 3, 
          border: '1px solid #e0e0e0',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a2e' }}>
            Activity Log
          </Typography>
          <Box display="flex" gap={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
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
            <Tooltip title="Refresh Activity Log">
              <IconButton 
                onClick={fetchActivityLogs}
                disabled={activityLoading}
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

        {activityLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : recentActivity.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <SettingsIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
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
              {recentActivity
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((activity, index, array) => {
              let timestamp: Date;
              if (activity.timestamp instanceof Timestamp) {
                timestamp = activity.timestamp.toDate();
              } else if (typeof activity.timestamp === 'string') {
                timestamp = new Date(activity.timestamp);
              } else {
                timestamp = new Date();
              }
              const activityColor = getActivityColor(activity.type);
              
              return (
                <React.Fragment key={activity.id}>
                  <ListItem 
                    alignItems="flex-start"
                    sx={{
                      mb: 1,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'rgba(255, 255, 255, 0.8)',
                      border: `1px solid ${activityColor}20`,
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 1)',
                        boxShadow: `0 2px 8px ${activityColor}15`,
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
                          bgcolor: `${activityColor}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getActivityIcon(activity.type)}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1a1a2e' }}>
                            {activity.title}
                          </Typography>
                          {getStatusChip(activity.status)}
                          <Chip 
                            label={activity.type.replace(/_/g, ' ').toUpperCase()} 
                            size="small" 
                            sx={{ 
                              bgcolor: `${activityColor}20`,
                              color: activityColor,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }} 
                          />
                        </Box>
                      }
                      secondary={
                        <Box mt={1}>
                          <Typography variant="body2" color="text.primary" sx={{ mb: 0.5 }}>
                            {activity.description}
                          </Typography>
                          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SettingsIcon sx={{ fontSize: 14 }} />
                              {timestamp.toLocaleString()}
                            </Typography>
                            {activity.performedBy && (
                              <Typography variant="caption" color="text.secondary">
                                By: {activity.performedBy.email}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < array.length - 1 && <Divider sx={{ my: 1 }} />}
                </React.Fragment>
              );
            })}
            </List>
            
            {/* Pagination */}
            {recentActivity.length > itemsPerPage && (
              <Box 
                display="flex" 
                justifyContent="center" 
                alignItems="center" 
                mt={3}
                gap={2}
                flexWrap="wrap"
              >
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, recentActivity.length)} of {recentActivity.length}
                </Typography>
                <Pagination
                  count={Math.ceil(recentActivity.length / itemsPerPage)}
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

export default SuperAdminDashboard;