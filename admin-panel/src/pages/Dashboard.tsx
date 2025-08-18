import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardStats {
  totalUsers: number;
  totalBusinesses: number;
  pendingApprovals: number;
}

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'business_registration' | 'approval';
  title: string;
  description: string;
  timestamp: string;
  status?: 'pending' | 'approved' | 'rejected';
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    pendingApprovals: 0,
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
      setStats({
        totalUsers,
        totalBusinesses,
        pendingApprovals,
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, color: 'primary.main' }}>
        🛡️ Admin Dashboard
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Welcome to the Admin Dashboard. You can manage users, businesses, and review business approvals.
        </Typography>
      </Alert>
      {/* Statistics Cards */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }}
        gap={3}
        sx={{ mb: 4 }}
      >
        <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h4" component="div">
                  {stats.totalUsers}
                </Typography>
                <Typography variant="body2">Total Users</Typography>
              </Box>
              <PeopleIcon sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: 'secondary.light', color: 'white' }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h4" component="div">
                  {stats.totalBusinesses}
                </Typography>
                <Typography variant="body2">Total Businesses</Typography>
              </Box>
              <BusinessIcon sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h4" component="div">
                  {stats.pendingApprovals}
                </Typography>
                <Typography variant="body2">Pending Approvals</Typography>
              </Box>
              <WarningIcon sx={{ fontSize: 40 }} />
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
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
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
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              startIcon={<BusinessIcon />}
              href="/business-approvals"
            >
              Review Approvals
            </Button>
            <Button
              variant="contained"
              color="info"
              fullWidth
              startIcon={<PeopleIcon />}
              href="/user-management"
            >
              Manage Users
            </Button>
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              startIcon={<SettingsIcon />}
              onClick={fetchDashboardData}
            >
              Refresh Data
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default AdminDashboard; 