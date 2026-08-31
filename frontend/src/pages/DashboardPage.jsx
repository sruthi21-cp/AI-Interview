import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── Status badge ──────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    created:     { label: 'Created',     cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    completed:   { label: 'Completed',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    cancelled:   { label: 'Cancelled',   cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-slate-700 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

/* ── Stat card ──────────────────────────────────────────── */
function StatCard({ label, value, accent = false }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-slate-400">{label}</h3>
      <p className={`text-3xl font-bold mt-2 ${accent ? 'text-emerald-500' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();

  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  /* ── Fetch interviews on mount ───────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/interviews/');
        setInterviews(data.interviews || []);
      } catch (err) {
        if (err?.response?.status === 401) {
          navigate('/login');
        } else {
          setError('Failed to load your interview sessions.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── Derived stats ───────────────────────────────── */
  const totalInterviews = interviews.length;

  const completedInterviews = interviews.filter((s) => s.status === 'completed');
  const inProgressCount = interviews.filter((s) => s.status === 'in_progress').length;

  // We don't have per-session scores in the list response,
  // so we show the count of completed vs total instead.
  const completionRate =
    totalInterviews > 0
      ? `${Math.round((completedInterviews.length / totalInterviews) * 100)}%`
      : '--';

  /* ── Logout ──────────────────────────────────────── */
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  /* ── Row click handler ──────────────────────────── */
  const handleRowClick = (session) => {
    if (session.status === 'completed') {
      navigate(`/interview/${session.id}/evaluation`);
    } else {
      navigate(`/interview/${session.id}`);
    }
  };

  /* ═══════════ RENDER ═════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Manage and track your mock interview sessions.</p>
        </div>
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="self-start px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* ── Stats ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Interviews" value={totalInterviews} accent />
        <StatCard label="Completion Rate" value={completionRate} accent />
        <StatCard label="In Progress" value={inProgressCount} />
      </div>

      {/* ── Error ──────────────────────────────── */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-6 py-4">
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      {/* ── Sessions table ─────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Interview Sessions</h2>
          <button
            id="btn-new-interview"
            onClick={() => navigate('/interview/setup')}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Interview
          </button>
        </div>

        {interviews.length === 0 ? (
          /* ── Empty state ───────────────────────── */
          <div className="px-8 py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">No interviews yet</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Start your first mock interview to practice and improve your skills.
            </p>
            <button
              onClick={() => navigate('/interview/setup')}
              className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20"
            >
              Start Your First Interview
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        ) : (
          /* ── Table ─────────────────────────────── */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Difficulty</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 text-sm">
                {interviews.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => handleRowClick(session)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-white">{session.job_role}</td>
                    <td className="px-6 py-4">{session.interview_type}</td>
                    <td className="px-6 py-4">{session.difficulty}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                            style={{ width: `${session.question_count > 0 ? (session.answered_count / session.question_count) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {session.answered_count}/{session.question_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(session.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(session);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors"
                      >
                        {session.status === 'completed' ? 'View Results' : session.status === 'in_progress' ? 'Resume' : 'Open'}
                        <span className="ml-1">→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
