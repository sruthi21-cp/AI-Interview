import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" id="auth-logo" className="text-3xl font-extrabold text-emerald-500 tracking-tight">
          🎙️ AI Interview Simulator
        </Link>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-850 py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
