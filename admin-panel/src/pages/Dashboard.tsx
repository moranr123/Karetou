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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
  Assessment as ReportIcon,
  Download as DownloadIcon,
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
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportType, setReportType] = useState('user_summary');
  const [dateRange, setDateRange] = useState('last_30_days');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');

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

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      setReportSuccess('');
      
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock report data based on report type
      let reportData = '';
      const currentDate = new Date().toLocaleDateString();
      
      switch (reportType) {
        case 'user_summary':
          reportData = `User Summary Report - ${currentDate}\n\nTotal Users: ${stats.totalUsers}\nTotal Businesses: ${stats.totalBusinesses}\nPending Approvals: ${stats.pendingApprovals}`;
          break;
        case 'business_approvals':
          reportData = `Business Approvals Report - ${currentDate}\n\nPending Approvals: ${stats.pendingApprovals}\nTotal Businesses: ${stats.totalBusinesses}`;
          break;
        case 'activity_log':
          reportData = `Activity Log Report - ${currentDate}\n\nRecent Activities:\n${recentActivity.map(activity => `- ${activity.title}: ${activity.description}`).join('\n')}`;
          break;
        default:
          reportData = `General Report - ${currentDate}\n\nSystem Statistics:\nTotal Users: ${stats.totalUsers}\nTotal Businesses: ${stats.totalBusinesses}\nPending Approvals: ${stats.pendingApprovals}`;
      }
      
      // Create and download the report
      const blob = new Blob([reportData], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setReportSuccess('Report generated and downloaded successfully!');
      setReportDialogOpen(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => setReportSuccess(''), 5000);
      
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleReportDialogClose = () => {
    setReportDialogOpen(false);
    setReportType('user_summary');
    setDateRange('last_30_days');
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
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back! Here's what's happening with your business approvals.
        </Typography>
      </Box>
      {/* Statistics Cards */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }}
        gap={3}
        sx={{ mb: 4 }}
      >
        <Card 
          sx={{ 
            bgcolor: '#fff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 16px rgba(102, 126, 234, 0.15)',
            },
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Total Users
                </Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#667eea' }}>
                  {stats.totalUsers}
                </Typography>
              </Box>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(102, 126, 234, 0.1)',
              }}>
                <PeopleIcon sx={{ fontSize: 40, color: '#667eea' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card 
          sx={{ 
            bgcolor: '#fff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 16px rgba(118, 75, 162, 0.15)',
            },
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Total Businesses
                </Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#764ba2' }}>
                  {stats.totalBusinesses}
                </Typography>
              </Box>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(118, 75, 162, 0.1)',
              }}>
                <BusinessIcon sx={{ fontSize: 40, color: '#764ba2' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card 
          sx={{ 
            bgcolor: '#fff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 16px rgba(255, 152, 0, 0.15)',
            },
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Pending Approvals
                </Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#FF9800' }}>
                  {stats.pendingApprovals}
                </Typography>
              </Box>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(255, 152, 0, 0.1)',
              }}>
                <WarningIcon sx={{ fontSize: 40, color: '#FF9800' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
      {/* Report Generation Section */}
      <Box sx={{ mb: 4 }}>
        <Paper 
          sx={{ 
            p: 3,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Report Generation
          </Typography>
          <Box 
            display="grid" 
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} 
            gap={2}
          >
            <Button
              variant="contained"
              fullWidth
              startIcon={<ReportIcon />}
              onClick={() => setReportDialogOpen(true)}
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
              Generate Report
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={() => {
                const reportData = `Quick Export - ${new Date().toLocaleDateString()}\n\nTotal Users: ${stats.totalUsers}\nTotal Businesses: ${stats.totalBusinesses}\nPending Approvals: ${stats.pendingApprovals}`;
                const blob = new Blob([reportData], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `quick_export_${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              }}
              sx={{
                py: 1.5,
                borderColor: '#2196F3',
                color: '#2196F3',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                '&:hover': {
                  borderColor: '#1976D2',
                  bgcolor: 'rgba(33, 150, 243, 0.05)',
                },
              }}
            >
              Quick Export
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Recent Activity */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr' }}
        gap={3}
      >
        <Paper 
          sx={{ 
            p: 3,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 3,
            border: '1px solid #e0e0e0',
          }}
        >
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

      {/* Report Generation Dialog */}
      <Dialog open={reportDialogOpen} onClose={handleReportDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Report</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                label="Report Type"
              >
                <MenuItem value="user_summary">User Summary Report</MenuItem>
                <MenuItem value="business_approvals">Business Approvals Report</MenuItem>
                <MenuItem value="activity_log">Activity Log Report</MenuItem>
                <MenuItem value="general">General Statistics Report</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                label="Date Range"
              >
                <MenuItem value="last_7_days">Last 7 Days</MenuItem>
                <MenuItem value="last_30_days">Last 30 Days</MenuItem>
                <MenuItem value="last_90_days">Last 90 Days</MenuItem>
                <MenuItem value="all_time">All Time</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Custom Date Range (Optional)"
              type="date"
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReportDialogClose} disabled={generatingReport}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            disabled={generatingReport}
            startIcon={generatingReport ? <CircularProgress size={20} /> : <ReportIcon />}
          >
            {generatingReport ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Message */}
      {reportSuccess && (
        <Alert 
          severity="success" 
          sx={{ 
            position: 'fixed', 
            top: 20, 
            right: 20, 
            zIndex: 9999,
            minWidth: 300 
          }}
        >
          {reportSuccess}
        </Alert>
      )}
    </Box>
  );
};

export default AdminDashboard; 