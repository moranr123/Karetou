import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Archive as ArchiveIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Visibility as ViewIcon,
  Restore as RestoreIcon,
  Email,
  Phone,
  CalendarToday,
  Search,
} from '@mui/icons-material';
import { collection, getDocs, doc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ArchivedUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
  archivedAt: string;
  originalId: string;
  type: 'user';
  hasBusinessRegistration?: boolean;
  isActive?: boolean;
  userType?: 'user' | 'business';
  businessId?: string;
  lastLogin?: string;
}

interface ArchivedAdmin {
  id: string;
  email: string;
  uid: string;
  role: 'admin';
  createdAt: string;
  archivedAt: string;
  originalId: string;
  type: 'admin';
  isActive?: boolean;
  createdBy?: string;
}

type ArchivedItem = ArchivedUser | ArchivedAdmin;

const Archive: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabValue = useMemo(() => (searchParams.get('tab') as 'user' | 'admin') || 'user', [searchParams]);
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ArchivedItem | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchArchivedItems = useCallback(async () => {
    try {
      setLoading(true);
      const collectionName = tabValue === 'user' ? 'archivedUsers' : 'archivedAdmins';
      const snapshot = await getDocs(collection(db, collectionName));
      const items: ArchivedItem[] = [];
      
      snapshot.forEach((doc) => {
        items.push({
          id: doc.id,
          ...doc.data(),
        } as ArchivedItem);
      });
      
      // Sort by archived date (newest first)
      items.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
      
      setArchivedItems(items);
    } catch (error) {
      console.error('Error fetching archived items:', error);
      setError('Failed to load archived items');
    } finally {
      setLoading(false);
    }
  }, [tabValue]);


  useEffect(() => {
    fetchArchivedItems();
  }, [fetchArchivedItems]);

  const handleViewDetails = (item: ArchivedItem) => {
    setSelectedItem(item);
    setDetailsDialogOpen(true);
  };

  const handleRestore = (item: ArchivedItem) => {
    setSelectedItem(item);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedItem) return;

    try {
      setRestoring(true);
      const archivedRef = doc(db, tabValue === 'user' ? 'archivedUsers' : 'archivedAdmins', selectedItem.id);
      const archivedDoc = await getDoc(archivedRef);

      if (archivedDoc.exists()) {
        const data = archivedDoc.data();
        const { archivedAt, originalId, type, ...restoreData } = data;

        // Restore to original collection using the originalId (which should be the Firebase Auth UID)
        // This ensures the document ID matches the user's UID for login to work
        if (tabValue === 'user') {
          if (!originalId) {
            throw new Error('Original ID not found. Cannot restore user.');
          }
          // Use setDoc with the originalId to restore with the correct document ID
          await setDoc(doc(db, 'users', originalId), restoreData);
        } else {
          if (!originalId) {
            throw new Error('Original ID not found. Cannot restore admin.');
          }
          // For admins, we also need to check if there's a uid field
          // If originalId is the document ID, use it; otherwise use uid if available
          const adminId = restoreData.uid || originalId;
          await setDoc(doc(db, 'adminUsers', adminId), restoreData);
        }

        // Delete from archive
        await deleteDoc(archivedRef);
      }

      setRestoreDialogOpen(false);
      setSelectedItem(null);
      setSuccessMessage(`${tabValue === 'user' ? 'User' : 'Admin'} restored successfully`);
      setTimeout(() => setSuccessMessage(''), 5000);
      await fetchArchivedItems();
    } catch (error) {
      console.error('Error restoring item:', error);
      setError(`Failed to restore ${tabValue === 'user' ? 'user' : 'admin'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setRestoring(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false);
    setSelectedItem(null);
  };

  const handleCloseRestore = () => {
    setRestoreDialogOpen(false);
    setSelectedItem(null);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1a1a2e', fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Archive
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          View and restore archived users and admins.
        </Typography>
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder={`Search archived ${tabValue === 'user' ? 'users' : 'admins'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                borderColor: '#ddd',
                '&:hover fieldset': {
                  borderColor: '#667eea',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#667eea',
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#667eea' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
        </Box>
      ) : archivedItems.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ArchiveIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Archived {tabValue === 'user' ? 'Users' : 'Admins'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Archived {tabValue === 'user' ? 'users' : 'admins'} will appear here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {archivedItems
            .filter((item) => {
              if (!searchTerm) return true;
              const searchLower = searchTerm.toLowerCase();
              if (tabValue === 'user') {
                const user = item as ArchivedUser;
                return (
                  user.email.toLowerCase().includes(searchLower) ||
                  user.fullName.toLowerCase().includes(searchLower) ||
                  user.phoneNumber?.toLowerCase().includes(searchLower)
                );
              } else {
                const admin = item as ArchivedAdmin;
                return admin.email.toLowerCase().includes(searchLower);
              }
            })
            .map((item) => (
            <Card key={item.id} sx={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {tabValue === 'user' ? (
                        <PersonIcon sx={{ color: '#667eea' }} />
                      ) : (
                        <AdminIcon sx={{ color: '#667eea' }} />
                      )}
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {tabValue === 'user' ? (item as ArchivedUser).fullName : (item as ArchivedAdmin).email}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      <Email sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                      {item.email}
                    </Typography>
                    {tabValue === 'user' && (item as ArchivedUser).phoneNumber && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        <Phone sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        {(item as ArchivedUser).phoneNumber}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      <CalendarToday sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                      Archived: {new Date(item.archivedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => handleViewDetails(item)}
                      sx={{ textTransform: 'none' }}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<RestoreIcon />}
                      onClick={() => handleRestore(item)}
                      sx={{ textTransform: 'none' }}
                    >
                      Restore
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* View Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={handleCloseDetails} maxWidth="sm" fullWidth>
        <DialogTitle>
          {tabValue === 'user' ? 'User' : 'Admin'} Details
        </DialogTitle>
        <DialogContent>
          {selectedItem && (
            <List>
              <ListItem>
                <ListItemText
                  primary="Email"
                  secondary={selectedItem.email}
                />
              </ListItem>
              {tabValue === 'user' && (
                <>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Full Name"
                      secondary={(selectedItem as ArchivedUser).fullName}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Phone Number"
                      secondary={(selectedItem as ArchivedUser).phoneNumber || 'N/A'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Has Business Registration"
                      secondary={(selectedItem as ArchivedUser).hasBusinessRegistration ? 'Yes' : 'No'}
                    />
                  </ListItem>
                </>
              )}
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Created At"
                  secondary={new Date(selectedItem.createdAt).toLocaleString()}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Archived At"
                  secondary={new Date(selectedItem.archivedAt).toLocaleString()}
                />
              </ListItem>
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onClose={handleCloseRestore}>
        <DialogTitle>Restore {tabValue === 'user' ? 'User' : 'Admin'}?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to restore {tabValue === 'user' ? (selectedItem as ArchivedUser)?.fullName : selectedItem?.email}? 
            This will move them back to the {tabValue === 'user' ? 'users' : 'admins'} list.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRestore} disabled={restoring}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmRestore} 
            variant="contained" 
            color="success"
            disabled={restoring}
            startIcon={restoring ? <CircularProgress size={16} /> : <RestoreIcon />}
          >
            {restoring ? 'Restoring...' : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Archive;

