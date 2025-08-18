import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  Search,
  Edit,
  Delete,
  Business as BusinessIcon,
  Person,
  Phone,
  CheckCircle,
  Cancel,
  Pending,
  Block,
} from '@mui/icons-material';
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Business {
  id: string;
  businessName: string;
  businessOwner: string;
  selectedType: string;
  businessHours: string;
  contactNumber: string;
  optionalContactNumber?: string;
  businessAddress: string;
  permitNumber: string;
  registrationDate: string;
  status: 'pending' | 'approved' | 'rejected';
  userId: string;
  userEmail: string;
  isActive: boolean;
}

const BusinessManagement: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Partial<Business>>({});
  const [tabValue, setTabValue] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'businesses'));
      const querySnapshot = await getDocs(q);
      const businessData: Business[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        businessData.push({ 
          id: doc.id, 
          ...data,
          isActive: data.isActive !== undefined ? data.isActive : true, // Default to active for existing businesses
        } as Business);
      });
      
      setBusinesses(businessData);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditBusiness = (business: Business) => {
    setSelectedBusiness(business);
    setEditingBusiness({
      businessName: business.businessName,
      businessHours: business.businessHours,
      contactNumber: business.contactNumber,
      optionalContactNumber: business.optionalContactNumber,
    });
    setDialogOpen(true);
  };

  const handleSaveBusiness = async () => {
    if (!selectedBusiness) return;

    try {
      await updateDoc(doc(db, 'businesses', selectedBusiness.id), editingBusiness);
      await fetchBusinesses();
      setDialogOpen(false);
      setSelectedBusiness(null);
      setEditingBusiness({});
      setSuccessMessage('Business updated successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error updating business:', error);
      setError('Failed to update business');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleToggleBusinessStatus = async (businessId: string, isActive: boolean, userId: string) => {
    // Show confirmation dialog when deactivating a business
    if (isActive) {
      const confirmed = window.confirm(
        'Are you sure you want to deactivate this business account?\n\n' +
        'Deactivated businesses will be:\n' +
        '• Unable to create new posts or manage their business\n' +
        '• Hidden from public view in the app\n' +
        '• Their business owner account will also be deactivated\n' +
        '• Still visible in the admin panel for record keeping\n\n' +
        'You can reactivate the business at any time.'
      );
      if (!confirmed) return;
    }

    try {
      // Update business status
      await updateDoc(doc(db, 'businesses', businessId), {
        isActive: !isActive,
      });

      // Update corresponding user account status
      if (userId) {
        await updateDoc(doc(db, 'users', userId), {
          isActive: !isActive,
        });
      }

      await fetchBusinesses();
      
      if (isActive) {
        setSuccessMessage('Business and owner account have been deactivated.');
      } else {
        setSuccessMessage('Business and owner account have been reactivated.');
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error updating business status:', error);
      setError('Failed to update business status. Please try again.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (window.confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'businesses', businessId));
        await fetchBusinesses();
        setSuccessMessage('Business deleted successfully');
        setTimeout(() => setSuccessMessage(''), 5000);
      } catch (error) {
        console.error('Error deleting business:', error);
        setError('Failed to delete business');
        setTimeout(() => setError(''), 5000);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle />;
      case 'rejected':
        return <Cancel />;
      case 'pending':
        return <Pending />;
      default:
        return <BusinessIcon />;
    }
  };

  const filteredBusinesses = businesses.filter((business) => {
    const matchesSearch = (business.businessName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (business.businessOwner?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    if (tabValue === 0) return matchesSearch && business.status === 'pending';
    if (tabValue === 1) return matchesSearch && business.status === 'approved';
    if (tabValue === 2) return matchesSearch && business.status === 'rejected';
    return matchesSearch;
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Business Management
      </Typography>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label={`Pending (${businesses.filter(b => b.status === 'pending').length})`} />
        <Tab label={`Approved (${businesses.filter(b => b.status === 'approved').length})`} />
        <Tab label={`Rejected (${businesses.filter(b => b.status === 'rejected').length})`} />
        <Tab label={`All (${businesses.length})`} />
      </Tabs>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search businesses by name or owner..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Business</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Activity Status</TableCell>
                  <TableCell>Approval Status</TableCell>
                  <TableCell>Registered</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBusinesses.map((business) => (
                  <TableRow 
                    key={business.id}
                    sx={{ 
                      opacity: business.isActive ? 1 : 0.6,
                      backgroundColor: business.isActive ? 'inherit' : 'action.hover'
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <BusinessIcon sx={{ mr: 1 }} />
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {business.businessName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {business.businessAddress}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Person sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2">{business.businessOwner}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{business.selectedType}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Phone sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2">{business.contactNumber}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" alignItems="flex-start">
                        <Chip
                          icon={business.isActive ? <CheckCircle /> : <Block />}
                          label={business.isActive ? 'Active' : 'Inactive'}
                          color={business.isActive ? 'success' : 'error'}
                          size="small"
                        />
                        {!business.isActive && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            Cannot operate business
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(business.status)}
                        label={business.status}
                        color={getStatusColor(business.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(business.registrationDate).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={business.isActive}
                              onChange={() => handleToggleBusinessStatus(business.id, business.isActive, business.userId)}
                              size="small"
                            />
                          }
                          label=""
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleEditBusiness(business)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteBusiness(business.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Business</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Business Name"
              value={editingBusiness.businessName || ''}
              onChange={(e) => setEditingBusiness({ ...editingBusiness, businessName: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Business Hours"
              value={editingBusiness.businessHours || ''}
              onChange={(e) => setEditingBusiness({ ...editingBusiness, businessHours: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Contact Number"
              value={editingBusiness.contactNumber || ''}
              onChange={(e) => setEditingBusiness({ ...editingBusiness, contactNumber: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Optional Contact Number"
              value={editingBusiness.optionalContactNumber || ''}
              onChange={(e) => setEditingBusiness({ ...editingBusiness, optionalContactNumber: e.target.value })}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveBusiness} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BusinessManagement; 