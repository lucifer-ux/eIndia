import './Navbar.css';

const Navbar = ({ logoIcon, logoText, onLoginClick, onSignupClick, showAuthButtons = true, rightElement }) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-icon">
          {logoIcon}
        </div>
        <span className="navbar-logo">{logoText}</span>
      </div>
      <div className="navbar-actions">
        {rightElement}
        {showAuthButtons && (
          <>
            <button className="btn btn-ghost" onClick={onLoginClick}>
              Log In
            </button>
            <button className="btn btn-primary" onClick={onSignupClick}>
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;