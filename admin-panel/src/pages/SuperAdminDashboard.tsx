import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  AppBar,
  Toolbar,
  Avatar,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalUsers: number;
  totalBusinesses: number;
  pendingApprovals: number;
  totalAdmins: number;
  activeAdmins: number;
  inactiveAdmins: number;
}

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'business_registration' | 'admin_created' | 'approval';
  title: string;
  description: string;
  timestamp: string;
  status?: 'pending' | 'approved' | 'rejected';
}

const SuperAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    pendingApprovals: 0,
    totalAdmins: 0,
    activeAdmins: 0,
    inactiveAdmins: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch users count
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;
      // Fetch businesses count
      const businessesSnapshot = await getDocs(collection(db, 'businesses'));
      const totalBusinesses = businessesSnapshot.size;
      // Fetch pending approvals
      const pendingQuery = query(
        collection(db, 'businesses'),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingApprovals = pendingSnapshot.size;
      // Fetch admin users
      const adminsSnapshot = await getDocs(collection(db, 'adminUsers'));
      const totalAdmins = adminsSnapshot.size;
      const activeAdmins = adminsSnapshot.docs.filter(doc => doc.data().isActive).length;
      const inactiveAdmins = totalAdmins - activeAdmins;
      setStats({
        totalUsers,
        totalBusinesses,
        pendingApprovals,
        totalAdmins,
        activeAdmins,
        inactiveAdmins,
      });
      // Fetch recent activity (mocked for demo)
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'business_registration',
          title: 'New Business Registration',
          description: 'Coffee Shop Express submitted registration',
          timestamp: new Date().toISOString(),
          status: 'pending',
        },
        {
          id: '2',
          type: 'admin_created',
          title: 'Admin Account Created',
          description: 'New admin user "john.doe@example.com" created',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '3',
          type: 'approval',
          title: 'Business Approved',
          description: 'Restaurant "Taste of Home" approved',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          status: 'approved',
        },
      ];
      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLogoutDialogOpen(false);
    }
  };

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registration':
        return <PeopleIcon color="primary" />;
      case 'business_registration':
        return <BusinessIcon color="primary" />;
      case 'admin_created':
        return <AdminIcon color="primary" />;
      case 'approval':
        return <CheckIcon color="primary" />;
      default:
        return <SettingsIcon color="primary" />;
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
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1a1a2e' }}>
          Super Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          You have full system access. Manage users, businesses, and admin accounts.
        </Typography>
      </Box>
        
      {/* Statistics Cards */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }}
        gap={3}
        sx={{ mb: 4 }}
      >
        <Card sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(102, 126, 234, 0.15)' } }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Total Users</Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#667eea' }}>{stats.totalUsers}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(102, 126, 234, 0.1)' }}>
                <PeopleIcon sx={{ fontSize: 40, color: '#667eea' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(118, 75, 162, 0.15)' } }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Total Businesses</Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#764ba2' }}>{stats.totalBusinesses}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(118, 75, 162, 0.1)' }}>
                <BusinessIcon sx={{ fontSize: 40, color: '#764ba2' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(255, 152, 0, 0.15)' } }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Pending Approvals</Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#FF9800' }}>{stats.pendingApprovals}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255, 152, 0, 0.1)' }}>
                <WarningIcon sx={{ fontSize: 40, color: '#FF9800' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(76, 175, 80, 0.15)' } }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Total Admins</Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#4CAF50' }}>{stats.totalAdmins}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.1)' }}>
                <AdminIcon sx={{ fontSize: 40, color: '#4CAF50' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(33, 150, 243, 0.15)' } }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Active Admins</Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#2196F3' }}>{stats.activeAdmins}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(33, 150, 243, 0.1)' }}>
                <SecurityIcon sx={{ fontSize: 40, color: '#2196F3' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(244, 67, 54, 0.15)' } }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Inactive Admins</Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#F44336' }}>{stats.inactiveAdmins}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(244, 67, 54, 0.1)' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: '#F44336' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
        
      {/* Recent Activity */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr' }}
        gap={3}
      >
        <Paper sx={{ p: 3, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0' }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Recent Activity
          </Typography>
          <List>
            {recentActivity.map((activity, index) => (
              <React.Fragment key={activity.id}>
                <ListItem alignItems="flex-start">
                  <ListItemIcon>
                    {getActivityIcon(activity.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">
                          {activity.title}
                        </Typography>
                        {getStatusChip(activity.status)}
                      </Box>
                    }
                    secondary={
                      <React.Fragment>
                        <Typography component="span" variant="body2" color="text.primary">
                          {activity.description}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {new Date(activity.timestamp).toLocaleString()}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                </ListItem>
                {index < recentActivity.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
        <Paper 
          sx={{ 
            p: 3,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Quick Actions
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AdminIcon />}
              href="/admin-management"
              sx={{
                py: 1.5,
                bgcolor: '#4CAF50',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)',
                '&:hover': {
                  bgcolor: '#45a049',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
                },
              }}
            >
              Manage Admins
            </Button>
            <Button
              variant="contained"
              fullWidth
              startIcon={<BusinessIcon />}
              href="/business-approvals"
              sx={{
                py: 1.5,
                bgcolor: '#667eea',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                '&:hover': {
                  bgcolor: '#5568d3',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                },
              }}
            > 
              Review Approvals
            </Button>
            <Button
              variant="contained"
              fullWidth
              startIcon={<PeopleIcon />}
              href="/user-management"
              sx={{
                py: 1.5,
                bgcolor: '#2196F3',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                '&:hover': {
                  bgcolor: '#1976D2',
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
                },
              }}
            >
              Manage Users
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<SettingsIcon />}
              onClick={fetchDashboardData}
              sx={{
                py: 1.5,
                borderColor: '#667eea',
                color: '#667eea',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                '&:hover': {
                  borderColor: '#5568d3',
                  bgcolor: 'rgba(102, 126, 234, 0.05)',
                },
              }}
            >
              Refresh Data
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutDialogOpen} onClose={handleLogoutCancel}>
        <DialogTitle>Confirm Logout</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to logout from the SuperAdmin Dashboard?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogoutCancel}>Cancel</Button>
          <Button onClick={handleLogoutConfirm} color="error" variant="contained">
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminDashboard;