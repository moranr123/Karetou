import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Paper,
  Chip,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
} from '@mui/material';
import {
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
  Assessment as ReportIcon,
  Download as DownloadIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import { logAdminAction } from '../utils/logAdminAction';

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


const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    pendingApprovals: 0,
    activeAccounts: 0,
    inactiveAccounts: 0,
  });
  const [topBusinesses, setTopBusinesses] = useState<TopBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportType, setReportType] = useState('user_summary');
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  const [customStartDate, setCustomStartDate] = useState(getTodayDate());
  const [customEndDate, setCustomEndDate] = useState(getTodayDate());
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

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      setReportSuccess('');
      
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create PDF document
      const doc = new jsPDF();
      const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Header styling
      doc.setFillColor(102, 126, 234); // #667eea
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      // Header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Generated: ${currentDate}`, 14, 20);
      
      // Report title
      doc.setTextColor(26, 26, 46); // #1a1a2e
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      let reportTitle = '';
      
      switch (reportType) {
        case 'user_summary':
          reportTitle = 'User Summary Report';
          break;
        case 'business_approvals':
          reportTitle = 'Business Approvals Report';
          break;
        case 'top_performers':
          reportTitle = 'Top Performing Businesses Report';
          break;
        default:
          reportTitle = 'General Statistics Report';
      }
      
      doc.text(reportTitle, 14, 45);
      
      // Generate report content based on type
      let yPosition = 60;
      
      switch (reportType) {
        case 'user_summary': {
          // Summary statistics table
          const summaryData = [
            ['Metric', 'Value'],
            ['Total Users', stats.totalUsers.toString()],
            ['Total Businesses', stats.totalBusinesses.toString()],
            ['Pending Approvals', stats.pendingApprovals.toString()],
            ['Active Accounts', stats.activeAccounts.toString()],
            ['Inactive Accounts', stats.inactiveAccounts.toString()],
          ];
          
          autoTable(doc, {
            startY: yPosition,
            head: [summaryData[0]],
            body: summaryData.slice(1),
            theme: 'striped',
            headStyles: {
              fillColor: [102, 126, 234],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 12,
            },
            bodyStyles: {
              fontSize: 11,
              textColor: [26, 26, 46],
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245],
            },
            styles: {
              cellPadding: 8,
              lineColor: [224, 224, 224],
              lineWidth: 0.5,
            },
            margin: { left: 14, right: 14 },
          });
          break;
        }
        
        case 'business_approvals': {
          // Business approvals table
          const approvalsData = [
            ['Status', 'Count'],
            ['Pending Approvals', stats.pendingApprovals.toString()],
            ['Total Registered Businesses', stats.totalBusinesses.toString()],
            ['Active Business Accounts', stats.activeAccounts.toString()],
            ['Inactive/Closed Accounts', stats.inactiveAccounts.toString()],
          ];
          
          autoTable(doc, {
            startY: yPosition,
            head: [approvalsData[0]],
            body: approvalsData.slice(1),
            theme: 'striped',
            headStyles: {
              fillColor: [255, 152, 0], // Orange for pending
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 12,
            },
            bodyStyles: {
              fontSize: 11,
              textColor: [26, 26, 46],
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245],
            },
            styles: {
              cellPadding: 8,
              lineColor: [224, 224, 224],
              lineWidth: 0.5,
            },
            margin: { left: 14, right: 14 },
          });
          break;
        }
        
        case 'top_performers': {
          // Top performers table
          if (topBusinesses.length > 0) {
            const performersData = [
              ['Rank', 'Business Name', 'Type', 'Views'],
              ...topBusinesses.map((business, index) => [
                `#${index + 1}`,
                business.businessName,
                business.selectedType || 'Business',
                business.viewCount.toLocaleString(),
              ]),
            ];
            
            autoTable(doc, {
              startY: yPosition,
              head: [performersData[0]],
              body: performersData.slice(1),
              theme: 'striped',
              headStyles: {
                fillColor: [76, 175, 80], // Green for top performers
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 12,
              },
              bodyStyles: {
                fontSize: 11,
                textColor: [26, 26, 46],
              },
              alternateRowStyles: {
                fillColor: [245, 245, 245],
              },
              styles: {
                cellPadding: 8,
                lineColor: [224, 224, 224],
                lineWidth: 0.5,
              },
              margin: { left: 14, right: 14 },
              columnStyles: {
                0: { cellWidth: 30, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 60 },
                3: { cellWidth: 50, halign: 'right' },
              },
            });
          } else {
            doc.setFontSize(11);
            doc.setTextColor(128, 128, 128);
            doc.text('No business view data available yet.', 14, yPosition);
          }
          break;
        }
        
        default: {
          // General statistics table
          const generalData = [
            ['Category', 'Metric', 'Value'],
            ['Users', 'Total Users', stats.totalUsers.toString()],
            ['Businesses', 'Total Registered', stats.totalBusinesses.toString()],
            ['Businesses', 'Active Accounts', stats.activeAccounts.toString()],
            ['Businesses', 'Inactive Accounts', stats.inactiveAccounts.toString()],
            ['Approvals', 'Pending Approvals', stats.pendingApprovals.toString()],
          ];
          
          autoTable(doc, {
            startY: yPosition,
            head: [generalData[0]],
            body: generalData.slice(1),
            theme: 'striped',
            headStyles: {
              fillColor: [102, 126, 234],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 12,
            },
            bodyStyles: {
              fontSize: 11,
              textColor: [26, 26, 46],
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245],
            },
            styles: {
              cellPadding: 8,
              lineColor: [224, 224, 224],
              lineWidth: 0.5,
            },
            margin: { left: 14, right: 14 },
          });
          break;
        }
      }
      
      // Footer
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'This report was generated automatically by the Karetou Admin Dashboard.',
        14,
        pageHeight - 20
      );
      
      // Save the PDF
      const fileName = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Log admin action
      await logAdminAction({
        action: 'Generated Report',
        actionType: 'create',
        targetType: 'report',
        targetName: reportTitle,
        targetId: `${reportType}_${new Date().toISOString()}`,
        adminEmail: user?.email || '',
        adminId: user?.uid || '',
        details: `You generated ${reportTitle} for date range: ${customStartDate} to ${customEndDate}`,
      });
      
      setReportSuccess('PDF report generated and downloaded successfully!');
      setReportDialogOpen(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => setReportSuccess(''), 5000);
      
    } catch (error) {
      console.error('Error generating report:', error);
      setReportSuccess('Error generating report. Please try again.');
      setTimeout(() => setReportSuccess(''), 5000);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleReportDialogClose = () => {
    setReportDialogOpen(false);
    setReportType('user_summary');
    setCustomStartDate(getTodayDate());
    setCustomEndDate(getTodayDate());
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

      {/* Quick Action Section */}
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
          <PlayArrowIcon sx={{ color: '#667eea' }} />
          Quick Action
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<ReportIcon />}
            onClick={() => setReportDialogOpen(true)}
            sx={{
              py: 1.5,
              px: 3,
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
            Generate Report
          </Button>
        </Box>
      </Paper>

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
        gridTemplateColumns={{ xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }}
        gap={{ xs: 2, sm: 3 }}
      >
        <Card 
          sx={{ 
              bgcolor: '#FF9800',
              boxShadow: '0 4px 12px rgba(255, 152, 0, 0.25)',
              borderRadius: 2,
          }}
        >
          <CardActionArea onClick={() => navigate('/business/pending')}>
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
            </CardActionArea>
        </Card>
        <Card 
          sx={{ 
              bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <CardActionArea onClick={() => navigate('/business/approved')}>
          <CardContent>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>
                  Total Registered Business Accounts
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: '#fff' }}>
                  {stats.totalBusinesses}
                </Typography>
          </CardContent>
          </CardActionArea>
        </Card>
        <Card 
          sx={{ 
              bgcolor: '#4CAF50',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.25)',
              borderRadius: 2,
          }}
        >
          <CardActionArea onClick={() => navigate('/business/approved')}>
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
          </CardActionArea>
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
          <>
            {/* Desktop Table View */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
            </Box>

            {/* Mobile Card View */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topBusinesses.map((business, index) => (
                  <Card
                    key={business.id}
                    sx={{
                      borderRadius: 3,
                      border: '1px solid #e0e0e0',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      bgcolor: index === 0 ? 'rgba(255, 215, 0, 0.05)' : 'inherit',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        borderColor: index === 0 ? '#FFD700' : '#667eea',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      {/* Header with Rank and Business Name */}
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                          <Chip 
                            label={`#${index + 1}`}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              bgcolor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#e0e0e0',
                              color: index < 3 ? '#fff' : '#333',
                              minWidth: 50,
                            }}
                          />
                          <Box display="flex" alignItems="center" gap={1} flex={1}>
                            <BusinessIcon sx={{ color: '#667eea', fontSize: 20 }} />
                            <Typography variant="body1" sx={{ fontWeight: 600, color: '#1a1a2e', fontSize: '1rem' }}>
                              {business.businessName}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 1.5 }} />

                      {/* Business Details */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Type
                          </Typography>
                          <Chip 
                            label={business.selectedType || 'Business'}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box display="flex" alignItems="center" gap={1}>
                            <VisibilityIcon sx={{ fontSize: 18, color: '#667eea' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Views
                            </Typography>
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', fontSize: '1.25rem' }}>
                            {business.viewCount.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          </>
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

      {/* Report Generation Dialog */}
      <Dialog 
        open={reportDialogOpen} 
        onClose={handleReportDialogClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: '1px solid #e0e0e0', pt: 3, px: 3 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <ReportIcon sx={{ color: '#667eea', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a1a2e' }}>
              Generate Report
          </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 5, pb: 2, px: 3, overflow: 'visible' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <Box sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel id="report-type-label" shrink>Report Type</InputLabel>
                <Select
                  labelId="report-type-label"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  label="Report Type"
              sx={{
                borderRadius: 2,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#d0d0d0',
                },
              }}
            >
                  <MenuItem value="user_summary">User Summary Report</MenuItem>
                  <MenuItem value="business_approvals">Business Approvals Report</MenuItem>
                  <MenuItem value="top_performers">Top Performing Businesses</MenuItem>
                  <MenuItem value="general">General Statistics Report</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              <Box sx={{ flex: 1 }}>
                <TextField
              fullWidth
                  label="Start Date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#d0d0d0',
                      },
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
              sx={{
                    '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#d0d0d0',
                      },
                },
              }}
                />
          </Box>
      </Box>
            <Box>
      <Box
          sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5', 
                  borderRadius: 2,
            border: '1px solid #e0e0e0',
          }}
        >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#667eea' }}>
                  Report Preview
          </Typography>
                <Typography variant="body2" color="text.secondary">
                  {reportType === 'user_summary' && 'This report will include total users, businesses, pending approvals, and account status.'}
                  {reportType === 'business_approvals' && 'This report will include pending approvals, total businesses, and account status.'}
                  {reportType === 'top_performers' && 'This report will include the top 5 performing businesses by view count.'}
                  {reportType === 'general' && 'This report will include all system statistics and metrics.'}
                        </Typography>
                      </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
            <Button
            onClick={handleReportDialogClose} 
            disabled={generatingReport}
              sx={{
                textTransform: 'none',
              px: 3,
              py: 1,
                borderRadius: 2,
              }}
            >
            Cancel
            </Button>
            <Button
            onClick={handleGenerateReport}
            variant="contained"
            disabled={generatingReport}
            startIcon={generatingReport ? <CircularProgress size={20} /> : <DownloadIcon />}
              sx={{
              bgcolor: '#667eea',
                textTransform: 'none',
              px: 3,
              py: 1,
                borderRadius: 2,
              fontWeight: 600,
                '&:hover': {
                bgcolor: '#5568d3',
                },
              }}
            >
            {generatingReport ? 'Generating...' : 'Generate & Download'}
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
            minWidth: 300,
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
          onClose={() => setReportSuccess('')}
        >
          {reportSuccess}
        </Alert>
      )}

    </Box>
  );
};

export default AdminDashboard;