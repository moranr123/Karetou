import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AdminPanelSettings as AdminIcon,
  Logout,
  Business as BusinessIcon,
  Schedule as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  ExpandLess,
  ExpandMore,
  History as HistoryIcon,
  Inbox,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;
const miniDrawerWidth = 72;

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [drawerHovered, setDrawerHovered] = useState(false);
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);
  const [archiveMenuOpen, setArchiveMenuOpen] = useState(false);
  const { userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLogoutDialogOpen(false);
    }
  };

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false);
  };

  // Define menu items based on user role
  let menuItems = [];
  
  if (userRole?.role === 'superadmin') {
    // Superadmin menu - Dashboard, Admin Management, User Management, History Log, and Archive
    menuItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
      { text: 'Admin Management', icon: <AdminIcon />, path: '/admin-management' },
      { text: 'User Management', icon: <PeopleIcon />, path: '/user-management' },
      { text: 'History Log', icon: <HistoryIcon />, path: '/superadmin-history-log' },
    ];
  } else {
    // Regular admin menu - Dashboard only
    menuItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    ];
  }

  const businessSubItems = [
    { text: 'Business Applications', icon: <PendingIcon />, path: '/business/pending' },
    { text: 'Registered Business', icon: <ApprovedIcon />, path: '/business/approved' },
    { text: 'Archived Business', icon: <RejectedIcon />, path: '/business/rejected' },
  ];

  const archiveSubItems = [
    { text: 'Users', icon: <PeopleIcon />, path: '/archive?tab=user', tab: 'user' },
    { text: 'Admins', icon: <AdminIcon />, path: '/archive?tab=admin', tab: 'admin' },
  ];

  const isExpanded = drawerHovered;
  const isMobileDrawer = window.innerWidth < 600; // Check if mobile
  const showText = isMobileDrawer || isExpanded; // Show text on mobile or when hovered on desktop

  // Auto-expand Business menu if on a business route
  React.useEffect(() => {
    if (location.pathname.startsWith('/business')) {
      setBusinessMenuOpen(true);
    }
  }, [location.pathname]);

  // Auto-expand Business menu on mobile when drawer opens
  React.useEffect(() => {
    if (mobileOpen && window.innerWidth < 600) {
      setBusinessMenuOpen(true);
    }
  }, [mobileOpen]);

  // Auto-expand Archive menu if on archive route
  React.useEffect(() => {
    if (location.pathname === '/archive') {
      setArchiveMenuOpen(true);
    }
  }, [location.pathname]);

  // Auto-expand Archive menu on mobile when drawer opens
  React.useEffect(() => {
    if (mobileOpen && window.innerWidth < 600 && location.pathname === '/archive') {
      setArchiveMenuOpen(true);
    }
  }, [mobileOpen, location.pathname]);

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#1a1a2e',
        color: '#fff',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 2,
          minHeight: '80px !important',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Karetou Logo"
            sx={{
              width: 40,
              height: 40,
              objectFit: 'contain',
            }}
          />
          {showText && (
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                fontWeight: 'bold',
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Karetou
            </Typography>
          )}
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
      <List sx={{ flex: 1, pt: 2, px: 1 }}>
        {menuItems.map((item) => (
          <Tooltip key={item.text} title={!isExpanded ? item.text : ''} placement="right" arrow>
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  minHeight: 48,
                  justifyContent: isExpanded ? 'initial' : 'center',
                  px: 2.5,
                  '&.Mui-selected': {
                    bgcolor: '#667eea',
                    '&:hover': {
                      bgcolor: '#5568d3',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(102, 126, 234, 0.1)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: isExpanded ? 2 : 'auto',
                    justifyContent: 'center',
                    color: location.pathname === item.path ? '#fff' : '#a0a0b0',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {showText && (
                  <ListItemText
                    primary={item.text}
                    sx={{
                      opacity: 1,
                      '& .MuiTypography-root': {
                        fontWeight: location.pathname === item.path ? 600 : 400,
                      },
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          </Tooltip>
        ))}
        
        {/* Business menu item with sub-items (only for regular admins) */}
        {userRole?.role !== 'superadmin' && (
          <>
            <Tooltip title={!isExpanded ? 'Business' : ''} placement="right" arrow>
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  selected={location.pathname.startsWith('/business')}
                  onClick={() => {
                    // On mobile, always expand the menu when clicking Business
                    if (window.innerWidth < 600) {
                      setBusinessMenuOpen(!businessMenuOpen);
                    } else if (isExpanded) {
                      setBusinessMenuOpen(!businessMenuOpen);
                    } else {
                      navigate('/business/pending');
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    minHeight: 48,
                    justifyContent: isExpanded ? 'initial' : 'center',
                    px: 2.5,
                    '&.Mui-selected': {
                      bgcolor: '#667eea',
                      '&:hover': {
                        bgcolor: '#5568d3',
                      },
                    },
                    '&:hover': {
                      bgcolor: 'rgba(102, 126, 234, 0.1)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: isExpanded ? 2 : 'auto',
                      justifyContent: 'center',
                      color: location.pathname.startsWith('/business') ? '#fff' : '#a0a0b0',
                    }}
                  >
                    <BusinessIcon />
                  </ListItemIcon>
                  {showText && (
                    <>
                      <ListItemText
                        primary="Business"
                        sx={{
                          opacity: 1,
                          '& .MuiTypography-root': {
                            fontWeight: location.pathname.startsWith('/business') ? 600 : 400,
                          },
                        }}
                      />
                      {businessMenuOpen ? <ExpandLess /> : <ExpandMore />}
                    </>
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>
            
            {/* Business sub-items */}
            <Collapse in={businessMenuOpen && showText} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {businessSubItems.map((subItem) => (
                  <ListItem key={subItem.text} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      selected={location.pathname === subItem.path}
                      onClick={() => navigate(subItem.path)}
                      sx={{
                        borderRadius: 2,
                        minHeight: 40,
                        pl: 5,
                        '&.Mui-selected': {
                          bgcolor: 'rgba(102, 126, 234, 0.7)',
                          '&:hover': {
                            bgcolor: 'rgba(102, 126, 234, 0.6)',
                          },
                        },
                        '&:hover': {
                          bgcolor: 'rgba(102, 126, 234, 0.05)',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: 2,
                          justifyContent: 'center',
                          color: location.pathname === subItem.path ? '#fff' : '#a0a0b0',
                        }}
                      >
                        {subItem.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={subItem.text}
                        sx={{
                          '& .MuiTypography-root': {
                            fontSize: '0.9rem',
                            fontWeight: location.pathname === subItem.path ? 600 : 400,
                          },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        )}

        {/* Archive menu item with sub-items (only for superadmin) */}
        {userRole?.role === 'superadmin' && (
          <>
            <Tooltip title={!isExpanded ? 'Archive' : ''} placement="right" arrow>
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  selected={location.pathname === '/archive'}
                  onClick={() => {
                    // On mobile, always expand the menu when clicking Archive
                    if (window.innerWidth < 600) {
                      setArchiveMenuOpen(!archiveMenuOpen);
                    } else if (isExpanded) {
                      setArchiveMenuOpen(!archiveMenuOpen);
                    } else {
                      navigate('/archive?tab=user');
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    minHeight: 48,
                    justifyContent: isExpanded ? 'initial' : 'center',
                    px: 2.5,
                    '&.Mui-selected': {
                      bgcolor: '#667eea',
                      '&:hover': {
                        bgcolor: '#5568d3',
                      },
                    },
                    '&:hover': {
                      bgcolor: 'rgba(102, 126, 234, 0.1)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: isExpanded ? 2 : 'auto',
                      justifyContent: 'center',
                      color: location.pathname === '/archive' ? '#fff' : '#a0a0b0',
                    }}
                  >
                    <Inbox />
                  </ListItemIcon>
                  {showText && (
                    <>
                      <ListItemText
                        primary="Archive"
                        sx={{
                          opacity: 1,
                          '& .MuiTypography-root': {
                            fontWeight: location.pathname === '/archive' ? 600 : 400,
                          },
                        }}
                      />
                      {archiveMenuOpen ? <ExpandLess /> : <ExpandMore />}
                    </>
                  )}
                </ListItemButton>
              </ListItem>
            </Tooltip>
            
            {/* Archive sub-items */}
            <Collapse in={archiveMenuOpen && showText} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {archiveSubItems.map((subItem) => (
                  <ListItem key={subItem.text} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      selected={location.pathname === '/archive' && location.search.includes(`tab=${subItem.tab}`)}
                      onClick={() => navigate(subItem.path)}
                      sx={{
                        borderRadius: 2,
                        minHeight: 40,
                        pl: 5,
                        '&.Mui-selected': {
                          bgcolor: 'rgba(102, 126, 234, 0.7)',
                          '&:hover': {
                            bgcolor: 'rgba(102, 126, 234, 0.6)',
                          },
                        },
                        '&:hover': {
                          bgcolor: 'rgba(102, 126, 234, 0.05)',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: 2,
                          justifyContent: 'center',
                          color: location.pathname === '/archive' && location.search.includes(`tab=${subItem.tab}`) ? '#fff' : '#a0a0b0',
                        }}
                      >
                        {subItem.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={subItem.text}
                        sx={{
                          '& .MuiTypography-root': {
                            fontSize: '0.9rem',
                            fontWeight: location.pathname === '/archive' && location.search.includes(`tab=${subItem.tab}`) ? 600 : 400,
                          },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        )}

        {/* History Log menu item (only for regular admins, below Business) */}
        {userRole?.role !== 'superadmin' && (
          <Tooltip title={!isExpanded ? 'History Log' : ''} placement="right" arrow>
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={location.pathname === '/history-log'}
                onClick={() => navigate('/history-log')}
                sx={{
                  borderRadius: 2,
                  minHeight: 48,
                  justifyContent: isExpanded ? 'initial' : 'center',
                  px: 2.5,
                  '&.Mui-selected': {
                    bgcolor: '#667eea',
                    '&:hover': {
                      bgcolor: '#5568d3',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(102, 126, 234, 0.1)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: isExpanded ? 2 : 'auto',
                    justifyContent: 'center',
                    color: location.pathname === '/history-log' ? '#fff' : '#a0a0b0',
                  }}
                >
                  <HistoryIcon />
                </ListItemIcon>
                {showText && (
                  <ListItemText
                    primary="History Log"
                    sx={{
                      opacity: 1,
                      '& .MuiTypography-root': {
                        fontWeight: location.pathname === '/history-log' ? 600 : 400,
                      },
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          </Tooltip>
        )}
      </List>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
      <List sx={{ px: 1, pb: 2 }}>
        <Tooltip title={!isExpanded ? 'Logout' : ''} placement="right" arrow>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogoutClick}
              sx={{
                borderRadius: 2,
                minHeight: 48,
                justifyContent: isExpanded ? 'initial' : 'center',
                px: 2.5,
                color: '#ff6b6b',
                '&:hover': {
                  bgcolor: 'rgba(255, 107, 107, 0.1)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isExpanded ? 2 : 'auto',
                  justifyContent: 'center',
                  color: '#ff6b6b',
                }}
              >
                <Logout />
              </ListItemIcon>
              {showText && <ListItemText primary="Logout" />}
            </ListItemButton>
          </ListItem>
        </Tooltip>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Mobile App Bar */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          display: { xs: 'flex', sm: 'none' },
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: '#1a1a2e',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Karetou Logo"
            sx={{
              width: 32,
              height: 32,
              objectFit: 'contain',
            }}
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Karetou
          </Typography>
        </Box>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
        >
          <MenuIcon />
        </IconButton>
      </Box>

      <Box
        component="nav"
        sx={{ 
          width: { 
            xs: 0,
            sm: isExpanded ? drawerWidth : miniDrawerWidth 
          }, 
          flexShrink: { sm: 0 },
          transition: 'width 0.3s',
        }}
      >
        <Drawer
          variant="temporary"
          anchor="right"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              bgcolor: '#1a1a2e',
              color: '#fff',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: isExpanded ? drawerWidth : miniDrawerWidth,
              transition: 'width 0.3s',
              overflowX: 'hidden',
              bgcolor: '#1a1a2e',
            },
          }}
          open
          onMouseEnter={() => setDrawerHovered(true)}
          onMouseLeave={() => setDrawerHovered(false)}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          pt: { xs: 8, sm: 3 }, // Add top padding for mobile app bar
          width: { 
            xs: '100%',
            sm: `calc(100% - ${isExpanded ? drawerWidth : miniDrawerWidth}px)` 
          },
          transition: 'width 0.3s',
          bgcolor: '#f5f5f5',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutDialogOpen} onClose={handleLogoutCancel}>
        <DialogTitle>Confirm Logout</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to logout from the Admin Panel?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogoutCancel}>Cancel</Button>
          <Button onClick={handleLogoutConfirm} color="error" variant="contained">
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Layout; 