import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

// Helper: pretty-print status with a colored badge
function StatusBadge({ status }) {
  const map = {
    created: { label: 'Created', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    completed: { label: 'Completed', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    cancelled: { label: 'Cancelled', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-slate-700 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

// Single detail row
function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-slate-800/60 last:border-none">
      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-emerald-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-slate-100 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function InterviewRoomPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await api.get(`/interviews/${interviewId}`);
        setInterview(response.data);
      } catch (err) {
        if (err?.response?.status === 404) {
          setError('Interview session not found or you do not have access to it.');
        } else if (err?.response?.status === 401) {
          navigate('/login');
        } else {
          setError('Failed to load interview session. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading interview session…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Session Not Found</h2>
        <p className="text-slate-400 text-sm">{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const formattedDate = interview?.created_at
    ? new Date(interview.created_at).toLocaleString()
    : '—';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back navigation */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
      >
        <svg
          className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Interview Room</h1>
            <StatusBadge status={interview.status} />
          </div>
          <p className="text-slate-400 text-sm">Session ID: <span className="font-mono text-slate-300">#{interview.id}</span></p>
        </div>
      </div>

      {/* Session details card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-base font-semibold text-white">Session Details</h2>
        </div>
        <div className="px-6">
          <DetailRow
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            label="Job Role"
            value={interview.job_role}
          />
          <DetailRow
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            label="Interview Type"
            value={interview.interview_type}
          />
          <DetailRow
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            label="Experience Level"
            value={interview.experience_level}
          />
          <DetailRow
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            label="Difficulty"
            value={interview.difficulty}
          />
          <DetailRow
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Number of Questions"
            value={`${interview.question_count} questions`}
          />
          <DetailRow
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Created At"
            value={formattedDate}
          />
        </div>
      </div>

      {/* Milestone placeholder */}
      <div className="bg-slate-900/60 border border-slate-700/50 border-dashed rounded-2xl px-8 py-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">AI Questions Coming Next</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
            AI interview questions will be implemented in the next milestone. Your session is ready and waiting.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-lg text-xs font-medium text-slate-400 border border-slate-700/50">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Session Foundation Active
        </div>
      </div>
    </div>
  );
}
