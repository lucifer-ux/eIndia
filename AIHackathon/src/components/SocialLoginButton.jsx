import React from 'react';
   import './SocialLoginButton.css';

   const SocialLoginButton = ({
     icon,
     text,
     onClick,
     variant = 'default'
   }) => {
     return (
       <button 
         className={`social-login-btn social-login-${variant}`}
         onClick={onClick}
       >
         {icon && <span className="social-icon">{icon}</span>}
         <span className="social-text">{text}</span>
       </button>
     );
   };

   export default SocialLoginButton;