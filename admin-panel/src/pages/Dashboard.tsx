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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  CheckCircle as CheckIcon,
  Settings as SettingsIcon,
  Assessment as ReportIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardStats {
  totalUsers: number;
  totalBusinesses: number;
  pendingApprovals: number;
  activeAccounts: number;
  inactiveAccounts: number;
}

interface TopBusiness {
  id: string;
  businessName: string;
  viewCount: number;
  selectedType?: string;
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
    activeAccounts: 0,
    inactiveAccounts: 0,
  });
  const [topBusinesses, setTopBusinesses] = useState<TopBusiness[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportType, setReportType] = useState('user_summary');
  const [dateRange, setDateRange] = useState('last_30_days');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');

  useEffect(() => {
    let isInitialLoad = true;
    
    // Set up real-time listener for businesses
    const unsubscribe = onSnapshot(collection(db, 'businesses'), async (snapshot) => {
      const businessData: TopBusiness[] = [];
      let activeCount = 0;
      let inactiveCount = 0;
      let pendingCount = 0;
      let approvedCount = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const isActive = data.isActive !== false;
        const status = data.status || 'pending';
        
        // Count pending approvals
        if (status === 'pending') {
          pendingCount++;
        }
        
        // Only count approved businesses for active/inactive/total
        if (status === 'approved') {
          approvedCount++;
          
          if (isActive) {
            activeCount++;
          } else {
            inactiveCount++;
          }
          
          // Only add approved businesses to top performers list
          businessData.push({
            id: doc.id,
            businessName: data.businessName || 'Unknown Business',
            viewCount: data.viewCount || 0,
            selectedType: data.selectedType || 'Business',
          });
        }
      });
      
      // Sort and get top 5 (only approved businesses)
      const topPerformers = businessData
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 5);
      
      // On initial load, fetch users count as well
      if (isInitialLoad) {
        setLoading(true);
        try {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          setStats({
            totalUsers: usersSnapshot.size,
            totalBusinesses: approvedCount, // Only approved businesses
            pendingApprovals: pendingCount,
            activeAccounts: activeCount,     // Only approved & active
            inactiveAccounts: inactiveCount, // Only approved & inactive
          });
        } catch (error) {
          console.error('Error fetching initial data:', error);
        }
        setLoading(false);
        isInitialLoad = false;
      } else {
        // Subsequent updates - only update business-related stats (not totalUsers)
        setStats(prev => ({
          ...prev,
          totalBusinesses: approvedCount,   // Only approved businesses
          activeAccounts: activeCount,       // Only approved & active
          inactiveAccounts: inactiveCount,   // Only approved & inactive
          pendingApprovals: pendingCount,
        }));
      }
      
      setTopBusinesses(topPerformers);
    });

    return () => unsubscribe();
  }, []); // Empty dependency array - only run once on mount

  const fetchDashboardData = async () => {
    // This function is kept for the manual "Refresh Data" button
    try {
      setLoading(true);
      
      // Fetch users count
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;
      
      // Fetch all businesses
      const businessesSnapshot = await getDocs(collection(db, 'businesses'));
      
      // Calculate active accounts (only approved businesses)
      let activeCount = 0;
      let inactiveCount = 0;
      let approvedCount = 0;
      const businessData: TopBusiness[] = [];
      
      businessesSnapshot.forEach((doc) => {
        const data = doc.data();
        const isActive = data.isActive !== false;
        const status = data.status || 'pending';
        
        // Only count approved businesses
        if (status === 'approved') {
          approvedCount++;
          
          if (isActive) {
            activeCount++;
          } else {
            inactiveCount++;
          }
          
          // Only add approved businesses to top performers
          businessData.push({
            id: doc.id,
            businessName: data.businessName || 'Unknown Business',
            viewCount: data.viewCount || 0,
            selectedType: data.selectedType || 'Business',
          });
        }
      });
      
      // Sort businesses by view count and get top 5 (only approved)
      const topPerformers = businessData
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 5);
      
      // Fetch pending approvals
      const pendingQuery = query(
        collection(db, 'businesses'),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingApprovals = pendingSnapshot.size;
      
      setStats({
        totalUsers,
        totalBusinesses: approvedCount,     // Only approved businesses
        pendingApprovals,
        activeAccounts: activeCount,         // Only approved & active
        inactiveAccounts: inactiveCount,     // Only approved & inactive
      });
      
      setTopBusinesses(topPerformers);
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

      {/* Analytics Overview Section */}
      <Paper 
        sx={{ 
          p: 3,
          mb: 4,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          borderRadius: 3,
          border: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReportIcon sx={{ color: '#667eea' }} />
          Overview
        </Typography>
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }}
        gap={{ xs: 2, sm: 3 }}
      >
        <Card 
          sx={{ 
              bgcolor: '#FF9800',
              boxShadow: '0 4px 12px rgba(255, 152, 0, 0.25)',
              borderRadius: 2,
          }}
        >
          <CardContent>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>
                  Pending Approvals
                </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff' }}>
                  {stats.pendingApprovals}
                </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Awaiting review
              </Typography>
            </CardContent>
          </Card>
        <Card 
          sx={{ 
              bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <CardContent>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>
                Total Registered Business Accounts
                </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff' }}>
                {stats.totalBusinesses}
                </Typography>
          </CardContent>
        </Card>
        <Card 
          sx={{ 
              bgcolor: '#4CAF50',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.25)',
              borderRadius: 2,
          }}
        >
          <CardContent>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>
                Active Accounts
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff' }}>
                {stats.activeAccounts}
                </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Currently operational
                </Typography>
          </CardContent>
        </Card>
          <Card 
            sx={{ 
              bgcolor: '#F44336',
              boxShadow: '0 4px 12px rgba(244, 67, 54, 0.25)',
                borderRadius: 2, 
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>
                Inactive/Closed Accounts
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff' }}>
                {stats.inactiveAccounts}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Not operational
              </Typography>
          </CardContent>
        </Card>
      </Box>
      </Paper>

      {/* Top-Performing Businesses Section */}
      <Paper 
        sx={{ 
          p: 3,
          mb: 4,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          borderRadius: 3,
          border: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ color: '#4CAF50' }} />
          Top-Performing Businesses
        </Typography>
        {topBusinesses.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Rank</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Business Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>
                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                      <VisibilityIcon sx={{ fontSize: 20 }} />
                      Views
                    </Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topBusinesses.map((business, index) => (
                  <TableRow 
                    key={business.id}
                    sx={{ 
                      '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.05)' },
                      bgcolor: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'inherit',
                    }}
                  >
                    <TableCell>
                      <Chip 
                        label={`#${index + 1}`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#e0e0e0',
                          color: index < 3 ? '#fff' : '#333',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <BusinessIcon sx={{ color: '#667eea' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {business.businessName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={business.selectedType || 'Business'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea' }}>
                        {business.viewCount.toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box 
            sx={{ 
              textAlign: 'center', 
              py: 4,
              color: 'text.secondary',
            }}
          >
            <VisibilityIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
            <Typography variant="body1">
              No business view data available yet.
            </Typography>
            <Typography variant="caption">
              View counts will appear as users interact with businesses.
            </Typography>
          </Box>
        )}
      </Paper>

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
            gap={{ xs: 1.5, sm: 2 }}
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
        {recentActivity.length > 0 ? (
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
        ) : (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography variant="body2">No recent activity to display</Typography>
          </Box>
        )}
      </Paper>

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