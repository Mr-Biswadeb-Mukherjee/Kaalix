import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

import Sidebar from '../Components/sidebar';
import StatusBar from '../Components/Status';
import TopBar from '../Components/TopBar';

import { useAuth } from '../Context/AuthContext';
import InactivityModal from '../Components/inactivityModal';

const topbarHeight = 48;

const MainLayout = () => {
  const { logout } = useAuth();

  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(15);

  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Reset timers on user activity
  const resetTimers = () => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    clearInterval(countdownIntervalRef.current);

    setModalOpen(false);
    setCountdown(15);

    // 60s warning -> open modal
    warningTimerRef.current = setTimeout(() => {
      setModalOpen(true);
      setCountdown(15);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 60000); // 60s

    // 75s logout
    logoutTimerRef.current = setTimeout(async () => {
      await logout();
    }, 75000); // 75s
  };

  // Attach user activity listeners
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((event) => window.addEventListener(event, resetTimers));

    resetTimers();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimers));
      clearTimeout(warningTimerRef.current);
      clearTimeout(logoutTimerRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed.toString());
  }, [collapsed]);

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
        }}
      >
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
          >
            <Outlet />
          </Box>
        </Box>

        <TopBar collapsed={collapsed} />
        <StatusBar collapsed={collapsed} />
      </Box>

      {/* Inactivity Modal */}
      <InactivityModal
        open={modalOpen}
        countdown={countdown}
        onStayLoggedIn={resetTimers}
      />
    </>
  );
};

export default MainLayout;
