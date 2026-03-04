// Sidebar.jsx

// Importing React Router DOM hooks for navigation
import { Link, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import ListAltIcon from '@mui/icons-material/ListAlt';
import InfoIcon from '@mui/icons-material/Info';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import RuleIcon from '@mui/icons-material/Rule';
import HubIcon from '@mui/icons-material/Hub';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import './Styles/sidebar.css';
import Logo from '../UI/Logo'
import { useAuth } from '../../Context/AuthContext';


// ----------------------------------------------------------------------------------------------------
// Sidebar Component
// Renders a collapsible sidebar navigation for the application.
// Props:
// - collapsed: A boolean indicating whether the sidebar is collapsed.
// - setCollapsed: A function to toggle the collapsed state of the sidebar.
// ----------------------------------------------------------------------------------------------------


const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation();
  const { onboardingRequired, isSuperAdmin } = useAuth();
  const menuItems = [
    { name: 'Dashboard', icon: <DashboardIcon />, route: '/dashboard' },
    { name: 'Threat Intel', icon: <ManageSearchIcon />, route: '/threat-intel' },
    { name: 'Data Sources', icon: <StorageIcon />, route: '/data-sources' },
    { name: 'Detection Rules', icon: <RuleIcon />, route: '/detection-rules' },
    { name: 'Integrations', icon: <HubIcon />, route: '/integrations' },
    { name: 'Log Forwarder', icon: <SyncAltIcon />, route: '/log-forwarder' },
    ...(isSuperAdmin
      ? [{ name: 'Org Admins', icon: <AdminPanelSettingsIcon />, route: '/organization-admins' }]
      : []),
    { name: 'About Us', icon: <InfoIcon />, route: '/about' },
    { name: 'Documentation', icon: <MenuBookIcon />, route: '/docs' },
  ];

  // Function to toggle the sidebar's collapsed state
  const toggleSidebar = () => {
    setCollapsed(prev => !prev);
  };
  return (
    <div className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo-fixed">
        <Logo />
        {!collapsed && <span className="sidebar-logo-text">KAALIX</span>}
      </div>

      {/* Sidebar Toggle Button (Burger Icon) */}
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        <div className={`burger ${collapsed ? '' : 'open'}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      {/* Main Navigation Menu */}
      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <Link
            to={onboardingRequired ? "/profile" : item.route}
            key={item.name}
            className={`sidebar-item ${location.pathname === item.route ? 'active' : ''} ${onboardingRequired ? 'disabled' : ''}`}
            data-tooltip={collapsed ? item.name : ''}
            onClick={(event) => {
              if (onboardingRequired) {
                event.preventDefault();
                return;
              }
            }}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-label">{item.name}</span>}
          </Link>
        ))}
      </nav> 
      {/* End of Main Navigation Menu */}
      
      {/* Bottom Section: Settings Link */}
      <div className="sidebar-bottom">
        <Link
          to={onboardingRequired ? "/profile" : "/logs"}
          className={`sidebar-item ${location.pathname === '/logs' ? 'active' : ''} ${onboardingRequired ? 'disabled' : ''}`}
          data-tooltip={collapsed ? 'Logs' : ''}
          onClick={(event) => {
            if (onboardingRequired) {
              event.preventDefault();
              return;
            }
          }}
        >
          <span className="sidebar-icon"><ListAltIcon /></span>
          {!collapsed && <span className="sidebar-label">Logs</span>}
        </Link>
      </div>
    </div>
  ); // End of Sidebar Container
};
export default Sidebar;
