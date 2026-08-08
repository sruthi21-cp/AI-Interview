import React from 'react';

export default function Button({ children, id, onClick, type = 'button', variant = 'primary', disabled = false }) {
  const baseStyle = "px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50";
  const variants = {
    primary: "text-white bg-emerald-600 hover:bg-emerald-500",
    secondary: "text-slate-350 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white"
  };

  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}
