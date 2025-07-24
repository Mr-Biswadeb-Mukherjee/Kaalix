// Layout/MainLayout.jsx

import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

import Sidebar from '../Components/sidebar';
import StatusBar from '../Components/Status';
import TopBar from '../Components/TopBar';

const topbarHeight = 48;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed.toString());
  }, [collapsed]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
      // Beautiful sectional CSS for MainLayout
      // This ensures the layout takes full viewport height and arranges children vertically
    >
      
      {/* TopBar component, positioned at the very top */}
      {/* It's crucial for global navigation and branding */}
      <TopBar />
      <Box sx={{ display: 'flex', flexGrow: 1, mt: `${topbarHeight}px` }}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: collapsed ? '64px' : '220px',
            p: 3,
            overflow: 'auto',
            transition: 'margin-left 0.25s ease',
          }}
          // Beautiful sectional CSS for the main content area
          // This dynamically adjusts margin based on sidebar state, provides padding, and enables scrolling
        >
          <Outlet />
        </Box>
      </Box>

      {/* TopBar and StatusBar are rendered again, likely for a different purpose or positioning */}
      {/* This might be a mistake or intended for a specific layout pattern (e.g., a bottom bar) */}
      <TopBar collapsed={collapsed} />
      <StatusBar collapsed={collapsed} />
    </Box>
  );
};

export default MainLayout;
