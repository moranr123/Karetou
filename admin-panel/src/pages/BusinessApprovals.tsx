import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  InputAdornment,
  CardActionArea,
  Divider,
  IconButton,
  Alert,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Business,
  Person,
  Phone,
  LocationOn,
  Schedule,
  Search,
  Email,
  CalendarToday,
  Description,
  Close,
  ZoomIn,
} from '@mui/icons-material';
import { collection, query, getDocs, doc, updateDoc, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

interface BusinessRegistration {
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
  permitPhoto: string;
  frontIDPhoto: string;
  backIDPhoto: string;
  businessImages?: string[];
  businessLocation?: {
    latitude: number;
    longitude: number;
  };
  rejectionReason?: string;
  approvedDate?: string;
  rejectedDate?: string;
}

interface BusinessApprovalsProps {
  tab?: 'pending' | 'approved' | 'rejected';
}

const BusinessApprovals: React.FC<BusinessApprovalsProps> = ({ tab }) => {
  const [businesses, setBusinesses] = useState<BusinessRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRegistration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [imageDialogTitle, setImageDialogTitle] = useState<string>('');
  
  // Determine initial tab value based on the tab prop
  const getInitialTabValue = () => {
    if (tab === 'pending') return 0;
    if (tab === 'approved') return 1;
    if (tab === 'rejected') return 2;
    return 0;
  };
  
  const [tabValue, setTabValue] = useState(getInitialTabValue());

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    // Update tab when prop changes
    setTabValue(getInitialTabValue());
  }, [tab]);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'businesses'));
      const querySnapshot = await getDocs(q);
      const businessData: BusinessRegistration[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        businessData.push({ 
          id: doc.id, 
          ...data,
          // Ensure all fields are present
          optionalContactNumber: data.optionalContactNumber || '',
          rejectionReason: data.rejectionReason || '',
          approvedDate: data.approvedDate || '',
          rejectedDate: data.rejectedDate || '',
        } as BusinessRegistration);
      });
      
      // Sort by registration date (newest first)
      businessData.sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime());
      
      setBusinesses(businessData);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to create notification for business owner
  const createNotificationForBusinessOwner = async (
    userId: string,
    title: string,
    body: string,
    type: 'business_approval' | 'business_rejection',
    businessData: any
  ) => {
    try {
      const notificationRef = doc(collection(db, 'notifications'));
      await setDoc(notificationRef, {
        title,
        body,
        data: {
          type: 'business_status',
          businessId: businessData.id,
          status: businessData.status,
          businessName: businessData.businessName
        },
        type,
        userId,
        read: false,
        createdAt: new Date().toISOString()
      });
      console.log('Notification created successfully for user:', userId);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  // Function to notify all regular users about new approved business
  const notifyUsersAboutNewPlace = async (businessData: BusinessRegistration) => {
    try {
      const title = '🎉 New place registered!';
      const body = `${businessData.businessName} (${businessData.selectedType}) has joined PawSafety in ${businessData.businessAddress}`;

      // Get all regular users (not business owners) to notify them
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('userType', '!=', 'business'));
      const usersSnapshot = await getDocs(usersQuery);

      const notifications: Promise<void>[] = [];
      usersSnapshot.forEach((userDoc) => {
        const notificationRef = doc(collection(db, 'notifications'));
        notifications.push(
          setDoc(notificationRef, {
            title,
            body,
            data: {
              businessName: businessData.businessName,
              businessType: businessData.selectedType,
              businessAddress: businessData.businessAddress,
              action: 'new_place'
            },
            type: 'new_place',
            userId: userDoc.id,
            read: false,
            createdAt: new Date().toISOString()
          })
        );
      });

      await Promise.all(notifications);
      console.log(`✅ New place notifications sent to ${notifications.length} users`);
    } catch (error) {
      console.error('Error sending new place notifications:', error);
    }
  };

  const handleApprove = async (businessId: string) => {
    try {
      setProcessing(true);
      const approvedDate = new Date().toISOString();
      
      // Update business status
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'approved',
        approvedDate,
      });

      // Create notification for business owner
      const business = businesses.find(b => b.id === businessId);
      if (business) {
        await createNotificationForBusinessOwner(
          business.userId,
          '🎉 Business Approved!',
          `Congratulations! Your business "${business.businessName}" has been approved and is now live on Karetou!`,
          'business_approval',
          { ...business, status: 'approved' }
        );

        // Notify all regular users about the new place
        await notifyUsersAboutNewPlace(business);
      }
      
      await fetchBusinesses();
      setDialogOpen(false);
      setSelectedBusiness(null);
    } catch (error) {
      console.error('Error approving business:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (businessId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      const rejectedDate = new Date().toISOString();
      
      // Update business status
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'rejected',
        rejectionReason,
        rejectedDate,
      });

      // Create notification for business owner
      const business = businesses.find(b => b.id === businessId);
      if (business) {
        await createNotificationForBusinessOwner(
          business.userId,
          '❌ Business Application Rejected',
          `Unfortunately, your business "${business.businessName}" was not approved. Reason: ${rejectionReason}. Please contact support for more information.`,
          'business_rejection',
          { ...business, status: 'rejected', rejectionReason }
        );
      }
      
      await fetchBusinesses();
      setDialogOpen(false);
      setSelectedBusiness(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting business:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCardClick = (business: BusinessRegistration) => {
    setSelectedBusiness(business);
    setRejectionReason(business.rejectionReason || '');
    setDialogOpen(true);
  };

  const handleImageClick = (imageUrl: string, title: string) => {
    setSelectedImage(imageUrl);
    setImageDialogTitle(title);
    setImageDialogOpen(true);
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

  const getImageErrorMessage = (imageUrl: string | undefined) => {
    if (!imageUrl) return 'No image uploaded';
    if (imageUrl.startsWith('file://') || imageUrl.startsWith('content://')) {
      return 'Local file - not accessible from web';
    }
    return 'Image failed to load';
  };

  const filteredBusinesses = businesses.filter((business) => {
    // First filter by tab status
    let statusMatch = true;
    if (tabValue === 0) statusMatch = business.status === 'pending';
    else if (tabValue === 1) statusMatch = business.status === 'approved';
    else if (tabValue === 2) statusMatch = business.status === 'rejected';

    // Then filter by search term
    const searchMatch = searchTerm === '' || 
      (business.businessName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (business.businessOwner?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (business.selectedType?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (business.businessAddress?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (business.contactNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (business.permitNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    return statusMatch && searchMatch;
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Get status info for header
  const getStatusInfo = () => {
    if (tabValue === 0) return { title: 'Business Applications', color: '#FF9800', icon: <Schedule sx={{ fontSize: 32 }} />, count: businesses.filter(b => b.status === 'pending').length };
    if (tabValue === 1) return { title: 'Registered Business', color: '#4CAF50', icon: <CheckCircle sx={{ fontSize: 32 }} />, count: businesses.filter(b => b.status === 'approved').length };
    if (tabValue === 2) return { title: 'Archived Business', color: '#F44336', icon: <Cancel sx={{ fontSize: 32 }} />, count: businesses.filter(b => b.status === 'rejected').length };
    return { title: 'Business Applications', color: '#667eea', icon: <Business sx={{ fontSize: 32 }} />, count: businesses.length };
  };

  const statusInfo = getStatusInfo();

  return (
    <Box>
      {/* Modern Header Section */}
      <Box 
        sx={{ 
          mb: 4,
          p: 3,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${statusInfo.color}15 0%, ${statusInfo.color}05 100%)`,
          border: `1px solid ${statusInfo.color}30`,
        }}
      >
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Box sx={{ color: statusInfo.color }}>
            {statusInfo.icon}
          </Box>
          <Box flex={1}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 0.5 }}>
              {statusInfo.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {statusInfo.count} {statusInfo.count === 1 ? 'business' : 'businesses'} in this category
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search businesses by name, owner, type, address, contact, or permit number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: '#fff',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: statusInfo.color,
                },
              },
            },
          }}
        />
      </Box>

      {filteredBusinesses.length === 0 && !loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? `No businesses found matching "${searchTerm}"` : 'No businesses found'}
          </Typography>
        </Box>
      )}

      {/* Business Cards Grid */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: '1fr', 
          sm: 'repeat(auto-fill, minmax(350px, 1fr))',
          md: 'repeat(auto-fill, minmax(380px, 1fr))'
        }, 
        gap: { xs: 2, sm: 3 } 
      }}>
        {filteredBusinesses.map((business) => (
          <Card 
            key={business.id} 
            sx={{ 
              cursor: 'pointer',
              borderRadius: 3,
              border: '1px solid #e0e0e0',
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                borderColor: statusInfo.color,
              }
            }}
          >
            <CardActionArea onClick={() => handleCardClick(business)}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                {/* Header with Business Name and Status */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                  <Typography variant="h6" component="h2" sx={{ flex: 1, mr: 1, fontWeight: 600, color: '#1a1a2e' }}>
                    {business.businessName}
                  </Typography>
                  <Chip
                    label={business.status.toUpperCase()}
                    color={getStatusColor(business.status) as any}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                {/* Business Details */}
                <Box mb={2.5} sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 1.5 } }}>
                  <Box display="flex" alignItems="center">
                    <Person sx={{ mr: 1.5, fontSize: 18, color: statusInfo.color }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Owner</Typography>
                      <Typography variant="body2" fontWeight={500}>{business.businessOwner}</Typography>
                  </Box>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Business sx={{ mr: 1.5, fontSize: 18, color: statusInfo.color }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Type</Typography>
                      <Typography variant="body2" fontWeight={500}>{business.selectedType}</Typography>
                  </Box>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Phone sx={{ mr: 1.5, fontSize: 18, color: statusInfo.color }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Contact</Typography>
                      <Typography variant="body2" fontWeight={500}>{business.contactNumber}</Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="flex-start">
                    <LocationOn sx={{ mr: 1.5, fontSize: 18, color: statusInfo.color, mt: 0.5 }} />
                    <Box flex={1}>
                      <Typography variant="caption" color="text.secondary" display="block">Address</Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                      {business.businessAddress}
                    </Typography>
                  </Box>
                  </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Footer */}
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Permit Number</Typography>
                    <Typography variant="body2" fontWeight={600} color={statusInfo.color}>
                      {business.permitNumber}
                </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="caption" color="text.secondary" display="block">
                      Registered
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {new Date(business.registrationDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>

                <Box mt={2} p={1.5} sx={{ 
                  bgcolor: `${statusInfo.color}08`, 
                  borderRadius: 2,
                  textAlign: 'center',
                }}>
                  <Typography variant="caption" sx={{ color: statusInfo.color, fontWeight: 600 }}>
                    Click to view full details and documents →
                  </Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      {/* Full Business Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {selectedBusiness?.businessName} - Business Registration Details
            </Typography>
            <IconButton onClick={() => setDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedBusiness && (
            <Box>
              {/* Status and Basic Info */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Chip
                  label={selectedBusiness.status.toUpperCase()}
                  color={getStatusColor(selectedBusiness.status) as any}
                  size="medium"
                />
                <Typography variant="body2" color="text.secondary">
                  ID: {selectedBusiness.id}
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                {/* Business Information */}
                <Box>
                  <Typography variant="h6" gutterBottom color="primary">
                    Business Information
                  </Typography>
                  <Box mb={2}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Business sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Business Name</Typography>
                        <Typography variant="body1" fontWeight="medium">{selectedBusiness.businessName}</Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Description sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Business Type</Typography>
                        <Typography variant="body1">{selectedBusiness.selectedType}</Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Schedule sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Business Hours</Typography>
                        <Typography variant="body1">{selectedBusiness.businessHours}</Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Description sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Permit Number</Typography>
                        <Typography variant="body1" fontWeight="medium">{selectedBusiness.permitNumber}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* Owner & Contact Information */}
                <Box>
                  <Typography variant="h6" gutterBottom color="primary">
                    Owner & Contact Information
                  </Typography>
                  <Box mb={2}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Person sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Business Owner</Typography>
                        <Typography variant="body1" fontWeight="medium">{selectedBusiness.businessOwner}</Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Email sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Email</Typography>
                        <Typography variant="body1">{selectedBusiness.userEmail}</Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Phone sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Primary Contact</Typography>
                        <Typography variant="body1">{selectedBusiness.contactNumber}</Typography>
                      </Box>
                    </Box>
                    {selectedBusiness.optionalContactNumber && (
                      <Box display="flex" alignItems="center" mb={1}>
                        <Phone sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">Alternative Contact</Typography>
                          <Typography variant="body1">{selectedBusiness.optionalContactNumber}</Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>

              {/* Location Information */}
              <Box mt={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  Location Information
                </Typography>
                <Box display="flex" alignItems="start" mb={2}>
                  <LocationOn sx={{ mr: 1, color: 'text.secondary', mt: 0.5 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Business Address</Typography>
                    <Typography variant="body1">{selectedBusiness.businessAddress}</Typography>
                    {selectedBusiness.businessLocation && (
                      <Typography variant="caption" color="text.secondary">
                        Coordinates: {selectedBusiness.businessLocation.latitude.toFixed(6)}, {selectedBusiness.businessLocation.longitude.toFixed(6)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>

              {/* Registration Timeline */}
              <Box mt={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  Registration Timeline
                </Typography>
                <Box mb={2}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <CalendarToday sx={{ mr: 1, color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Registration Date</Typography>
                      <Typography variant="body1">{new Date(selectedBusiness.registrationDate).toLocaleString()}</Typography>
                    </Box>
                  </Box>
                  {selectedBusiness.approvedDate && (
                    <Box display="flex" alignItems="center" mb={1}>
                      <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Approved Date</Typography>
                        <Typography variant="body1">{new Date(selectedBusiness.approvedDate).toLocaleString()}</Typography>
                      </Box>
                    </Box>
                  )}
                  {selectedBusiness.rejectedDate && (
                    <Box display="flex" alignItems="center" mb={1}>
                      <Cancel sx={{ mr: 1, color: 'error.main' }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Rejected Date</Typography>
                        <Typography variant="body1">{new Date(selectedBusiness.rejectedDate).toLocaleString()}</Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Submitted Documents */}
              <Box mt={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  Submitted Documents
                </Typography>
                
                {/* Info about local file paths */}
                {(selectedBusiness.permitPhoto?.startsWith('file://') || 
                  selectedBusiness.frontIDPhoto?.startsWith('file://') || 
                  selectedBusiness.backIDPhoto?.startsWith('file://')) && (
                  <Box sx={{ mb: 2 }}>
                    <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                      Some images were uploaded as local files from the mobile app and cannot be displayed in the web admin panel. 
                      New registrations will store images properly in cloud storage.
                    </Alert>
                  </Box>
                )}
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                  {/* Business Permit Photo */}
                  <Box>
                    <Typography variant="body2" gutterBottom>Business Permit</Typography>
                    {selectedBusiness.permitPhoto ? (
                      <>
                        <Box
                          component="img"
                          src={selectedBusiness.permitPhoto}
                          alt="Business Permit"
                          sx={{
                            width: '100%',
                            height: 120,
                            objectFit: 'cover',
                            borderRadius: 1,
                            cursor: 'pointer',
                            border: '1px solid #ddd',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => handleImageClick(selectedBusiness.permitPhoto, 'Business Permit')}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const sibling = target.nextElementSibling as HTMLElement;
                            target.style.display = 'none';
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                        <Box
                          sx={{
                            width: '100%',
                            height: 120,
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #ddd',
                            borderRadius: 1,
                            flexDirection: 'column'
                          }}
                        >
                          <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                          <Typography variant="caption" color="textSecondary">
                            {getImageErrorMessage(selectedBusiness.permitPhoto)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<ZoomIn />}
                          onClick={() => handleImageClick(selectedBusiness.permitPhoto, 'Business Permit')}
                          sx={{ mt: 1 }}
                        >
                          View Full Size
                        </Button>
                      </>
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: 120,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: 1,
                          flexDirection: 'column'
                        }}
                      >
                        <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                        <Typography variant="caption" color="textSecondary">
                          {getImageErrorMessage(selectedBusiness.permitPhoto)}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Front ID Photo */}
                  <Box>
                    <Typography variant="body2" gutterBottom>ID Front</Typography>
                    {selectedBusiness.frontIDPhoto ? (
                      <>
                        <Box
                          component="img"
                          src={selectedBusiness.frontIDPhoto}
                          alt="ID Front"
                          sx={{
                            width: '100%',
                            height: 120,
                            objectFit: 'cover',
                            borderRadius: 1,
                            cursor: 'pointer',
                            border: '1px solid #ddd',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => handleImageClick(selectedBusiness.frontIDPhoto, 'ID Front')}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const sibling = target.nextElementSibling as HTMLElement;
                            target.style.display = 'none';
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                        <Box
                          sx={{
                            width: '100%',
                            height: 120,
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #ddd',
                            borderRadius: 1,
                            flexDirection: 'column'
                          }}
                        >
                          <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                          <Typography variant="caption" color="textSecondary">
                            {getImageErrorMessage(selectedBusiness.frontIDPhoto)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<ZoomIn />}
                          onClick={() => handleImageClick(selectedBusiness.frontIDPhoto, 'ID Front')}
                          sx={{ mt: 1 }}
                        >
                          View Full Size
                        </Button>
                      </>
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: 120,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: 1,
                          flexDirection: 'column'
                        }}
                      >
                        <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                        <Typography variant="caption" color="textSecondary">
                          {getImageErrorMessage(selectedBusiness.frontIDPhoto)}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Back ID Photo */}
                  <Box>
                    <Typography variant="body2" gutterBottom>ID Back</Typography>
                    {selectedBusiness.backIDPhoto ? (
                      <>
                        <Box
                          component="img"
                          src={selectedBusiness.backIDPhoto}
                          alt="ID Back"
                          sx={{
                            width: '100%',
                            height: 120,
                            objectFit: 'cover',
                            borderRadius: 1,
                            cursor: 'pointer',
                            border: '1px solid #ddd',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => handleImageClick(selectedBusiness.backIDPhoto, 'ID Back')}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const sibling = target.nextElementSibling as HTMLElement;
                            target.style.display = 'none';
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                        <Box
                          sx={{
                            width: '100%',
                            height: 120,
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #ddd',
                            borderRadius: 1,
                            flexDirection: 'column'
                          }}
                        >
                          <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                          <Typography variant="caption" color="textSecondary">
                            {getImageErrorMessage(selectedBusiness.backIDPhoto)}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<ZoomIn />}
                          onClick={() => handleImageClick(selectedBusiness.backIDPhoto, 'ID Back')}
                          sx={{ mt: 1 }}
                        >
                          View Full Size
                        </Button>
                      </>
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: 120,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: 1,
                          flexDirection: 'column'
                        }}
                      >
                        <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                        <Typography variant="caption" color="textSecondary">
                          {getImageErrorMessage(selectedBusiness.backIDPhoto)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Business Images Section */}
                {selectedBusiness.businessImages && selectedBusiness.businessImages.length > 0 && (
                  <Box mt={3}>
                    <Typography variant="h6" gutterBottom color="primary">
                      Business Images ({selectedBusiness.businessImages.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Photos showcasing the business establishment, products, or services
                    </Typography>
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                      {selectedBusiness.businessImages.map((imageUrl, index) => (
                        <Box key={index}>
                          <Typography variant="caption" color="text.secondary">
                            Image {index + 1}
                          </Typography>
                          {imageUrl ? (
                            <>
                              <Box
                                component="img"
                                src={imageUrl}
                                alt={`Business Image ${index + 1}`}
                                sx={{
                                  width: '100%',
                                  height: 120,
                                  objectFit: 'cover',
                                  borderRadius: 1,
                                  cursor: 'pointer',
                                  border: '1px solid #ddd',
                                  '&:hover': {
                                    opacity: 0.8
                                  }
                                }}
                                onClick={() => handleImageClick(imageUrl, `Business Image ${index + 1}`)}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const sibling = target.nextElementSibling as HTMLElement;
                                  target.style.display = 'none';
                                  if (sibling) sibling.style.display = 'flex';
                                }}
                              />
                              <Box
                                sx={{
                                  width: '100%',
                                  height: 120,
                                  display: 'none',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#f5f5f5',
                                  border: '1px solid #ddd',
                                  borderRadius: 1,
                                  flexDirection: 'column'
                                }}
                              >
                                <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                                <Typography variant="caption" color="textSecondary">
                                  {getImageErrorMessage(imageUrl)}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                startIcon={<ZoomIn />}
                                onClick={() => handleImageClick(imageUrl, `Business Image ${index + 1}`)}
                                sx={{ mt: 1, fontSize: '0.75rem' }}
                                fullWidth
                              >
                                View
                              </Button>
                            </>
                          ) : (
                            <Box
                              sx={{
                                width: '100%',
                                height: 120,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#f5f5f5',
                                border: '1px solid #ddd',
                                borderRadius: 1,
                                flexDirection: 'column'
                              }}
                            >
                              <Description sx={{ fontSize: 40, color: '#999', mb: 1 }} />
                              <Typography variant="caption" color="textSecondary">
                                No image uploaded
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Rejection Reason (if applicable) */}
              {selectedBusiness.rejectionReason && selectedBusiness.status === 'rejected' && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom color="error">
                    Rejection Reason
                  </Typography>
                  <Typography variant="body1" color="error">
                    {selectedBusiness.rejectionReason}
                  </Typography>
                </Box>
              )}

              {/* Action Section for Pending Applications */}
              {selectedBusiness.status === 'pending' && (
                <Box mt={3}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom color="primary">
                    Admin Actions
                  </Typography>
                  <TextField
                    fullWidth
                    label="Rejection Reason (required if rejecting)"
                    multiline
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button 
            onClick={() => setDialogOpen(false)} 
            disabled={processing}
            variant="outlined"
            sx={{
              borderColor: '#999',
              color: '#666',
              textTransform: 'none',
              px: 3,
              py: 1,
              borderRadius: 2,
              '&:hover': {
                borderColor: '#666',
                bgcolor: 'rgba(0,0,0,0.05)',
              },
            }}
          >
            Close
          </Button>
          {selectedBusiness?.status === 'pending' && (
            <>
              <Button
                onClick={() => handleReject(selectedBusiness.id)}
                variant="contained"
                disabled={processing || !rejectionReason.trim()}
                sx={{
                  bgcolor: '#F44336',
                  color: '#fff',
                  textTransform: 'none',
                  px: 4,
                  py: 1.2,
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',
                  '&:hover': {
                    bgcolor: '#D32F2F',
                    boxShadow: '0 6px 16px rgba(244, 67, 54, 0.4)',
                  },
                  '&:disabled': {
                    bgcolor: '#ccc',
                    color: '#999',
                  },
                }}
              >
                {processing ? <CircularProgress size={20} color="inherit" /> : (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Cancel sx={{ fontSize: 20 }} />
                    Reject
                  </Box>
                )}
              </Button>
              <Button
                onClick={() => handleApprove(selectedBusiness.id)}
                variant="contained"
                disabled={processing}
                sx={{
                  bgcolor: '#4CAF50',
                  color: '#fff',
                  textTransform: 'none',
                  px: 4,
                  py: 1.2,
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                  '&:hover': {
                    bgcolor: '#45a049',
                    boxShadow: '0 6px 16px rgba(76, 175, 80, 0.4)',
                  },
                  '&:disabled': {
                    bgcolor: '#ccc',
                    color: '#999',
                  },
                }}
              >
                {processing ? <CircularProgress size={20} color="inherit" /> : (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle sx={{ fontSize: 20 }} />
                    Approve
                  </Box>
                )}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Image Zoom Dialog */}
      <Dialog 
        open={imageDialogOpen} 
        onClose={() => setImageDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{imageDialogTitle}</Typography>
            <IconButton onClick={() => setImageDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center">
            <Box
              component="img"
              src={selectedImage}
              alt={imageDialogTitle}
              sx={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 1,
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default BusinessApprovals; 