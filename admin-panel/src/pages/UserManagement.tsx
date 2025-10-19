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
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search,
  Delete,
  Person,
  Email,
  Phone,
  CalendarToday,
  CheckCircle,
  Block,
} from '@mui/icons-material';
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const userData: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        userData.push({
          id: doc.id,
          email: data.email || '',
          fullName: data.fullName || '',
          phoneNumber: data.phoneNumber || '',
          createdAt: data.createdAt || new Date().toISOString(),
          hasBusinessRegistration: data.hasBusinessRegistration || false,
          businessId: data.businessId || undefined,
          isActive: data.isActive !== undefined ? data.isActive : true, // Default to active for existing users
        } as User);
      });
      
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive: !isActive,
      });
      
      // Update local state instead of refetching
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, isActive: !isActive }
            : user
        )
      );
      
      if (isActive) {
        setSuccessMessage('User account has been deactivated.');
      } else {
        setSuccessMessage('User account has been reactivated.');
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status. Please try again.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        await fetchUsers();
        setSuccessMessage('User deleted successfully');
        setTimeout(() => setSuccessMessage(''), 5000);
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
        setTimeout(() => setError(''), 5000);
      }
    }
  };

  const filteredUsers = users.filter((user) =>
    (user.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

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
            top: 20, 
            right: 20, 
            zIndex: 9999,
            minWidth: 300,
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
            top: 20, 
            right: 20, 
            zIndex: 9999,
            minWidth: 300,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search users by name or email..."
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
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Joined</TableCell>
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
                        <Box display="flex" flexDirection="column" alignItems="flex-start">
                          <Chip
                            icon={user.isActive ? <CheckCircle /> : <Block />}
                            label={user.isActive ? 'Active' : 'Inactive'}
                            color={user.isActive ? 'success' : 'error'}
                            size="small"
                            sx={{ fontSize: '0.75rem' }}
                          />
                          {!user.isActive && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                              Cannot access app
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <CalendarToday sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
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
                            onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                            startIcon={user.isActive ? <Block /> : <CheckCircle />}
                            sx={{ fontSize: '0.875rem' }}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleDeleteUser(user.id)}
                            startIcon={<Delete />}
                            sx={{ fontSize: '0.875rem' }}
                          >
                            Delete
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
                  <Chip
                    icon={user.isActive ? <CheckCircle /> : <Block />}
                    label={user.isActive ? 'Active' : 'Inactive'}
                    color={user.isActive ? 'success' : 'error'}
                    size="small"
                    sx={{ fontSize: '0.75rem' }}
                  />
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
                      Joined
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ fontSize: '0.875rem', ml: 3 }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
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
                    onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                    startIcon={user.isActive ? <Block /> : <CheckCircle />}
                    sx={{ 
                      fontSize: '0.875rem',
                      py: 1,
                      textTransform: 'none'
                    }}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleDeleteUser(user.id)}
                    startIcon={<Delete />}
                    sx={{ 
                      fontSize: '0.875rem',
                      py: 1,
                      textTransform: 'none'
                    }}
                  >
                    Delete
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

    </Box>
  );
};

export default UserManagement; 