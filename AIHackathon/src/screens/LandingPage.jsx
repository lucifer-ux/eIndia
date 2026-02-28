import React from 'react';
   import Navbar from '../components/Navbar';
   import HeroSection from '../components/HeroSection';
   import TrustedBy from '../components/TrustedBy';
   import Footer from '../components/Footer';
   import './LandingPage.css';

   const LandingPage = ({ onLoginAsUser }) => {
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

     const handleLoginOrg = () => {
       console.log('Login as Org clicked');
     };

     const handleLogin = () => {
       console.log('Login clicked');
     };

     const handleSignup = () => {
       console.log('Sign Up clicked');
     };

     return (
       <div className="landing-page">
         <Navbar
           logoIcon={<LightningIcon />}
           logoText="ElectroFind"
           loginText="Login"
           signupText="Sign Up"
           onLoginClick={handleLogin}
           onSignupClick={handleSignup}
         />
         
         <main className="landing-main">
           <HeroSection
             badgeText="AI-DRIVEN DISCOVERY"
             headline="Find the best "
             headlineHighlight="electronics, instantly."
             subtext="Connect with verified organizations and discover AI-driven electronics solutions tailored to your specific needs."
             primaryButton={{
               text: "Login as User",
               icon: <UserIcon />,
               onClick: onLoginAsUser
             }}
             secondaryButton={{
               text: "Login as Org",
               icon: <BuildingIcon />,
               onClick: handleLoginOrg
             }}
           />
           
           <TrustedBy
             title="Trusted by leading tech firms"
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
             { text: 'Privacy Policy', href: '#privacy' },
             { text: 'Terms of Service', href: '#terms' },
             { text: 'Contact Support', href: '#support' }
           ]}
           socialIcons={[
             { icon: <AtIcon />, href: '#twitter' },
             { icon: <BriefcaseIcon />, href: '#linkedin' },
             { icon: <CameraIcon />, href: '#instagram' }
           ]}
           copyrightText="© 2023 ElectroFind. All rights reserved."
         />
       </div>
     );
   };

   export default LandingPage;