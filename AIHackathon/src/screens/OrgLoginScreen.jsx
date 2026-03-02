import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputField from '../components/InputField';
import SocialLoginButton from '../components/SocialLoginButton';
import Navbar from '../components/Navbar';
import { sellerLoginWithEmail, sellerSignupWithEmail, sellerLoginWithGoogle, resetPassword, loginWithDemoSeller } from '../services/authService';
import './LoginScreen.css';

const OrgLoginScreen = ({ onLoginSuccess, onBackToHome }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        const result = await sellerSignupWithEmail(formData.email, formData.password);
        onLoginSuccess(result.seller || result);
      } else {
        const result = await sellerLoginWithEmail(formData.email, formData.password);
        onLoginSuccess(result.seller || result);
      }
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' ? t('error.noAccount')
        : err.code === 'auth/wrong-password' ? t('error.wrongPassword')
          : err.code === 'auth/email-already-in-use' ? t('error.emailInUse')
            : err.code === 'auth/weak-password' ? t('error.weakPassword')
              : err.code === 'auth/invalid-email' ? t('error.invalidEmail')
                : err.code === 'auth/invalid-credential' ? t('error.invalidCredential')
                  : err.message || t('error.authFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await sellerLoginWithGoogle();
      onLoginSuccess(result.seller || result);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || t('error.googleFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!formData.email) {
      setError(t('login.enterEmailFirst'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(formData.email);
      setResetSent(true);
      setError('');
    } catch (err) {
      setError(err.message || t('error.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithDemoSeller();
      onLoginSuccess(result.seller || result);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
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

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  return (
    <div className="login-screen">
      <Navbar
        logoIcon={<LightningIcon />}
        logoText="eIndia"
        onLoginClick={() => { }}
        onSignupClick={() => { }}
      />

      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
              <BuildingIcon />
            </div>
          </div>

          <h1 className="login-title">{isSignup ? t('orgLogin.createTitle') : t('orgLogin.title')}</h1>
          <p className="login-subtitle">{isSignup ? t('orgLogin.signupSubtitle') : t('orgLogin.subtitle')}</p>

          {error && <div className="login-error">{error}</div>}
          {resetSent && <div className="login-success">{t('login.resetSent')}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <InputField
              label={t('orgLogin.emailLabel')}
              name="email"
              type="email"
              placeholder={t('orgLogin.emailPlaceholder')}
              icon={<EmailIcon />}
              value={formData.email}
              onChange={handleChange}
            />

            <InputField
              label={t('login.passwordLabel')}
              name="password"
              type="password"
              placeholder={t('login.passwordPlaceholder')}
              icon={<LockIcon />}
              rightElement={!isSignup ? <a href="#forgot" className="forgot-password-link" onClick={handleForgotPassword}>{t('login.forgotPassword')}</a> : null}
              value={formData.password}
              onChange={handleChange}
            />

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? t('login.pleaseWait') : (isSignup ? t('login.signUp') : t('login.continue'))}
            </button>
          </form>

          <div className="login-divider">
            <span className="divider-line"></span>
            <span className="divider-text">{t('login.orContinueWith')}</span>
            <span className="divider-line"></span>
          </div>

          <div className="social-login-buttons">
            <SocialLoginButton
              icon={<GoogleIcon />}
              text="Google"
              onClick={handleGoogleLogin}
            />
          </div>

          {!isSignup && (
            <div className="demo-login-section" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', textAlign: 'center' }}>
                🎯 Quick Demo Access
              </p>
              <button 
                type="button"
                className="login-submit-btn"
                onClick={handleDemoLogin}
                disabled={loading}
                style={{ 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  fontSize: '14px',
                  padding: '12px'
                }}
              >
                {loading ? 'Logging in...' : 'Login with Demo Account'}
              </button>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                demo@eindia.com / demo123
              </p>
            </div>
          )}
        </div>

        <p className="login-footer">
          <button className="back-link" onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? t('login.alreadyHaveAccount') : t('login.dontHaveAccount')}
          </button>
          <button className="back-link" onClick={onBackToHome}>
            {t('login.backToHome')}
          </button>
        </p>
      </div>
    </div>
  );
};

export default OrgLoginScreen;