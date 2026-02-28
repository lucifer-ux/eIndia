import React from 'react';
import './TrustedBy.css';

const TrustedBy = ({
  title,
  companies
}) => {
  return (
    <section className="trusted-by">
      <div className="trusted-divider">
        <span className="divider-line"></span>
        <span className="trusted-title">{title}</span>
        <span className="divider-line"></span>
      </div>
      <div className="trusted-companies">
        {companies.map((company, index) => (
          <div key={index} className="company-logo">
            {company.logo}
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustedBy;