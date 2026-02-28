import React from 'react';
import './Navbar.css';

const Navbar = ({ 
  logoIcon, 
  logoText, 
  loginText = 'Login', 
  signupText = 'Sign Up',
  onLoginClick,
  onSignupClick 
}) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo-icon">
          {logoIcon}
        </div>
        <span className="navbar-logo-text">{logoText}</span>
      </div>
      <div className="navbar-actions">
        <button className="btn btn-outline" onClick={onLoginClick}>
          {loginText}
        </button>
        <button className="btn btn-primary" onClick={onSignupClick}>
          {signupText}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;