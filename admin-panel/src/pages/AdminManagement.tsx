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
  Alert,
} from '@mui/material';
import {
  Search,
  Archive,
  AdminPanelSettings,
  Email,
  CheckCircle,
  Block,
  Add,
  CalendarToday,
  Inbox,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, adminCreationAuth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../utils/activityLogger';

interface AdminUser {
  id: string;
  uid: string;
  email: string;
  role: 'admin';
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  lastLogin?: string;
}

interface NewAdminData {
  email: string;
  password: string;
  confirmPassword: string;
}

const AdminManagement: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [adminToDeactivate, setAdminToDeactivate] = useState<{ id: string; email: string; isActive: boolean } | null>(null);
  const [newAdminData, setNewAdminData] = useState<NewAdminData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { userRole } = useAuth();

  const needsDeactivation = (admin: AdminUser): boolean => {
    if (!admin.lastLogin) {
      // If no lastLogin (logout time) recorded, don't show needs deactivation
      return false;
    }
    const lastLogoutDate = new Date(admin.lastLogin); // lastLogin now stores logout time
    const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
    return minutesSinceLogout > 1;
  };

  useEffect(() => {
    fetchAdmins();
  }, []);


  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'adminUsers'));
      const querySnapshot = await getDocs(q);
      const adminData: AdminUser[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'admin') {
          adminData.push({
            id: doc.id,
            uid: data.uid || '',
            email: data.email || '',
            role: 'admin',
            isActive: data.isActive || false,
            createdAt: data.createdAt || new Date().toISOString(),
            createdBy: data.createdBy || '',
            lastLogin: data.lastLogin || undefined,
          } as AdminUser);
        }
      });
      
      setAdmins(adminData);
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (newAdminData.password !== newAdminData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newAdminData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccessMessage('');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('You must be logged in to create admin accounts');
        setProcessing(false);
        return;
      }

      const currentUserUid = currentUser.uid;

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
      const newAdmin: AdminUser = {
        id: userCredential.user.uid,
        uid: userCredential.user.uid,
        email: adminData.email,
        role: 'admin',
        isActive: adminData.isActive,
        createdAt: adminData.createdAt,
        createdBy: adminData.createdBy,
        lastLogin: undefined,
      };

      // Add new admin to the list without refetching
      setAdmins(prevAdmins => [...prevAdmins, newAdmin]);

      setNewAdminData({ email: '', password: '', confirmPassword: '' });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setDialogOpen(false);
      
      setSuccessMessage(`Admin account created successfully for ${createdEmail}`);
      
      setTimeout(() => setSuccessMessage(''), 5000);
      
    } catch (error: any) {
      console.error('Error creating admin:', error);
      setError(error.message || 'Failed to create admin account');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleAdminStatus = (adminId: string, email: string, isActive: boolean) => {
    // Show confirmation dialog only when deactivating
    if (isActive) {
      setAdminToDeactivate({ id: adminId, email, isActive });
      setDeactivateDialogOpen(true);
    } else {
      // Reactivate directly without confirmation
      handleConfirmToggleAdminStatus(adminId, isActive);
    }
  };

  const handleConfirmToggleAdminStatus = async (adminId?: string, isActive?: boolean) => {
    const adminIdToUpdate = adminId || adminToDeactivate?.id;
    const isActiveStatus = isActive !== undefined ? isActive : adminToDeactivate?.isActive;
    const adminEmail = adminToDeactivate?.email || admins.find(a => a.id === adminIdToUpdate)?.email || '';
    
    if (!adminIdToUpdate || isActiveStatus === undefined) return;

    try {
      await updateDoc(doc(db, 'adminUsers', adminIdToUpdate), {
        isActive: !isActiveStatus,
      });
      
      // Log activity
      if (userRole) {
        const activityType = isActiveStatus ? 'admin_deactivated' : 'admin_activated';
        await logActivity({
          type: activityType,
          title: isActiveStatus ? 'Admin Account Deactivated' : 'Admin Account Activated',
          description: `Admin account ${isActiveStatus ? 'deactivated' : 'activated'} for ${adminEmail}`,
          performedBy: {
            uid: userRole.uid,
            email: userRole.email,
            role: userRole.role,
          },
          targetId: adminIdToUpdate,
          targetType: 'admin',
          metadata: { email: adminEmail, isActive: !isActiveStatus },
        });
      }
      
      // Update local state instead of refetching
      setAdmins(prevAdmins => 
        prevAdmins.map(admin => 
          admin.id === adminIdToUpdate 
            ? { ...admin, isActive: !isActiveStatus }
            : admin
        )
      );
      
      if (isActiveStatus) {
        setSuccessMessage('Admin account has been deactivated. They will be signed out immediately.');
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setSuccessMessage('Admin account has been reactivated. They can now log in.');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error updating admin status:', error);
      setError('Failed to update admin status. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeactivateDialogOpen(false);
      setAdminToDeactivate(null);
    }
  };

  const handleCancelDeactivate = () => {
    setDeactivateDialogOpen(false);
    setAdminToDeactivate(null);
  };

  const handleArchiveAdmin = async (adminId: string) => {
    const adminToArchive = admins.find(a => a.id === adminId);
    if (!adminToArchive) return;

    if (window.confirm('Are you sure you want to archive this admin account? You can restore them later from the Archive page.')) {
      try {
        const adminRef = doc(db, 'adminUsers', adminId);
        const adminDocSnap = await getDoc(adminRef);
        
        if (adminDocSnap.exists()) {
          const adminData = adminDocSnap.data();
          // Move to archived collection
          await addDoc(collection(db, 'archivedAdmins'), {
            ...adminData,
            archivedAt: new Date().toISOString(),
            originalId: adminId,
            type: 'admin',
          });
          // Delete from adminUsers collection
          await deleteDoc(adminRef);
        }
        
        // Log activity
        if (userRole) {
          await logActivity({
            type: 'admin_deleted',
            title: 'Admin Account Archived',
            description: `Admin account archived for ${adminToArchive.email}`,
            performedBy: {
              uid: userRole.uid,
              email: userRole.email,
              role: userRole.role,
            },
            targetId: adminId,
            targetType: 'admin',
            metadata: { email: adminToArchive.email },
          });
        }
        
        await fetchAdmins();
        setSuccessMessage('Admin archived successfully');
        setTimeout(() => setSuccessMessage(''), 5000);
      } catch (error) {
        console.error('Error archiving admin:', error);
        setError('Failed to archive admin');
        setTimeout(() => setError(''), 5000);
      }
    }
  };

  const filteredAdmins = admins.filter((admin) => {
    // Filter by search term
    const email = admin.email?.toLowerCase() || '';
    const searchMatch = email.includes(searchTerm.toLowerCase());

    return searchMatch;
  });

  // Show loading first
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={3}
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={{ xs: 2, sm: 0 }}
      >
        <Typography variant="h4" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Admin Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
          sx={{ 
            minWidth: { xs: 'auto', sm: '140px' },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Create Admin
        </Button>
      </Box>

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

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
        <TextField
          placeholder="Search admins by email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ 
            flex: { xs: '1 1 100%', sm: '0 1 400px' }, 
            minWidth: { xs: '100%', sm: 300 },
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
                <Search sx={{ color: '#667eea' }} />
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
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Admin</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Last Logged</TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Inbox sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
                          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                            No admins found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {searchTerm
                              ? 'Try adjusting your search criteria.'
                              : 'No admin accounts have been created yet.'}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <TableRow 
                        key={admin.id}
                        sx={{ 
                          opacity: admin.isActive ? 1 : 0.6,
                          backgroundColor: admin.isActive ? 'inherit' : 'action.hover'
                        }}
                      >
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <AdminPanelSettings sx={{ mr: 1, fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Admin</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Email sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{admin.email || 'N/A'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexDirection="column" alignItems="flex-start" gap={0.5}>
                          {admin.isActive && !needsDeactivation(admin) && (
                            <Chip
                              icon={<CheckCircle />}
                              label="Active"
                              color="success"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                          {!admin.isActive && (
                            <Chip
                              icon={<Block />}
                              label="Inactive"
                              color="error"
                              size="small"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                          {admin.isActive && needsDeactivation(admin) && (
                            <Chip
                              label="Needs Deactivation"
                              color="warning"
                              size="small"
                              sx={{ fontSize: '0.7rem', height: '20px' }}
                            />
                          )}
                          {!admin.isActive && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              Cannot log in
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <CalendarToday sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Button
                            variant="contained"
                            color={admin.isActive ? "error" : "success"}
                            size="small"
                            onClick={() => handleToggleAdminStatus(admin.id, admin.email, admin.isActive)}
                            startIcon={admin.isActive ? <Block /> : <CheckCircle />}
                            sx={{ 
                              fontSize: '0.75rem',
                              px: 1.5,
                              py: 0.5,
                              minWidth: 'auto',
                            }}
                          >
                            {admin.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="contained"
                            color="warning"
                            size="small"
                            onClick={() => handleArchiveAdmin(admin.id)}
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
                  ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>

      {/* Mobile Card View */}
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        {filteredAdmins.length === 0 ? (
          <Card>
            <CardContent sx={{ py: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Inbox sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                  No admins found
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {searchTerm
                    ? 'Try adjusting your search criteria.'
                    : 'No admin accounts have been created yet.'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredAdmins.map((admin) => (
            <Card 
              key={admin.id}
              sx={{ 
                opacity: admin.isActive ? 1 : 0.6,
                backgroundColor: admin.isActive ? 'inherit' : 'action.hover',
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AdminPanelSettings sx={{ fontSize: 24, color: '#667eea' }} />
                    <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                      Admin
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    {admin.isActive && !needsDeactivation(admin) && (
                      <Chip
                        icon={<CheckCircle />}
                        label="Active"
                        color="success"
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    )}
                    {!admin.isActive && (
                      <Chip
                        icon={<Block />}
                        label="Inactive"
                        color="error"
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    )}
                    {admin.isActive && needsDeactivation(admin) && (
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
                    {admin.email || 'N/A'}
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
                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}
                  </Typography>
                </Box>

                {!admin.isActive && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Cannot log in
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                  <Button
                    variant="contained"
                    color={admin.isActive ? "error" : "success"}
                    size="small"
                    onClick={() => handleToggleAdminStatus(admin.id, admin.email, admin.isActive)}
                    startIcon={admin.isActive ? <Block /> : <CheckCircle />}
                    sx={{ 
                      fontSize: '0.75rem',
                      px: 1.5,
                      py: 0.5,
                      minWidth: 'auto',
                      textTransform: 'none'
                    }}
                  >
                    {admin.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    onClick={() => handleArchiveAdmin(admin.id)}
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
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => {
        setDialogOpen(false);
        setShowPassword(false);
        setShowConfirmPassword(false);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Admin Account</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleCreateAdmin(); }} sx={{ pt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
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

      {/* Deactivation Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onClose={handleCancelDeactivate}>
        <DialogTitle>Confirm Deactivation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate the admin account for <strong>{adminToDeactivate?.email}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The admin will be signed out immediately and will not be able to log in until reactivated.
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
            onClick={() => handleConfirmToggleAdminStatus()} 
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

export default AdminManagement; 