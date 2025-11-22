import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search,
  Archive,
  Person,
  Email,
  Phone,
  CalendarToday,
  CheckCircle,
  Block,
  Business,
} from '@mui/icons-material';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
  hasBusinessRegistration: boolean;
  businessId?: string;
  isActive: boolean;
  lastLogin?: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [businessStatusFilter, setBusinessStatusFilter] = useState<'all' | 'businessOwner' | 'regularUser'>('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<{ id: string; email: string; fullName: string; isActive: boolean } | null>(null);

  const needsDeactivation = (user: User): boolean => {
    if (!user.lastLogin) {
      // If no lastLogin (logout time) recorded, don't show needs deactivation
      return false;
    }
    const lastLogoutDate = new Date(user.lastLogin); // lastLogin now stores logout time
    const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
    return minutesSinceLogout > 1;
  };

  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchUsers();
    // Check if filter parameter is set to inactive
    const filterParam = searchParams.get('filter');
    if (filterParam === 'inactive') {
      setStatusFilter('inactive');
    }
  }, [searchParams]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const userData: User[] = [];
      
      // Fetch all businesses to check ownership
      const businessesQuery = query(collection(db, 'businesses'));
      const businessesSnapshot = await getDocs(businessesQuery);
      const userBusinessMap = new Map<string, boolean>();
      
      businessesSnapshot.forEach((businessDoc) => {
        const businessData = businessDoc.data();
        const userId = businessData.userId;
        if (userId) {
          userBusinessMap.set(userId, true);
        }
      });
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = doc.id;
        const userUid = data.uid || userId; // Check both document id and uid field
        
        // Check if user has businesses in the businesses collection
        // Check both userId (document id) and uid field
        const hasBusiness = 
          userBusinessMap.has(userId) || 
          userBusinessMap.has(userUid) || 
          data.hasBusinessRegistration || 
          data.businessId;
        
        userData.push({
          id: userId,
          email: data.email || '',
          fullName: data.fullName || '',
          phoneNumber: data.phoneNumber || '',
          createdAt: data.createdAt || new Date().toISOString(),
          hasBusinessRegistration: hasBusiness,
          businessId: data.businessId || undefined,
          isActive: data.isActive !== undefined ? data.isActive : true, // Default to active for existing users
          lastLogin: data.lastLogin || undefined,
        } as User);
      });
      
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleToggleUserStatus = (userId: string, email: string, fullName: string, isActive: boolean) => {
    // Show confirmation dialog only when deactivating
    if (isActive) {
      setUserToDeactivate({ id: userId, email, fullName, isActive });
      setDeactivateDialogOpen(true);
    } else {
      // Reactivate directly without confirmation
      handleConfirmToggleUserStatus(userId, isActive);
    }
  };

  const handleConfirmToggleUserStatus = async (userId?: string, isActive?: boolean) => {
    const userIdToUpdate = userId || userToDeactivate?.id;
    const isActiveStatus = isActive !== undefined ? isActive : userToDeactivate?.isActive;
    
    if (!userIdToUpdate || isActiveStatus === undefined) return;

    try {
      await updateDoc(doc(db, 'users', userIdToUpdate), {
        isActive: !isActiveStatus,
      });
      
      // Update local state instead of refetching
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userIdToUpdate 
            ? { ...user, isActive: !isActiveStatus }
            : user
        )
      );
      
      if (isActiveStatus) {
        setSuccessMessage('User account has been deactivated.');
      } else {
        setSuccessMessage('User account has been reactivated.');
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeactivateDialogOpen(false);
      setUserToDeactivate(null);
    }
  };

  const handleCancelDeactivate = () => {
    setDeactivateDialogOpen(false);
    setUserToDeactivate(null);
  };

  const handleArchiveUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to archive this user? You can restore them later from the Archive page.')) {
      try {
        const userRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          // Move to archived collection
          await addDoc(collection(db, 'archivedUsers'), {
            ...userData,
            archivedAt: new Date().toISOString(),
            originalId: userId,
            type: 'user',
          });
          // Delete from users collection
          await deleteDoc(userRef);
        }
        
        await fetchUsers();
        setSuccessMessage('User archived successfully');
        setTimeout(() => setSuccessMessage(''), 5000);
      } catch (error) {
        console.error('Error archiving user:', error);
        setError('Failed to archive user');
        setTimeout(() => setError(''), 5000);
      }
    }
  };


  const filteredUsers = users.filter((user) => {
    // Filter by search term
    const searchMatch = 
      (user.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.phoneNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    // Filter by status
    const statusMatch = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && user.isActive && !needsDeactivation(user)) ||
      (statusFilter === 'inactive' && (!user.isActive || needsDeactivation(user)));

    // Filter by business status
    const businessStatusMatch = 
      businessStatusFilter === 'all' ||
      (businessStatusFilter === 'businessOwner' && user.hasBusinessRegistration) ||
      (businessStatusFilter === 'regularUser' && !user.hasBusinessRegistration);

    return searchMatch && statusMatch && businessStatusMatch;
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
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
        User Management
      </Typography>

      {successMessage && (
        <Alert 
          severity="success" 
          sx={{ 
            position: 'fixed', 
            top: { xs: 10, sm: 20 }, 
            right: { xs: 10, sm: 20 },
            left: { xs: 10, sm: 'auto' },
            zIndex: 9999,
            minWidth: { xs: 'calc(100% - 20px)', sm: 300 },
            maxWidth: { xs: 'calc(100% - 20px)', sm: 500 },
            fontSize: { xs: '0.875rem', sm: '1rem' },
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            position: 'fixed', 
            top: { xs: 10, sm: 20 }, 
            right: { xs: 10, sm: 20 },
            left: { xs: 10, sm: 'auto' },
            zIndex: 9999,
            minWidth: { xs: 'calc(100% - 20px)', sm: 300 },
            maxWidth: { xs: 'calc(100% - 20px)', sm: 500 },
            fontSize: { xs: '0.875rem', sm: '1rem' },
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1.5, sm: 2 }, 
          alignItems: { xs: 'stretch', sm: 'center' }, 
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: 'wrap'
        }}>
          <TextField
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ 
              flex: { xs: '1 1 100%', sm: '0 1 400px' }, 
              minWidth: { xs: '100%', sm: 300 },
              width: { xs: '100%', sm: 'auto' },
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                backgroundColor: '#f9f9f9',
                transition: 'all 0.3s ease',
                border: '1px solid #d0d0d0',
                '&:hover': {
                  backgroundColor: '#fff',
                  borderColor: '#667eea',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                    borderWidth: '2px',
                  },
                },
                '&.Mui-focused': {
                  backgroundColor: '#fff',
                  borderColor: '#667eea',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                    borderWidth: '2px',
                  },
                },
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#d0d0d0',
                borderWidth: '1px',
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#667eea', fontSize: { xs: 20, sm: 24 } }} />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 1.5, sm: 2 }, 
            flex: { xs: '1 1 100%', sm: '0 1 auto' },
            width: { xs: '100%', sm: 'auto' },
            flexWrap: 'wrap'
          }}>
            <FormControl 
              size="small" 
              sx={{ 
                minWidth: { xs: '100%', sm: 150 },
                width: { xs: '100%', sm: 'auto' },
                flex: { xs: '1 1 100%', sm: '0 1 auto' }
              }}
            >
              <InputLabel sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                sx={{
                  borderRadius: 3,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d0d0d0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                  },
                }}
              >
                <MenuItem value="all" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>All</MenuItem>
                <MenuItem value="active" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle sx={{ fontSize: { xs: 16, sm: 18 }, color: '#4caf50' }} />
                    Active
                  </Box>
                </MenuItem>
                <MenuItem value="inactive" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Block sx={{ fontSize: { xs: 16, sm: 18 }, color: '#f44336' }} />
                    Inactive
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl 
              size="small" 
              sx={{ 
                minWidth: { xs: '100%', sm: 180 },
                width: { xs: '100%', sm: 'auto' },
                flex: { xs: '1 1 100%', sm: '0 1 auto' }
              }}
            >
              <InputLabel sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>User Type</InputLabel>
              <Select
                value={businessStatusFilter}
                label="User Type"
                onChange={(e) => setBusinessStatusFilter(e.target.value as 'all' | 'businessOwner' | 'regularUser')}
                sx={{
                  borderRadius: 3,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d0d0d0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                  },
                }}
              >
                <MenuItem value="all" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>All Users</MenuItem>
                <MenuItem value="businessOwner" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Business sx={{ fontSize: { xs: 16, sm: 18 }, color: '#9c27b0' }} />
                    Business Owner
                  </Box>
                </MenuItem>
                <MenuItem value="regularUser" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person sx={{ fontSize: { xs: 16, sm: 18 }, color: '#607d8b' }} />
                    Regular User
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      {/* Desktop Table View */}
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Card>
          <CardContent sx={{ p: 2 }}>
            <TableContainer 
              component={Paper}
              sx={{ 
                overflowX: 'auto',
                '&::-webkit-scrollbar': {
                  height: 8,
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#f1f1f1',
                  borderRadius: 4,
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#c1c1c1',
                  borderRadius: 4,
                  '&:hover': {
                    backgroundColor: '#a8a8a8',
                  },
                },
              }}
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>User</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Phone</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Last Logged</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Business Status</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow 
                      key={user.id}
                      sx={{ 
                        opacity: user.isActive ? 1 : 0.6,
                        backgroundColor: user.isActive ? 'inherit' : 'action.hover'
                      }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Person sx={{ mr: 1, fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{user.fullName || 'N/A'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Email sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{user.email || 'N/A'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Phone sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{user.phoneNumber || 'N/A'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexDirection="column" alignItems="flex-start" gap={0.5}>
                          {user.isActive && !needsDeactivation(user) && (
                            <Chip
                              icon={<CheckCircle />}
                              label="Active"
                              color="success"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                          {!user.isActive && (
                            <Chip
                              icon={<Block />}
                              label="Inactive"
                              color="error"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                          {user.isActive && needsDeactivation(user) && (
                            <Chip
                              label="Needs Deactivation"
                              color="warning"
                              size="small"
                              sx={{ fontSize: '0.7rem', height: '20px' }}
                            />
                          )}
                          {!user.isActive && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              Cannot access app
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <CalendarToday sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.hasBusinessRegistration ? 'Business Owner' : 'Regular User'}
                          color={user.hasBusinessRegistration ? 'primary' : 'default'}
                          size="small"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Button
                            variant="contained"
                            color={user.isActive ? "error" : "success"}
                            size="small"
                            onClick={() => handleToggleUserStatus(user.id, user.email, user.fullName, user.isActive)}
                            startIcon={user.isActive ? <Block /> : <CheckCircle />}
                            sx={{ 
                              fontSize: '0.75rem',
                              px: 1.5,
                              py: 0.5,
                              minWidth: 'auto',
                            }}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="contained"
                            color="warning"
                            size="small"
                            onClick={() => handleArchiveUser(user.id)}
                            startIcon={<Archive />}
                            sx={{ 
                              fontSize: '0.75rem',
                              px: 1.5,
                              py: 0.5,
                              minWidth: 'auto',
                              bgcolor: '#ff9800',
                              '&:hover': {
                                bgcolor: '#f57c00',
                              },
                            }}
                          >
                            Archive
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>

      {/* Mobile Card View */}
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredUsers.map((user) => (
            <Card 
              key={user.id}
              sx={{ 
                opacity: user.isActive ? 1 : 0.6,
                backgroundColor: user.isActive ? 'inherit' : 'action.hover',
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person sx={{ fontSize: 24, color: '#667eea' }} />
                    <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                      {user.fullName || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    {user.isActive && !needsDeactivation(user) && (
                      <Chip
                        icon={<CheckCircle />}
                        label="Active"
                        color="success"
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    )}
                    {!user.isActive && (
                      <Chip
                        icon={<Block />}
                        label="Inactive"
                        color="error"
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    )}
                    {user.isActive && needsDeactivation(user) && (
                      <Chip
                        label="Needs Deactivation"
                        color="warning"
                        size="small"
                        sx={{ fontSize: '0.7rem', height: '20px' }}
                      />
                    )}
                  </Box>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Email sx={{ fontSize: 16, color: '#666' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: '#666' }}>
                      Email
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ fontSize: '0.875rem', ml: 3 }}>
                    {user.email || 'N/A'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Phone sx={{ fontSize: 16, color: '#666' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: '#666' }}>
                      Phone
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ fontSize: '0.875rem', ml: 3 }}>
                    {user.phoneNumber || 'N/A'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CalendarToday sx={{ fontSize: 16, color: '#666' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: '#666' }}>
                      Last Logged
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ fontSize: '0.875rem', ml: 3 }}>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', color: '#666', mb: 1 }}>
                    Business Status
                  </Typography>
                  <Chip
                    label={user.hasBusinessRegistration ? 'Business Owner' : 'Regular User'}
                    color={user.hasBusinessRegistration ? 'primary' : 'default'}
                    size="small"
                    sx={{ fontSize: '0.75rem' }}
                  />
                </Box>

                {!user.isActive && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Cannot access app
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                  <Button
                    variant="contained"
                    color={user.isActive ? "error" : "success"}
                    size="small"
                    onClick={() => handleToggleUserStatus(user.id, user.email, user.fullName, user.isActive)}
                    startIcon={user.isActive ? <Block /> : <CheckCircle />}
                    sx={{ 
                      fontSize: '0.75rem',
                      px: 1.5,
                      py: 0.5,
                      minWidth: 'auto',
                      textTransform: 'none'
                    }}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    onClick={() => handleArchiveUser(user.id)}
                    startIcon={<Archive />}
                    sx={{ 
                      fontSize: '0.75rem',
                      px: 1.5,
                      py: 0.5,
                      minWidth: 'auto',
                      textTransform: 'none',
                      bgcolor: '#ff9800',
                      '&:hover': {
                        bgcolor: '#f57c00',
                      },
                    }}
                  >
                    Archive
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      {/* Deactivation Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onClose={handleCancelDeactivate}>
        <DialogTitle>Confirm Deactivation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate the user account for <strong>{userToDeactivate?.fullName || userToDeactivate?.email}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The user will not be able to access the app until their account is reactivated.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCancelDeactivate} 
            size="small"
            sx={{ 
              minWidth: 'auto',
              px: 2,
              py: 0.75,
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => handleConfirmToggleUserStatus()} 
            color="error" 
            variant="contained" 
            size="small"
            sx={{ 
              minWidth: 'auto',
              px: 2,
              py: 0.75,
              fontSize: '0.875rem',
            }}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 