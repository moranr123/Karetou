import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Paper,
  CircularProgress,
  useMediaQuery,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { collection, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, adminCreationAuth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../utils/activityLogger';

interface DashboardStats {
  totalUsers: number;
  totalAdmins: number;
  activeAdmins: number;
  inactiveAdmins: number;
}


interface NewAdminData {
  email: string;
  password: string;
  confirmPassword: string;
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { userRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAdmins: 0,
    activeAdmins: 0,
    inactiveAdmins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userGraphData, setUserGraphData] = useState<{ date: string; count: number }[]>([]);
  const [userGraphDateFilter, setUserGraphDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('month');
  const [userGraphLoading, setUserGraphLoading] = useState(false);
  const [accountsNeedingDeactivation, setAccountsNeedingDeactivation] = useState({
    users: 0,
    admins: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [createAdminError, setCreateAdminError] = useState('');
  const [createAdminSuccess, setCreateAdminSuccess] = useState('');
  const [newAdminData, setNewAdminData] = useState<NewAdminData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const fetchUserGraphData = useCallback(async () => {
    try {
      setUserGraphLoading(true);
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (userGraphDateFilter) {
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

      // Group users by date
      const dateMap = new Map<string, number>();
      
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        let userDate: Date;
        
        if (data.createdAt) {
          if (data.createdAt.toDate) {
            userDate = data.createdAt.toDate();
          } else if (data.createdAt instanceof Timestamp) {
            userDate = data.createdAt.toDate();
          } else {
            userDate = new Date(data.createdAt);
          }
        } else {
          // If no createdAt, use a default date (very old)
          userDate = new Date(0);
        }
        
        if (userDate >= startDate) {
          const dateKey = userDate.toISOString().split('T')[0];
          dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
        }
      });

      // Generate all dates in range
      const dateRange: { date: string; count: number }[] = [];
      const currentDate = new Date(startDate);
      const endDate = new Date(now);
      
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const count = dateMap.get(dateKey) || 0;
        dateRange.push({
          date: dateKey,
          count: count,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate cumulative counts
      let cumulative = 0;
      const graphData = dateRange.map(item => {
        cumulative += item.count;
        return {
          date: item.date,
          count: cumulative,
        };
      });

      setUserGraphData(graphData);
    } catch (error) {
      console.error('Error fetching user graph data:', error);
    } finally {
      setUserGraphLoading(false);
    }
  }, [userGraphDateFilter]);

  const fetchDashboardData = useCallback(async () => {
    const needsDeactivation = (lastLogin: string | undefined): boolean => {
      if (!lastLogin) {
        return false;
      }
      const lastLogoutDate = new Date(lastLogin);
      const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
      return minutesSinceLogout > 1;
    };

    try {
      setLoading(true);
      // Fetch users count
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;
      
      // Count users needing deactivation
      let usersNeedingDeactivation = 0;
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        // Check if user is active (default to true if not set) and needs deactivation
        const isActive = data.isActive !== undefined ? data.isActive : true;
        if (isActive && needsDeactivation(data.lastLogin)) {
          usersNeedingDeactivation++;
        }
      });
      
      // Fetch admin users
      const adminsSnapshot = await getDocs(collection(db, 'adminUsers'));
      const totalAdmins = adminsSnapshot.size;
      const activeAdmins = adminsSnapshot.docs.filter(doc => doc.data().isActive).length;
      const inactiveAdmins = totalAdmins - activeAdmins;
      
      // Count admins needing deactivation
      let adminsNeedingDeactivation = 0;
      adminsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'admin' && data.isActive && needsDeactivation(data.lastLogin)) {
          adminsNeedingDeactivation++;
        }
      });
      
      setStats({
        totalUsers,
        totalAdmins,
        activeAdmins,
        inactiveAdmins,
      });
      
      setAccountsNeedingDeactivation({
        users: usersNeedingDeactivation,
        admins: adminsNeedingDeactivation,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchUserGraphData();
  }, [fetchDashboardData, fetchUserGraphData]);

  const handleCreateAdmin = async () => {
    if (newAdminData.password !== newAdminData.confirmPassword) {
      setCreateAdminError('Passwords do not match');
      return;
    }

    if (newAdminData.password.length < 6) {
      setCreateAdminError('Password must be at least 6 characters long');
      return;
    }

    try {
      setProcessing(true);
      setCreateAdminError('');
      setCreateAdminSuccess('');

      if (!userRole) {
        setCreateAdminError('You must be logged in to create admin accounts');
        setProcessing(false);
        return;
      }

      const currentUserUid = userRole.uid;

      const userCredential = await createUserWithEmailAndPassword(
        adminCreationAuth,
        newAdminData.email,
        newAdminData.password
      );

      const adminData = {
        uid: userCredential.user.uid,
        email: newAdminData.email,
        role: 'admin' as const,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUserUid,
      };

      await addDoc(collection(db, 'adminUsers'), adminData);

      // Log activity
      if (userRole) {
        await logActivity({
          type: 'admin_created',
          title: 'Admin Account Created',
          description: `Admin account created for ${newAdminData.email}`,
          performedBy: {
            uid: currentUserUid,
            email: userRole.email,
            role: userRole.role,
          },
          targetId: userCredential.user.uid,
          targetType: 'admin',
          metadata: { email: newAdminData.email },
        });
      }

      const createdEmail = newAdminData.email;
      setNewAdminData({ email: '', password: '', confirmPassword: '' });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setDialogOpen(false);
      
      setCreateAdminSuccess(`Admin account created successfully for ${createdEmail}`);
      
      // Update stats without full rerender - just increment counts
      setStats(prevStats => ({
        ...prevStats,
        totalAdmins: prevStats.totalAdmins + 1,
        activeAdmins: prevStats.activeAdmins + 1,
      }));
      
      setTimeout(() => setCreateAdminSuccess(''), 5000);
      
    } catch (error: any) {
      console.error('Error creating admin:', error);
      setCreateAdminError(error.message || 'Failed to create admin account');
    } finally {
      setProcessing(false);
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

      {/* Success Message */}
      {createAdminSuccess && (
        <Alert 
          severity="success" 
          sx={{ 
            position: 'fixed', 
            top: 20, 
            right: 20, 
            zIndex: 9999,
            minWidth: 300,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {createAdminSuccess}
        </Alert>
      )}

      {/* Accounts Needing Deactivation Alert */}
      {(accountsNeedingDeactivation.users > 0 || accountsNeedingDeactivation.admins > 0) && (
        <Alert 
          severity="warning" 
          sx={{ 
            mb: 4,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            '& .MuiAlert-message': {
              width: '100%',
            },
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
          }}
          action={
            <Box 
              sx={{ 
                display: 'flex', 
                gap: 1, 
                alignItems: 'center',
                flexDirection: { xs: 'column', sm: 'row' },
                width: { xs: '100%', sm: 'auto' },
                mt: { xs: 2, sm: 0 },
                '& > button': {
                  width: { xs: '100%', sm: 'auto' },
                },
              }}
            >
              {accountsNeedingDeactivation.users > 0 && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => navigate('/user-management?filter=inactive')}
                  sx={{ 
                    textTransform: 'none',
                    width: { xs: '100%', sm: 'auto' },
                    minWidth: { xs: '100%', sm: 'auto' },
                  }}
                >
                  View Users ({accountsNeedingDeactivation.users})
                </Button>
              )}
              {accountsNeedingDeactivation.admins > 0 && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => navigate('/admin-management?filter=inactive')}
                  sx={{ 
                    textTransform: 'none',
                    width: { xs: '100%', sm: 'auto' },
                    minWidth: { xs: '100%', sm: 'auto' },
                  }}
                >
                  View Admins ({accountsNeedingDeactivation.admins})
                </Button>
              )}
            </Box>
          }
        >
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600, 
              mb: 0.5,
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
          >
            Accounts Need Deactivation
          </Typography>
          <Typography 
            variant="body2"
            sx={{
              fontSize: { xs: '0.875rem', sm: '0.875rem' },
            }}
          >
            {accountsNeedingDeactivation.users > 0 && accountsNeedingDeactivation.admins > 0 && (
              <>There are <strong>{accountsNeedingDeactivation.users}</strong> user{accountsNeedingDeactivation.users !== 1 ? 's' : ''} and <strong>{accountsNeedingDeactivation.admins}</strong> admin{accountsNeedingDeactivation.admins !== 1 ? 's' : ''} that need to be deactivated.</>
            )}
            {accountsNeedingDeactivation.users > 0 && accountsNeedingDeactivation.admins === 0 && (
              <>There are <strong>{accountsNeedingDeactivation.users}</strong> user{accountsNeedingDeactivation.users !== 1 ? 's' : ''} that need to be deactivated.</>
            )}
            {accountsNeedingDeactivation.users === 0 && accountsNeedingDeactivation.admins > 0 && (
              <>There are <strong>{accountsNeedingDeactivation.admins}</strong> admin{accountsNeedingDeactivation.admins !== 1 ? 's' : ''} that need to be deactivated.</>
            )}
          </Typography>
          <Typography 
            variant="body2"
            sx={{
              fontSize: { xs: '0.8rem', sm: '0.8rem' },
              color: 'text.secondary',
              mt: 1,
              fontStyle: 'italic',
            }}
          >
            Reason: These accounts have not logged out for more than 1 minute, indicating prolonged inactivity.
          </Typography>
        </Alert>
      )}

      {/* Quick Actions Card */}
      <Card 
        sx={{ 
          mb: 4,
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e0e0e0',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600, 
              mb: 2,
              color: '#1a1a2e',
              fontSize: { xs: '1rem', sm: '1.25rem' },
            }}
          >
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
                py: 1.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3d8f 100%)',
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.35)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s',
              }}
            >
              Create Admin
            </Button>
          </Box>
        </CardContent>
      </Card>
        
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
        
      {/* User Growth Graph */}
        <Paper 
          sx={{ 
            p: { xs: 2, sm: 3 },
          mb: 4,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          }}
        >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a2e' }}>
            User Growth
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={userGraphDateFilter}
              label="Date Range"
              onChange={(e) => setUserGraphDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">Last 7 Days</MenuItem>
              <MenuItem value="month">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {userGraphLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : userGraphData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No user data available for the selected period.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ width: '100%', height: { xs: 250, sm: 300 }, position: 'relative', overflow: 'auto' }}>
            <svg 
              width="100%" 
              height="100%" 
              viewBox={isMobile ? "0 0 600 250" : "0 0 800 300"} 
              preserveAspectRatio="xMidYMid meet"
              style={{ minHeight: isMobile ? '250px' : '300px' }}
            >
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#667eea" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#764ba2" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="lineGradientStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="50%" stopColor="#764ba2" />
                  <stop offset="100%" stopColor="#667eea" />
                </linearGradient>
              </defs>
              
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map((i) => {
                const baseY = isMobile ? 40 : 50;
                const yStep = isMobile ? 40 : 50;
                const y = baseY + (i * yStep);
                const x1 = isMobile ? 50 : 80;
                const x2 = isMobile ? 550 : 750;
                return (
                  <line
                    key={`grid-${i}`}
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#e0e0e0"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Y-axis labels */}
              {(() => {
                const maxCount = Math.max(...userGraphData.map(d => d.count), 1);
                const step = Math.ceil(maxCount / 5);
                const baseY = isMobile ? 40 : 50;
                const yStep = isMobile ? 40 : 50;
                const xPos = isMobile ? 45 : 75;
                const fontSize = isMobile ? 10 : 12;
                return [0, 1, 2, 3, 4].map((i) => {
                  const value = step * (5 - i);
                  const y = baseY + (i * yStep);
                  return (
                    <text
                      key={`y-label-${i}`}
                      x={xPos}
                      y={y + 5}
                      textAnchor="end"
                      fontSize={fontSize}
                      fill="#666"
                    >
                      {value.toLocaleString()}
                    </text>
                  );
                });
              })()}

              {/* Area under curve */}
              {userGraphData.length > 0 && (() => {
                const maxCount = Math.max(...userGraphData.map(d => d.count), 1);
                const padding = isMobile ? 50 : 80;
                const chartWidth = isMobile ? 500 : 670;
                const chartHeight = isMobile ? 160 : 200;
                const stepX = chartWidth / Math.max(userGraphData.length - 1, 1);
                
                const points = userGraphData.map((item, index) => {
                  const x = padding + (index * stepX);
                  const y = padding + chartHeight - ((item.count / maxCount) * chartHeight);
                  return `${x},${y}`;
                });
                
                const areaPath = `M ${padding},${padding + chartHeight} L ${points.join(' L ')} L ${padding + chartWidth},${padding + chartHeight} Z`;
                
                return (
                  <path
                    d={areaPath}
                    fill="url(#lineGradient)"
                  />
                );
              })()}

              {/* Line */}
              {userGraphData.length > 0 && (() => {
                const maxCount = Math.max(...userGraphData.map(d => d.count), 1);
                const padding = isMobile ? 50 : 80;
                const chartWidth = isMobile ? 500 : 670;
                const chartHeight = isMobile ? 160 : 200;
                const stepX = chartWidth / Math.max(userGraphData.length - 1, 1);
                
                // Create straight lines between points
                const points = userGraphData.map((item, index) => {
                  const x = padding + (index * stepX);
                  const y = padding + chartHeight - ((item.count / maxCount) * chartHeight);
                  return { x, y };
                });
                
                let pathData = '';
                if (points.length > 0) {
                  pathData = `M ${points[0].x} ${points[0].y}`;
                  for (let i = 1; i < points.length; i++) {
                    pathData += ` L ${points[i].x} ${points[i].y}`;
                  }
                }
                
                return (
                  <>
                    {/* Glow effect */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke="url(#lineGradientStroke)"
                      strokeWidth={isMobile ? 4 : 5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.3"
                      filter="url(#glow)"
                    />
                    {/* Main line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke="url(#lineGradientStroke)"
                      strokeWidth={isMobile ? 2.5 : 3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                );
              })()}


              {/* X-axis labels */}
              {userGraphData.length > 0 && (() => {
                const labelCount = isMobile ? Math.min(userGraphData.length, 5) : Math.min(userGraphData.length, 7);
                const step = Math.floor(userGraphData.length / labelCount);
                return userGraphData
                  .filter((_, index) => index % step === 0 || index === userGraphData.length - 1)
                  .map((item, labelIndex) => {
                    const actualIndex = userGraphData.findIndex(d => d.date === item.date);
                    const padding = isMobile ? 50 : 80;
                    const chartWidth = isMobile ? 500 : 670;
                    const stepX = chartWidth / Math.max(userGraphData.length - 1, 1);
                    const x = padding + (actualIndex * stepX);
                    const yPos = isMobile ? 230 : 280;
                    const date = new Date(item.date);
                    const dateStr = isMobile 
                      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const fontSize = isMobile ? 9 : 11;
                    
                    return (
                      <text
                        key={`x-label-${labelIndex}`}
                        x={x}
                        y={yPos}
                        textAnchor="middle"
                        fontSize={fontSize}
                        fill="#666"
                      >
                        {dateStr}
                      </text>
                    );
                  });
              })()}
            </svg>
          </Box>
        )}
        </Paper>

      {/* Create Admin Dialog */}
      <Dialog open={dialogOpen} onClose={() => {
        setDialogOpen(false);
        setShowPassword(false);
        setShowConfirmPassword(false);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Admin Account</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleCreateAdmin(); }} sx={{ pt: 2 }}>
            {createAdminError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createAdminError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={newAdminData.email}
              onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
              margin="normal"
              required
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={newAdminData.password}
              onChange={(e) => setNewAdminData({ ...newAdminData, password: e.target.value })}
              margin="normal"
              required
              disabled={processing}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={processing}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={newAdminData.confirmPassword}
              onChange={(e) => setNewAdminData({ ...newAdminData, confirmPassword: e.target.value })}
              margin="normal"
              required
              disabled={processing}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      disabled={processing}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDialogOpen(false);
            setCreateAdminError('');
            setNewAdminData({ email: '', password: '', confirmPassword: '' });
            setShowPassword(false);
            setShowConfirmPassword(false);
          }} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={(e) => { e.preventDefault(); handleCreateAdmin(); }}
            variant="contained"
            disabled={processing || !newAdminData.email || !newAdminData.password}
            type="button"
          >
            {processing ? <CircularProgress size={20} /> : 'Create Admin'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminDashboard;