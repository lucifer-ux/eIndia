import React from 'react';
import './Footer.css';

const Footer = ({
  logoIcon,
  companyName,
  links,
  socialIcons,
  copyrightText
}) => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo-icon">{logoIcon}</div>
          <span className="footer-company-name">{companyName}</span>
        </div>
        <nav className="footer-links">
          {links.map((link, index) => (
            <a key={index} href={link.href} className="footer-link">
              {link.text}
            </a>
          ))}
        </nav>
        <div className="footer-social">
          {socialIcons.map((icon, index) => (
            <a key={index} href={icon.href} className="social-icon">
              {icon.icon}
            </a>
          ))}
        </div>
      </div>
      <div className="footer-copyright">
        {copyrightText}
      </div>
    </footer>
  );
};

export default Footer;