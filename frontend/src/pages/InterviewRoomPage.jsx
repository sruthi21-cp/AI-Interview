import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── Status badge ─────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    created:     { label: 'Created',     cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    completed:   { label: 'Completed',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    cancelled:   { label: 'Cancelled',   cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-slate-700 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

/* ── Progress bar ─────────────────────────────────────────────── */
function ProgressBar({ current, total }) {
  const pct = Math.min((current / total) * 100, 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-400">
        <span>Question {current} of {total}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Score ring (SVG) ─────────────────────────────────────────── */
function ScoreRing({ value, max = 10, size = 80 }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / max) * circumference;
  const color = value >= 7 ? '#10b981' : value >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth="6" fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill={color} fontSize="18" fontWeight="700">
        {value}
      </text>
    </svg>
  );
}

/* ── Metric bar ───────────────────────────────────────────────── */
function MetricBar({ label, value }) {
  const pct = Math.round(value * 100);
  const barColor = pct >= 70
    ? 'from-emerald-500 to-teal-400'
    : pct >= 40
      ? 'from-amber-500 to-yellow-400'
      : 'from-rose-500 to-pink-400';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function InterviewRoomPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  /* session metadata */
  const [interview, setInterview] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  /* question / answer flow */
  const [question, setQuestion]             = useState(null);
  const [answer, setAnswer]                 = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [evaluation, setEvaluation]         = useState(null);
  const [fetchingQuestion, setFetchingQuestion] = useState(false);
  const [apiError, setApiError]             = useState('');

  /* progress tracking */
  const [questionNumber, setQuestionNumber] = useState(1);
  const [isComplete, setIsComplete]         = useState(false);
  const [evaluations, setEvaluations]       = useState([]);

  /* ── Load session details ────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/interviews/${interviewId}`);
        setInterview(data);
        if (data.status === 'completed') setIsComplete(true);
      } catch (err) {
        if (err?.response?.status === 404)
          setError('Interview session not found or you do not have access.');
        else if (err?.response?.status === 401)
          navigate('/login');
        else
          setError('Failed to load interview session. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [interviewId, navigate]);

  /* ── Fetch next question ─────────────────────────────────── */
  const fetchNextQuestion = useCallback(async () => {
    setFetchingQuestion(true);
    setApiError('');
    try {
      const { data } = await api.get(`/interviews/${interviewId}/next`);
      setQuestion(data.question);
      setEvaluation(null);
      setAnswer('');
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to fetch next question.';
      setApiError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setFetchingQuestion(false);
    }
  }, [interviewId]);

  useEffect(() => {
    if (interview && !question && !isComplete) fetchNextQuestion();
  }, [interview, question, isComplete, fetchNextQuestion]);

  /* ── Submit answer ───────────────────────────────────────── */
  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setApiError('');
    try {
      const { data } = await api.post(`/interviews/${interviewId}/answer`, { answer });
      const evalData = data.evaluation;
      // Store evaluation for final summary
      setEvaluations((prev) => [...prev, { questionNumber, questionText: question?.text, evalData }]);
      // If final question, navigate to final evaluation page
      if (questionNumber >= (interview?.question_count || 0)) {
        navigate(`/interview/${interviewId}/evaluation`);
      } else {
        // Proceed to next question
        setQuestionNumber((prev) => prev + 1);
        setQuestion(null);
        setAnswer('');
        setEvaluation(null);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to submit answer.';
      setApiError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };



  /* ═══════════ RENDER ═══════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading interview session…</p>
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

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* ── Back link ─────────────────────────────── */}
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group">
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* ── Header ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Interview Room</h1>
            <StatusBadge status={isComplete ? 'completed' : interview.status} />
          </div>
          <p className="text-slate-400 text-sm">
            {interview.job_role} · {interview.interview_type} · {interview.difficulty}
          </p>
        </div>
      </div>

      {/* ── Progress ──────────────────────────────── */}
      {!isComplete && (
        <ProgressBar current={questionNumber} total={interview.question_count} />
      )}

      {/* ── API error ─────────────────────────────── */}
      {apiError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-6 py-4">
          <p className="text-rose-400 text-sm">{apiError}</p>
        </div>
      )}



      {/* ── LOADING QUESTION ──────────────────────── */}
      {!isComplete && fetchingQuestion && !question && (
        <div className="bg-slate-900/60 border border-slate-700/50 border-dashed rounded-2xl px-8 py-12 text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Generating question…</p>
        </div>
      )}

      {/* ── QUESTION + ANSWER ─────────────────────── */}
      {!isComplete && question && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Question {questionNumber}</h2>
            <span className="text-xs text-slate-500">{interview.interview_type} · {interview.difficulty}</span>
          </div>

          <div className="p-6 space-y-6">
            <p className="text-slate-200 text-lg leading-relaxed">{question.text}</p>

            <form onSubmit={handleSubmitAnswer} className="space-y-4">
              <div className="relative">
                <textarea
                  id="answer-input"
                  className="w-full min-h-[160px] p-4 rounded-xl bg-slate-800/80 text-slate-100 border border-slate-700 placeholder-slate-500 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="Type your answer here…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={submitting}
                  required
                />
                <span className="absolute bottom-3 right-3 text-xs text-slate-600">{answer.length} chars</span>
              </div>

              <div className="flex justify-end">
                <button
                  id="btn-submit-answer"
                  type="submit"
                  disabled={submitting || !answer.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Evaluating…
                    </>
                  ) : (
                    <>
                      Submit Answer
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
