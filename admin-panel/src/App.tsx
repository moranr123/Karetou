import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BusinessApprovals = lazy(() => import('./pages/BusinessApprovals'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
  },
});

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  if (userRole?.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const DashboardSelector: React.FC = () => {
  const { userRole } = useAuth();
  if (userRole?.role === 'superadmin') return <SuperAdminDashboard />;
  return <Dashboard />;
};

const LoadingFallback: React.FC = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
    <CircularProgress />
  </Box>
);

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<DashboardSelector />} />
                <Route path="business-approvals" element={<BusinessApprovals />} />
                <Route path="business/pending" element={<BusinessApprovals tab="pending" />} />
                <Route path="business/approved" element={<BusinessApprovals tab="approved" />} />
                <Route path="business/rejected" element={<BusinessApprovals tab="rejected" />} />
                <Route 
                  path="user-management" 
                  element={
                    <SuperAdminRoute>
                      <UserManagement />
                    </SuperAdminRoute>
                  } 
                />
                <Route 
                  path="admin-management" 
                  element={
                    <SuperAdminRoute>
                      <AdminManagement />
                    </SuperAdminRoute>
                  } 
                />
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
