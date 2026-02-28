import React from 'react';
import './HeroSection.css';

const HeroSection = ({
  badgeText,
  headline,
  headlineHighlight,
  subtext,
  primaryButton,
  secondaryButton
}) => {
  return (
    <section className="hero-section">
      {badgeText && (
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          {badgeText}
        </div>
      )}
      <h1 className="hero-headline">
        {headline}
        <span className="hero-headline-highlight">{headlineHighlight}</span>
      </h1>
      <p className="hero-subtext">{subtext}</p>
      <div className="hero-buttons">
        {primaryButton && (
          <button className="btn-hero btn-hero-primary" onClick={primaryButton.onClick}>
            <span className="btn-icon">{primaryButton.icon}</span>
            {primaryButton.text}
          </button>
        )}
        {secondaryButton && (
          <button className="btn-hero btn-hero-secondary" onClick={secondaryButton.onClick}>
            <span className="btn-icon">{secondaryButton.icon}</span>
            {secondaryButton.text}
          </button>
        )}
      </div>
    </section>
  );
};

export default HeroSection;