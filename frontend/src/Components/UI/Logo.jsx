// Logo.jsx

// Importing necessary assets and styles
import logo from '../../assets/LOGO/logo_512.png';
import './Styles/Logo.css'; 

// Logo component definition
const Logo = ({ alt = 'Kaalix Logo', className = '', size, style = {}, ...props }) => {
  const inlineSize = size
    ? { width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }
    : {};

  return (
    <img
      src={logo}
      alt={alt}
      className={`kaalix-logo-component ${className}`}
      style={{ ...inlineSize, ...style }}
      {...props}
    />
  );
};

// Exporting the Logo component as default
export default Logo;
