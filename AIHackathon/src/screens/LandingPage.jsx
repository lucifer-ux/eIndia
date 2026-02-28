import React from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import TrustedBy from '../components/TrustedBy';
import Footer from '../components/Footer';
import LanguageSelector from '../components/LanguageSelector';
import './LandingPage.css';

const LandingPage = ({ onLoginAsUser, onLoginAsOrg }) => {
  const { t } = useTranslation();
  // Icons as SVG components
  const LightningIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );

  const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  const BuildingIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  const AtIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
    </svg>
  );

  const BriefcaseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  );

  const CameraIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  );

  return (
    <div className="landing-page">
      <Navbar
        logoIcon={<LightningIcon />}
        logoText="ElectroFind"
        showAuthButtons={false}
        rightElement={<LanguageSelector />}
      />

      <main className="landing-main">
        <HeroSection
          badgeText={t('hero.badge')}
          headline={t('hero.headline')}
          headlineHighlight={t('hero.highlight')}
          subtext={t('hero.subtext')}
          primaryButton={{
            text: t('hero.loginUser'),
            icon: <UserIcon />,
            onClick: onLoginAsUser
          }}
          secondaryButton={{
            text: t('hero.loginOrg'),
            icon: <BuildingIcon />,
            onClick: onLoginAsOrg
          }}
        />

        <TrustedBy
          title={t('trusted.title')}
          companies={[
            { logo: <div style={{ width: 80, height: 24, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }} /> },
            { logo: <div style={{ width: 80, height: 24, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }} /> },
            { logo: <div style={{ width: 80, height: 24, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }} /> }
          ]}
        />
      </main>

      <Footer
        logoIcon={<LightningIcon />}
        companyName="ElectroFind Inc."
        links={[
          { text: t('footer.privacy'), href: '#privacy' },
          { text: t('footer.terms'), href: '#terms' },
          { text: t('footer.support'), href: '#support' }
        ]}
        socialIcons={[
          { icon: <AtIcon />, href: '#twitter' },
          { icon: <BriefcaseIcon />, href: '#linkedin' },
          { icon: <CameraIcon />, href: '#instagram' }
        ]}
        copyrightText={t('footer.copyright')}
      />
    </div>
  );
};

export default LandingPage;