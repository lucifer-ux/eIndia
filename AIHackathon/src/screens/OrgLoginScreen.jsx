import React, { useState } from 'react';
import InputField from '../components/InputField';
import Navbar from '../components/Navbar';
import './LoginScreen.css';

const OrgLoginScreen = ({ onLoginSuccess, onBackToHome }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate org credentials
    if (formData.email === 'org@electrofind.com' && formData.password === 'org123') {
      setError('');
      onLoginSuccess();
    } else {
      setError('Invalid organization credentials');
    }
  };

  // Icons
  const LightningIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );

  const EmailIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
    </svg>
  );

  const LockIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  );

  const BuildingIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <path d="M9 22v-4h6v4"></path>
      <path d="M8 6h.01"></path>
      <path d="M16 6h.01"></path>
      <path d="M8 10h.01"></path>
      <path d="M16 10h.01"></path>
      <path d="M8 14h.01"></path>
      <path d="M16 14h.01"></path>
    </svg>
  );

  return (
    <div className="login-screen">
      <Navbar
        logoIcon={<LightningIcon />}
        logoText="ElectroFind"
        onLoginClick={() => {}}
        onSignupClick={() => {}}
      />
      
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
              <BuildingIcon />
            </div>
          </div>
          
          <h1 className="login-title">Organization Login</h1>
          <p className="login-subtitle">Access your organization's dashboard</p>
          
          {error && <div className="login-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="login-form">
            <InputField
              label="Organization Email"
              name="email"
              type="email"
              placeholder="org@company.com"
              icon={<EmailIcon />}
              value={formData.email}
              onChange={handleChange}
            />
            
            <InputField
              label="Password"
              name="password"
              type="password"
              placeholder="Enter your password"
              icon={<LockIcon />}
              value={formData.password}
              onChange={handleChange}
            />
            
            <button type="submit" className="login-submit-btn">
              Continue
            </button>
          </form>
        </div>
        
        <p className="login-footer">
          <button className="back-link" onClick={onBackToHome}>
            ← Back to Home
          </button>
        </p>
      </div>
    </div>
  );
};

export default OrgLoginScreen;