import React, { useState } from 'react';
   import InputField from '../components/InputField';
   import SocialLoginButton from '../components/SocialLoginButton';
   import Navbar from '../components/Navbar';
   import './LoginScreen.css';
   
   const LoginScreen = ({ onLoginSuccess, onBackToHome }) => {
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
       
       // Validate credentials
       if (formData.email === 'shashwat1234@gmai.com' && formData.password === '123456') {
         setError('');
         onLoginSuccess();
       } else {
         setError('Invalid email or password');
       }
     };
   
     const handleSocialLogin = (provider) => {
       console.log(`Login with ${provider}`);
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
   
     const LockLogoIcon = () => (
       <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
         <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
         <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
         <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"></circle>
       </svg>
     );
   
     const AppleIcon = () => (
       <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
       </svg>
     );
   
     const GoogleIcon = () => (
       <svg width="18" height="18" viewBox="0 0 24 24">
         <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
         <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
         <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
         <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
       </svg>
     );
   
     const ForgotPasswordLink = () => (
       <a href="#forgot" className="forgot-password-link">Forgot password?</a>
     );
   
     return (
       <div className="login-screen">
         <Navbar
           logoIcon={<LightningIcon />}
           logoText="ElectroFind"
           loginText="Log In"
           signupText="Sign Up"
           onLoginClick={() => {}}
           onSignupClick={() => {}}
         />
         
         <div className="login-container">
           <div className="login-card">
             <div className="login-logo">
               <div className="login-logo-icon">
                 <LockLogoIcon />
               </div>
             </div>
             
             <h1 className="login-title">Welcome Back</h1>
             <p className="login-subtitle">Enter your credentials to access your account</p>
             
             {error && <div className="login-error">{error}</div>}
             
             <form onSubmit={handleSubmit} className="login-form">
               <InputField
                 label="Email Address"
                 name="email"
                 type="email"
                 placeholder="name@example.com"
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
                 rightElement={<ForgotPasswordLink />}
                 value={formData.password}
                 onChange={handleChange}
               />
               
               <button type="submit" className="login-submit-btn">
                 Continue
               </button>
             </form>
             
             <div className="login-divider">
               <span className="divider-line"></span>
               <span className="divider-text">OR CONTINUE WITH</span>
               <span className="divider-line"></span>
             </div>
             
             <div className="social-login-buttons">
               <SocialLoginButton
                 icon={<AppleIcon />}
                 text="Apple"
                 onClick={() => handleSocialLogin('Apple')}
               />
               <SocialLoginButton
                 icon={<GoogleIcon />}
                 text="Google"
                 onClick={() => handleSocialLogin('Google')}
               />
             </div>
           </div>
           
           <p className="login-footer">
             Don't have an account? <a href="#signup" className="signup-link">Sign up</a>
           </p>
         </div>
       </div>
     );
   };
   
   export default LoginScreen;