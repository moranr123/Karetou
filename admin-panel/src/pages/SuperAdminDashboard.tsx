import React, { useState, useEffect } from 'react';
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
  Button,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as CheckIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardStats {
  totalUsers: number;
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
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAdmins: 0,
    activeAdmins: 0,
    inactiveAdmins: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr' }}
        gap={{ xs: 2, sm: 3 }}
      >
        <Paper sx={{ p: { xs: 2, sm: 3 }, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', borderRadius: 3, border: '1px solid #e0e0e0' }}>
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
            p: { xs: 2, sm: 3 },
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Quick Actions
          </Typography>
          <Box display="flex" flexDirection="column" gap={{ xs: 1.5, sm: 2 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AdminIcon />}
              href="/admin-management"
              sx={{
                py: 1.5,
                bgcolor: '#4CAF50',
                textTransform: 'none',
                fontSize: { xs: '0.875rem', sm: '1rem' },
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
                fontSize: { xs: '0.875rem', sm: '1rem' },
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
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontWeight: 600,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                '&:hover': {
                  bgcolor: '#1976D2',
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
                },
              }}
            >
              ManagCUsers
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
                fontSize: { xs: '0.875rem', sm: '1rem' },
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
    </Box>
  );
};

export default SuperAdminDashboard;