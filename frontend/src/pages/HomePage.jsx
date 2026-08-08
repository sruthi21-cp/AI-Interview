import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 lg:py-20 max-w-4xl mx-auto">
      <div className="space-y-4">
        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold text-emerald-450 bg-emerald-400/10 rounded-full border border-emerald-500/20">
          Project MVP Foundation
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-450 bg-clip-text text-transparent">
          Master Your Next Interview with AI
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mt-6">
          Practice interactive mock interviews tailored to your target roles. Get real-time feedback and detailed insights to land your dream job.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          to="/register"
          id="btn-get-started"
          className="px-8 py-3 text-base font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-all hover:scale-105 duration-200 shadow-lg shadow-emerald-600/30"
        >
          Get Started
        </Link>
        <Link
          to="/login"
          id="btn-view-demo"
          className="px-8 py-3 text-base font-semibold text-slate-350 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-all hover:scale-105 duration-200 hover:text-white"
        >
          Sign In
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full">
        <div className="p-6 bg-slate-900/40 border border-slate-850 rounded-xl text-left hover:border-slate-800 transition-colors">
          <div className="text-3xl mb-3">💬</div>
          <h3 className="text-lg font-bold text-slate-100">Realistic Simulator</h3>
          <p className="text-sm text-slate-400 mt-2">Simulate real technical or behavioral interviews with adaptive question models.</p>
        </div>
        <div className="p-6 bg-slate-900/40 border border-slate-850 rounded-xl text-left hover:border-slate-800 transition-colors">
          <div className="text-3xl mb-3">📈</div>
          <h3 className="text-lg font-bold text-slate-100">Instant Feedback</h3>
          <p className="text-sm text-slate-400 mt-2">Get evaluation on communication, correctness, and speed to improve immediately.</p>
        </div>
        <div className="p-6 bg-slate-900/40 border border-slate-850 rounded-xl text-left hover:border-slate-800 transition-colors">
          <div className="text-3xl mb-3">🛡️</div>
          <h3 className="text-lg font-bold text-slate-100">Clean & Secure</h3>
          <p className="text-sm text-slate-400 mt-2">Built with FastAPI and JWT token security to store and track your session progress safely.</p>
        </div>
      </div>
    </div>
  );
}
