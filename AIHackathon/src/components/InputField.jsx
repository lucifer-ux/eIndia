import React from 'react';
import './InputField.css';

const InputField = ({
  label,
  type = 'text',
  placeholder,
  icon,
  rightElement,
  value,
  onChange,
  name
}) => {
  return (
    <div className="input-field">
      <div className="input-label-row">
        <label className="input-label">{label}</label>
        {rightElement && (
          <div className="input-right-element">{rightElement}</div>
        )}
      </div>
      <div className="input-wrapper">
        {icon && <div className="input-icon">{icon}</div>}
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="input-control"
        />
      </div>
    </div>
  );
};

export default InputField;