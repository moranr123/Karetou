import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BusinessApprovals from './pages/BusinessApprovals';
import UserManagement from './pages/UserManagement';
import AdminManagement from './pages/AdminManagement';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Layout from './components/Layout';

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

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
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
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
