import { useState } from 'react';
import './Navbar.css';

const Navbar = ({ logoIcon, logoText, onLoginClick, onSignupClick, showAuthButtons = true, rightElement, navLinks = [] }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleLogin = () => {
    closeMobileMenu();
    onLoginClick?.();
  };

  const handleSignup = () => {
    closeMobileMenu();
    onSignupClick?.();
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo-icon">
            {logoIcon}
          </div>
          <span className="navbar-logo-text">{logoText}</span>
        </div>

        {/* Desktop Navigation Links */}
        {navLinks.length > 0 && (
          <div className="navbar-links desktop-nav">
            {navLinks.map((link, index) => (
              <a key={index} href={link.href || '#'} onClick={link.onClick}>
                {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Desktop Actions */}
      

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMobileMenu} aria-label="Open menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </nav>

      {/* Mobile Navigation Drawer */}
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <span className="mobile-nav-title">Menu</span>
          <button className="mobile-nav-close" onClick={closeMobileMenu} aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="mobile-nav-links">
          {navLinks.map((link, index) => (
            <a 
              key={index} 
              href={link.href || '#'} 
              className="mobile-nav-link"
              onClick={(e) => {
                closeMobileMenu();
                link.onClick?.(e);
              }}
            >
              {link.icon && <span>{link.icon}</span>}
              {link.label}
            </a>
          ))}
        </div>

        {showAuthButtons && (
          <div className="mobile-nav-footer">
            <button className="btn btn-outline btn-full" onClick={handleLogin}>
              Log In
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Navbar;