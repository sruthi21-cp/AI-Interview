import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" id="nav-logo" className="text-xl font-bold tracking-tight text-emerald-500 hover:text-emerald-400 transition-colors">
            🎙️ AI Interview Simulator
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/" id="nav-home" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">Home</Link>
            <Link to="/dashboard" id="nav-dashboard" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">Dashboard</Link>
            <Link to="/profile" id="nav-profile" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">Profile</Link>
            <Link to="/login" id="nav-login" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors bg-slate-850 rounded-lg hover:bg-slate-800 border border-slate-700/50">Log In</Link>
            <Link to="/register" id="nav-register" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20">Sign Up</Link>
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} AI Interview Simulator. All rights reserved.</p>
      </footer>
    </div>
  );
}
