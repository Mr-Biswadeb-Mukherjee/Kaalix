// Layout/MainLayout.jsx

import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

import Sidebar from '../Components/sidebar';
import StatusBar from '../Components/Status';
import TopBar from '../Components/TopBar';

const topbarHeight = 48;

const MainLayout = () => {
  // Load initial collapsed state from localStorage
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed.toString());
  }, [collapsed]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top navigation bar */}
      <TopBar />

      {/* Sidebar + Main content wrapper */}
      <Box sx={{ display: 'flex', flexGrow: 1, mt: `${topbarHeight}px` }}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

        {/* Main content area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: collapsed ? '64px' : '220px', // Dynamic margin based on sidebar width
            p: 3,
            overflow: 'auto',
            transition: 'margin-left 0.25s ease',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      <TopBar collapsed={collapsed} />
      {/* Status bar fixed at bottom */}
      <StatusBar collapsed={collapsed} />
    </Box>
  );
};

export default MainLayout;
