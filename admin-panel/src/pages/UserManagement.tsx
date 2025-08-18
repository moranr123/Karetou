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
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  Search,
  Edit,
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
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

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditingUser({
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
    });
    setDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      await updateDoc(doc(db, 'users', selectedUser.id), editingUser);
      await fetchUsers();
      setDialogOpen(false);
      setSelectedUser(null);
      setEditingUser({});
      setSuccessMessage('User updated successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    // Show confirmation dialog when deactivating a user
    if (isActive) {
      const confirmed = window.confirm(
        'Are you sure you want to deactivate this user account?\n\n' +
        'Deactivated users will be:\n' +
        '• Unable to access the mobile app\n' +
        '• Unable to create new posts or businesses\n' +
        '• Still visible in the system for record keeping\n\n' +
        'You can reactivate the account at any time.'
      );
      if (!confirmed) return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive: !isActive,
      });
      await fetchUsers();
      
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
      <Typography variant="h4" gutterBottom>
        User Management
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

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Business Status</TableCell>
                  <TableCell>Actions</TableCell>
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
                        <Person sx={{ mr: 1 }} />
                        <Typography variant="body2">{user.fullName || 'N/A'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Email sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2">{user.email || 'N/A'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Phone sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2">{user.phoneNumber || 'N/A'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" alignItems="flex-start">
                        <Chip
                          icon={user.isActive ? <CheckCircle /> : <Block />}
                          label={user.isActive ? 'Active' : 'Inactive'}
                          color={user.isActive ? 'success' : 'error'}
                          size="small"
                        />
                        {!user.isActive && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            Cannot access app
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <CalendarToday sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.hasBusinessRegistration ? 'Business Owner' : 'Regular User'}
                        color={user.hasBusinessRegistration ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={user.isActive}
                              onChange={() => handleToggleUserStatus(user.id, user.isActive)}
                              size="small"
                            />
                          }
                          label=""
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteUser(user.id)}
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
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Full Name"
              value={editingUser.fullName || ''}
              onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Phone Number"
              value={editingUser.phoneNumber || ''}
              onChange={(e) => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveUser} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 