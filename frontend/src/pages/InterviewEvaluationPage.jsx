import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── Score ring (SVG) ─────────────────────────────────────────── */
function ScoreRing({ value, max = 10, size = 100 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / max) * circumference;
  const color = value >= 7 ? '#10b981' : value >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth="8" fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill={color} fontSize="24" fontWeight="700">
        {value}
      </text>
    </svg>
  );
}

/* ── Metric bar ───────────────────────────────────────────────── */
function MetricBar({ label, value, delay = 0 }) {
  const pct = Math.round(value * 100);
  const barColor = pct >= 70
    ? 'from-emerald-500 to-teal-400'
    : pct >= 40
      ? 'from-amber-500 to-yellow-400'
      : 'from-rose-500 to-pink-400';
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-slate-400 font-semibold">{pct}%</span>
      </div>
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all ease-out`}
          style={{ width: `${pct}%`, transitionDuration: '1s', transitionDelay: `${delay}ms` }}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function InterviewEvaluationPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/interviews/${interviewId}/evaluation`);
        setEvalData(data);
      } catch (err) {
        if (err?.response?.status === 404)
          setError('Evaluation not found. Please complete the interview first.');
        else if (err?.response?.status === 401)
          navigate('/login');
        else
          setError('Failed to load evaluation. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [interviewId, navigate]);

  /* ═══════════ RENDER ═══════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading your evaluation…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Evaluation Unavailable</h2>
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

  const d = evalData;
  const scoreColor = d.overall_score >= 7 ? 'text-emerald-400' : d.overall_score >= 4 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* ── Back link ─────────────────────────────── */}
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group">
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* ── Header ────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900/90 via-slate-800/60 to-emerald-900/20 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Interview Complete!</h1>
        <p className="text-slate-400">
          {d.job_role} · {d.interview_type} · {d.difficulty}
        </p>
        <p className="text-slate-500 text-sm">
          {d.answered_count} of {d.question_count} questions answered
        </p>
      </div>

      {/* ── Overall Score + Metrics ───────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-base font-semibold text-white">Overall Performance</h2>
        </div>

        <div className="p-6 space-y-8">
          {/* Score ring centred */}
          <div className="flex flex-col items-center gap-2">
            <ScoreRing value={d.overall_score} />
            <p className={`text-lg font-bold ${scoreColor}`}>
              {d.overall_score} / 10
            </p>
            <p className="text-slate-500 text-xs uppercase tracking-wider">Overall Score</p>
          </div>

          {/* Metric bars */}
          <div className="grid gap-5">
            <MetricBar label="Correctness"      value={d.overall_correctness}            delay={0} />
            <MetricBar label="Relevance"         value={d.overall_relevance}              delay={100} />
            <MetricBar label="Technical Depth"   value={d.overall_technical_depth}        delay={200} />
            <MetricBar label="Communication"     value={d.overall_communication_quality}  delay={300} />
          </div>
        </div>
      </div>

      {/* ── Feedback ──────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-base font-semibold text-white">Final Feedback</h2>
        </div>
        <div className="p-6">
          <p className="text-slate-300 text-sm leading-relaxed">{d.feedback}</p>
        </div>
      </div>

      {/* ── Strengths / Areas to Improve ──────────── */}
      {(d.strengths?.length > 0 || d.weaknesses?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {d.strengths?.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-emerald-400">Strengths</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {d.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.weaknesses?.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-amber-400">Areas to Improve</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {d.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Per-question breakdown ────────────────── */}
      {d.per_question_evaluations?.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <h2 className="text-base font-semibold text-white">Per-Question Breakdown</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {d.per_question_evaluations.map((q, idx) => {
              const qScoreColor = q.score >= 7 ? 'text-emerald-400' : q.score >= 4 ? 'text-amber-400' : 'text-rose-400';
              return (
                <div key={idx} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full flex-shrink-0">
                      Q{idx + 1}
                    </span>
                    <span className="text-slate-400 text-sm truncate">{q.feedback}</span>
                  </div>
                  <span className={`text-lg font-bold ${qScoreColor} flex-shrink-0`}>{q.score}/10</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Actions ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30"
        >
          Back to Dashboard
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
        <button
          onClick={() => navigate('/interview/setup')}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all duration-200"
        >
          Start New Interview
        </button>
      </div>
    </div>
  );
}
