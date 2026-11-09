import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useSpeechRecognition, { VOICE_STATES } from '../hooks/useSpeechRecognition';
import useMicPermission from '../hooks/useMicPermission';
import useQuestionNarration from '../hooks/useQuestionNarration';
import { DEFAULT_INTERVIEW_DURATION_SECONDS } from '../config';
import { StatusBadge } from '../components/Badge';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import {
  IconMic,
  IconMicOff,
  IconTimer,
  IconArrowRight,
  IconArrowLeft,
  IconSparkles,
  IconVolumeUp,
  IconVolumeOff,
  IconRefresh,
} from '../components/Icons';

/* ── Format mm:ss timer ─────────────────────────────────────── */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* ── Mic Permission Banner ───────────────────────────────────── */
function MicPermissionBanner({ status, isSecureContext, onRequest }) {
  if (status === 'granted') {
    return (
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <IconMic className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-medium">Microphone is active and ready for voice answers.</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Voice Enabled
        </span>
      </div>
    );
  }

  if (status === 'insecure-context' || !isSecureContext) {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return (
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <IconMicOff className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-200">Secure Context Required for Voice</p>
            <p className="text-amber-300/80">
              Web browsers require a Secure Context (HTTPS or localhost) to access the microphone. You can type your answer below, or open this interview via localhost for voice input.
            </p>
          </div>
        </div>
        {!isLocalhost && typeof window !== 'undefined' && (
          <a
            href={`${window.location.protocol}//localhost:${window.location.port}${window.location.pathname}`}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 flex-shrink-0 self-end sm:self-center"
          >
            <span>Open in Localhost</span>
            <IconArrowRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <IconMicOff className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">Microphone Access Currently Blocked</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-300 border border-slate-600/40">
                Text Mode Active
              </span>
            </div>
            <p className="text-slate-400">
              To record voice answers, allow microphone in your address bar (click the lock/settings icon → Allow), then click Allow / Test Mic. You can also type your answer below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className="px-3.5 py-1.5 rounded-lg bg-primary-600/20 border border-primary-500/30 text-primary-300 hover:bg-primary-600/30 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 flex-shrink-0 self-end sm:self-center"
        >
          <IconRefresh className="w-3.5 h-3.5" />
          <span>Allow / Test Mic</span>
        </button>
      </div>
    );
  }

  if (status === 'prompt') {
    return (
      <div className="p-3 bg-primary-950/40 border border-primary-500/30 rounded-xl text-xs text-primary-200 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <IconMic className="w-4 h-4 text-accent-cyan flex-shrink-0" />
          <span>Microphone is available. Click Allow Mic to enable voice answers, or start recording below.</span>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className="px-3.5 py-1.5 rounded-lg bg-primary-600/30 border border-primary-500/40 text-accent-cyan font-semibold text-xs hover:bg-primary-600/40 transition-colors flex-shrink-0"
        >
          Allow Mic
        </button>
      </div>
    );
  }

  return null;
}

/* ── Voice Control Panel ─────────────────────────────────────── */
function VoiceControlPanel({
  isContinuousActive,
  isListening,
  interimText,
  recordingSeconds,
  isSupported,
  isSecureContext,
  error,
  lowQualityWarning,
  onStart,
  onStop,
}) {
  if (!isSupported) {
    return (
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
        <IconMicOff className="w-4 h-4 flex-shrink-0" />
        <span>Voice speech recognition is not supported in this browser. Please use Chrome or Edge for voice answers.</span>
      </div>
    );
  }

  if (!isSecureContext) {
    return (
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconMicOff className="w-4 h-4 flex-shrink-0" />
          <span>Voice recording requires a Secure Context (HTTPS or localhost).</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active Continuous Voice Mode */}
      {isContinuousActive ? (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shadow-lg space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {/* Pulsing Green Indicator */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Continuous Voice Active</span>
                <span className="font-mono font-bold text-emerald-200">{formatTime(recordingSeconds)}</span>
              </div>

              {/* Animated audio wave bars */}
              <div className="flex items-center gap-1 h-4">
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-3" />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-4" />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-2" />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-4" />
                <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-3" />
              </div>
            </div>

            {/* Stop Voice Recording Button */}
            <button
              type="button"
              id="btn-stop-recording"
              onClick={onStop}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold border border-rose-500/50 shadow-md transition-all"
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-white" />
              <span>Stop Voice Recording</span>
            </button>
          </div>

          {/* Live interim text preview */}
          {interimText && (
            <div className="p-2.5 rounded-lg bg-black/40 border border-emerald-500/20 text-xs text-accent-cyan italic flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse flex-shrink-0" />
              <span className="truncate">"{interimText}"</span>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Microphone listening automatically across questions. Speak your answer, or edit the transcript below at any time.
          </p>
        </div>
      ) : (
        /* Stopped Voice Recording Mode */
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Voice Recording Stopped</span>
            </div>
            <span className="text-slate-400 text-xs hidden sm:inline">
              Click Start Voice Recording to enable hands-free voice answering for all questions.
            </span>
          </div>

          <button
            type="button"
            id="btn-start-recording"
            onClick={onStart}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all"
          >
            <IconMic className="w-3.5 h-3.5" />
            <span>Start Voice Recording</span>
          </button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0 mt-1" />
          <span>{error}</span>
        </div>
      )}

      {/* Low-quality warning (non-blocking) */}
      {lowQualityWarning && !error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
          <span>{lowQualityWarning}</span>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function InterviewRoomPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  /* session metadata */
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* question / answer flow */
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fetchingQuestion, setFetchingQuestion] = useState(false);
  const [apiError, setApiError] = useState('');

  /* progress tracking */
  const [questionNumber, setQuestionNumber] = useState(1);
  const [remainingTime, setRemainingTime] = useState(DEFAULT_INTERVIEW_DURATION_SECONDS);
  const timerRef = useRef(null);
  const timerInitialized = useRef(false);
  const [isComplete, setIsComplete] = useState(false);

  /* Mic permission */
  const { status: micPermissionStatus, isSecureContext, requestPermission } = useMicPermission();

  /* Question TTS narration */
  const {
    isSupported: isNarrationSupported,
    isNarrationEnabled,
    isSpeaking: isQuestionSpeaking,
    toggleNarration,
    replay: replayQuestionNarration,
    stop: stopQuestionNarration,
  } = useQuestionNarration(question?.text);

  /* Voice recognition */
  const handleTranscript = useCallback(({ fullText }) => {
    if (fullText !== undefined) {
      setAnswer(fullText);
    }
  }, []);

  const {
    voiceState,
    isSupported: isSpeechSupported,
    isListening,
    isProcessing,
    isContinuousActive,
    interimText,
    recordingSeconds,
    error: speechError,
    lowQualityWarning,
    startContinuousVoice,
    stopContinuousVoice,
    toggleContinuousVoice,
    resetQuestionTranscript,
    syncEditedAnswer,
  } = useSpeechRecognition({
    onTranscript: handleTranscript,
    lang: interview?.interview_language || 'English',
  });

  /* Handle global continuous voice toggle */
  const handleToggleGlobalVoice = async () => {
    if (isContinuousActive) {
      stopContinuousVoice();
    } else {
      if (isQuestionSpeaking) stopQuestionNarration();
      if (micPermissionStatus !== 'granted') {
        const res = await requestPermission();
        if (!res?.success && res?.error === 'insecure-context') {
          return;
        }
      }
      startContinuousVoice(answer);
    }
  };

  /* Handle voice start */
  const handleStartVoice = async () => {
    if (isQuestionSpeaking) stopQuestionNarration();
    if (micPermissionStatus !== 'granted') {
      const res = await requestPermission();
      if (!res?.success && res?.error === 'insecure-context') {
        return;
      }
    }
    startContinuousVoice(answer);
  };

  /* Handle voice stop */
  const handleStopVoice = () => {
    stopContinuousVoice();
  };

  /* Submit current answer */
  const submitCurrentAnswer = async () => {
    const answerToSubmit = answer.trim();
    if (!answerToSubmit || submitting) return;
    setSubmitting(true);
    setApiError('');

    if (isQuestionSpeaking) stopQuestionNarration();

    // Prepare transcript buffer for next question so any immediate speech is cleanly attributed to Question N+1
    resetQuestionTranscript();
    setAnswer('');

    try {
      await api.post(`/interviews/${interviewId}/answer`, { answer: answerToSubmit });
      if (questionNumber >= (interview?.question_count || 0)) {
        stopContinuousVoice();
        navigate(`/interview/${interviewId}/evaluation`);
      } else {
        setQuestionNumber((prev) => prev + 1);
        setQuestion(null);
      }
    } catch (err) {
      // Restore answer on failure so candidate doesn't lose text
      setAnswer(answerToSubmit);
      syncEditedAnswer(answerToSubmit);
      let detailMsg = 'Failed to submit answer.';
      if (err?.code === 'ECONNABORTED' || err?.message?.toLowerCase().includes('timeout')) {
        detailMsg = 'Evaluation request timed out while generating your AI feedback. Your answer is preserved. Please click "Retry Submission" to try again.';
      } else if (!err?.response) {
        detailMsg = 'Network connection to backend server failed. Please verify the backend service is running and click "Retry Submission".';
      } else if (err.response.data?.detail) {
        const d = err.response.data.detail;
        if (typeof d === 'string') {
          detailMsg = d;
        } else if (Array.isArray(d)) {
          detailMsg = d.map((item) => item.msg || JSON.stringify(item)).join('; ');
        } else {
          detailMsg = JSON.stringify(d);
        }
      } else if (err.response.status === 404) {
        detailMsg = 'Interview session not found or you do not have permission to access it.';
      } else if (err.response.status >= 500) {
        detailMsg = `Server error (${err.response.status}) occurred during evaluation. Your answer is preserved. Please click "Retry Submission".`;
      }
      setApiError(detailMsg);
    } finally {
      setSubmitting(false);
    }
  };

  /* Load session details */
  useEffect(() => {
    if (!interviewId) {
      setError('Invalid interview session ID.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/interviews/${interviewId}`);
        if (!data) {
          setError('Interview session data is empty.');
        } else {
          setInterview(data);
          setQuestionNumber((data.answered_count || 0) + 1);
          if (data.status === 'completed') setIsComplete(true);
        }
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

  /* Timer effect */
  useEffect(() => {
    if (!interview || isComplete) return;
    if (timerInitialized.current) return;
    timerInitialized.current = true;
    setRemainingTime(DEFAULT_INTERVIEW_DURATION_SECONDS);

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          stopContinuousVoice();
          if (answer.trim()) {
            submitCurrentAnswer();
          } else {
            navigate(`/interview/${interviewId}/evaluation`);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [interview, isComplete, answer, interviewId, navigate, stopContinuousVoice]);

  /* Unmount cleanup */
  useEffect(() => {
    return () => {
      stopContinuousVoice();
      stopQuestionNarration();
    };
  }, [stopContinuousVoice, stopQuestionNarration]);

  /* Fetch next question */
  const fetchNextQuestion = useCallback(async () => {
    if (!interviewId) return;
    setFetchingQuestion(true);
    setApiError('');
    try {
      const { data } = await api.get(`/interviews/${interviewId}/next`);
      if (data && data.question) {
        setQuestion(data.question);
      } else {
        setApiError('No question data returned from backend.');
      }
      setAnswer('');
      resetQuestionTranscript();
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to fetch next question.';
      setApiError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setFetchingQuestion(false);
    }
  }, [interviewId, resetQuestionTranscript]);

  useEffect(() => {
    if (interview && !question && !isComplete) fetchNextQuestion();
  }, [interview, question, isComplete, fetchNextQuestion]);

  const handleSubmitAnswer = (e) => {
    e.preventDefault();
    submitCurrentAnswer();
  };

  /* ── Render States ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
        <p className="text-slate-400 text-sm">Initializing AI Interview Studio...</p>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-4">
        <GlassCard className="space-y-4 p-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <IconArrowLeft className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Session Unavailable</h2>
          <p className="text-slate-400 text-xs">{error || 'Unable to load interview session context.'}</p>
          <Button onClick={() => navigate('/dashboard')} variant="primary">
            Return to Dashboard
          </Button>
        </GlassCard>
      </div>
    );
  }

  const questionCount = interview?.question_count || 1;
  const progressPercentage = Math.min((questionNumber / questionCount) * 100, 100);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            stopContinuousVoice();
            stopQuestionNarration();
            navigate('/dashboard');
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group self-start"
        >
          <IconArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Exit to Dashboard</span>
        </button>

        {/* Global Continuous Voice Toggle + Mic Status + Live Timer Pill */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Global Microphone Toggle Button */}
          {isSpeechSupported ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-global-voice-toggle"
                onClick={handleToggleGlobalVoice}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm ${
                  isContinuousActive
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                }`}
                title={
                  isContinuousActive
                    ? 'Click to stop continuous voice recording'
                    : 'Click to start continuous voice recording for the entire session'
                }
              >
                {isContinuousActive ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
                    <span>Stop Voice Recording</span>
                  </>
                ) : (
                  <>
                    <IconMic className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Start Voice Recording</span>
                  </>
                )}
              </button>

              {/* Status Badge Indicator */}
              <div
                id="mic-status-indicator"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border backdrop-blur-md transition-colors ${
                  isContinuousActive
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isContinuousActive ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                  }`}
                />
                <span>
                  {isContinuousActive
                    ? 'Continuous Voice Mode Active'
                    : 'Voice Recording Stopped'}
                </span>

                {/* Animated audio sound bars while capturing speech */}
                {isContinuousActive && isListening && (
                  <div className="flex items-center gap-0.5 ml-1 h-3">
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-2" />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-3" />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-1.5" />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-3" />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse h-2" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-400">
              <IconMicOff className="w-3.5 h-3.5" />
              <span>Voice Not Supported</span>
            </div>
          )}

          {/* Live Timer Pill */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold border backdrop-blur-md ${
              remainingTime <= 60
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
                : 'bg-primary-600/15 border-primary-500/30 text-primary-300'
            }`}
          >
            <IconTimer className="w-4 h-4" />
            <span>{formatTime(remainingTime)}</span>
          </div>
          <StatusBadge status={isComplete ? 'completed' : (interview?.status || 'in_progress')} />
        </div>
      </div>

      {/* Session Context Bar */}
      <GlassCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-cyan flex items-center justify-center text-white shadow-glow-primary">
            <IconSparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">{interview?.job_role || 'Software Engineer'}</h2>
            <p className="text-[11px] text-slate-400">
              {interview?.interview_type || 'Technical'} Domain · {interview?.difficulty || 'Medium'} Difficulty
            </p>
          </div>
        </div>

        {/* Question Counter Progress */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-slate-400">
              <span>Question {questionNumber} of {questionCount}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-cyan rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Mic Permission Banner (proactive) */}
      <MicPermissionBanner
        status={micPermissionStatus}
        isSecureContext={isSecureContext}
        onRequest={requestPermission}
      />

      {/* API Error Display */}
      {apiError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0 mt-1" />
            <div className="space-y-0.5">
              <p className="font-semibold text-rose-200">Submission Alert</p>
              <p className="text-rose-300/90">{apiError}</p>
            </div>
          </div>
          {answer.trim() && (
            <button
              type="button"
              onClick={submitCurrentAnswer}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 self-end sm:self-center flex-shrink-0"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              <span>Retry Submission</span>
            </button>
          )}
        </div>
      )}

      {/* Loading Question Placeholder */}
      {!isComplete && fetchingQuestion && !question && (
        <GlassCard className="p-12 text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">AI is tailoring your next question...</p>
        </GlassCard>
      )}

      {/* Fallback Question Retry Card */}
      {!isComplete && !fetchingQuestion && !question && (
        <GlassCard className="p-12 text-center space-y-4">
          <h3 className="text-base font-bold text-white">No Question Available</h3>
          <p className="text-xs text-slate-400">Click below to fetch your next interview question.</p>
          <Button onClick={fetchNextQuestion} variant="primary">
            Load Question
          </Button>
        </GlassCard>
      )}

      {/* Main Question & Answer Card */}
      {!isComplete && question && (
        <GlassCard className="space-y-6 border-primary-500/20 shadow-glow-primary/10 p-6 sm:p-8">
          {/* Question Display Header */}
          <div className="space-y-4 border-b border-white/[0.08] pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider bg-primary-600/20 text-primary-300 border border-primary-500/30">
                  Question #{questionNumber}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {interview?.interview_type || 'Technical'}
                </span>
                {question?.metadata?.current_difficulty && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${question.metadata.current_difficulty.toLowerCase() === 'hard'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : question.metadata.current_difficulty.toLowerCase() === 'easy'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}>
                    {question.metadata.current_difficulty}
                  </span>
                )}
                {question?.metadata?.topic && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-slate-300 border border-white/10">
                    {question.metadata.topic}
                  </span>
                )}
              </div>

              {/* ── QUESTION VOICE NARRATION CONTROL BAR ── */}
              {isNarrationSupported ? (
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      {isQuestionSpeaking ? (
                        <IconVolumeUp className="w-4 h-4 text-accent-cyan animate-pulse" />
                      ) : (
                        <IconVolumeUp className="w-4 h-4 text-slate-400" />
                      )}
                      <span>Read Aloud</span>
                    </span>

                    <button
                      type="button"
                      onClick={toggleNarration}
                      aria-label="Read interview questions aloud"
                      title={isNarrationEnabled ? 'Turn narration OFF' : 'Turn narration ON'}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 ${isNarrationEnabled ? 'bg-primary-600' : 'bg-slate-700'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isNarrationEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                    <span className="text-[11px] font-mono font-bold text-slate-300 w-7">
                      {isNarrationEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  {isNarrationEnabled && (
                    <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                      {isQuestionSpeaking ? (
                        <span className="text-xs font-semibold text-accent-cyan flex items-center gap-1.5 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-accent-cyan" />
                          Speaking...
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={replayQuestionNarration}
                          aria-label="Replay current question"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-600/20 text-primary-300 border border-primary-500/30 hover:bg-primary-600/30 transition-colors"
                        >
                          <IconRefresh className="w-3.5 h-3.5" />
                          <span>Replay</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  Voice narration is not supported in this browser.
                </span>
              )}
            </div>

            {/* Question Text */}
            <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed tracking-tight">
              {question.text}
            </h3>
          </div>

          {/* Answer Area Form */}
          <form onSubmit={handleSubmitAnswer} className="space-y-5">
            {/* Voice Control Panel */}
            <div className="space-y-3">
              <VoiceControlPanel
                isContinuousActive={isContinuousActive}
                isListening={isListening}
                isProcessing={isProcessing}
                recordingSeconds={recordingSeconds}
                interimText={interimText}
                error={speechError}
                lowQualityWarning={lowQualityWarning}
                isSupported={isSpeechSupported}
                isSecureContext={isSecureContext}
                onRequestPermission={requestPermission}
                onStart={handleStartVoice}
                onStop={handleStopVoice}
              />
            </div>

            {/* Transcript / Text Answer Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <label
                  htmlFor="answer-input"
                  className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]"
                >
                  {isContinuousActive
                    ? 'Live Voice Transcript & Answer (Editable)'
                    : 'Your Answer'}
                </label>
                <span className="font-mono">{answer.length} characters</span>
              </div>

              <div className="relative">
                <textarea
                  id="answer-input"
                  required
                  disabled={submitting}
                  rows={6}
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    syncEditedAnswer(e.target.value);
                  }}
                  placeholder={
                    isContinuousActive
                      ? 'Listening continuously... speak your answer clearly, or type/edit here directly.'
                      : 'Type your answer here, or click "Start Voice Recording" to answer by voice...'
                  }
                  className={`w-full p-4 rounded-xl glass-input text-sm leading-relaxed placeholder-slate-500 resize-y transition-all ${
                    isContinuousActive
                      ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : ''
                  }`}
                />
                {/* Live listening indicator overlay */}
                {isContinuousActive && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>CONTINUOUS MIC ON</span>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-400">
                {isContinuousActive
                  ? 'Continuous voice is ON — your microphone stays active for the next question automatically.'
                  : 'You can submit your typed response, or turn on voice recording at any time.'}
              </span>

              <Button
                id="btn-submit-answer"
                type="submit"
                loading={submitting}
                disabled={!answer.trim() || submitting}
                icon={IconArrowRight}
                iconPosition="right"
                variant="primary"
                className="px-6 py-2.5 shadow-glow-primary"
              >
                Submit Response
              </Button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  );
}
