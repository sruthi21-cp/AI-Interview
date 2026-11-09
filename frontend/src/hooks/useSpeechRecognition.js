import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Formats common technical interview terms without altering general sentence structure.
 */
export function formatTechnicalTerms(text) {
  if (!text || typeof text !== 'string') return text;
  const termsMap = {
    python: 'Python',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    react: 'React',
    fastapi: 'FastAPI',
    sqlalchemy: 'SQLAlchemy',
    postgresql: 'PostgreSQL',
    postgres: 'PostgreSQL',
    'rest api': 'REST API',
    'restful api': 'RESTful API',
    jwt: 'JWT',
    oauth: 'OAuth2',
    oauth2: 'OAuth2',
    docker: 'Docker',
    kubernetes: 'Kubernetes',
    github: 'GitHub',
    aws: 'AWS',
    azure: 'Azure',
    sql: 'SQL',
    nosql: 'NoSQL',
    mongodb: 'MongoDB',
    redis: 'Redis',
    graphql: 'GraphQL',
    html: 'HTML',
    css: 'CSS',
  };

  let formatted = text;
  Object.keys(termsMap).forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    formatted = formatted.replace(regex, termsMap[term]);
  });
  return formatted;
}

const LANGUAGE_CODE_MAP = {
  English: 'en-US',
  Tamil: 'ta-IN',
  Hindi: 'hi-IN',
  Telugu: 'te-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
};

export function getLanguageCode(lang) {
  if (!lang) return 'en-US';
  if (LANGUAGE_CODE_MAP[lang]) return LANGUAGE_CODE_MAP[lang];
  if (lang.includes('-')) return lang;
  return 'en-US';
}

/**
 * Voice state machine values.
 * IDLE             → Mic stopped / inactive
 * LISTENING        → Actively capturing speech (speech recognition running)
 * PROCESSING       → Finalizing transcript buffer
 * ERROR            → Recognition failed (hardware error, permission denied, etc.)
 */
export const VOICE_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  TRANSCRIPT_READY: 'transcript_ready',
  ERROR: 'error',
};

/**
 * Enhanced custom hook for Global Continuous Voice Recording in technical interviews.
 *
 * Key Capabilities:
 *  - Persistent continuous listening across ALL interview questions
 *  - Single global toggle (Start Voice Recording / Stop Voice Recording)
 *  - Auto-restarts speech recognition when browser pauses or encounters silence
 *  - Sentence accumulator: preserves full sentences without overwriting
 *  - Live interim streaming directly into the candidate's answer textarea
 *  - Per-question transcript reset (resets answer text for next question without stopping mic)
 *  - Prevents multiple concurrent SpeechRecognition instances
 *  - Seamless synchronization with manual keyboard typing
 */
export function useSpeechRecognition({ onTranscript, lang = 'English' } = {}) {
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [isContinuousActive, setIsContinuousActive] = useState(false);
  const [error, setError] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [lowQualityWarning, setLowQualityWarning] = useState('');

  const recognitionRef = useRef(null);
  const isContinuousActiveRef = useRef(false);
  const isStartingRef = useRef(false);
  const restartCountRef = useRef(0);
  const lastRestartTimeRef = useRef(0);
  const finalTranscriptRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const timerRef = useRef(null);

  // Keep onTranscript callback reference fresh without triggering effect re-runs
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // ── Recording Duration Timer ─────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Cleanup Active Recognition Instance ──────────────────────────
  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (_) {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    isStartingRef.current = false;
  }, []);

  // ── Core Start Engine ────────────────────────────────────────────
  const initAndStartRecognition = useCallback(() => {
    if (!isSupported) {
      setError('Voice speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setVoiceState(VOICE_STATES.ERROR);
      return;
    }

    // Prevent multiple concurrent SpeechRecognition instances
    if (recognitionRef.current || isStartingRef.current) {
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    try {
      isStartingRef.current = true;
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getLanguageCode(lang);
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isStartingRef.current = false;
        setVoiceState(VOICE_STATES.LISTENING);
        setError('');
      };

      recognition.onresult = (event) => {
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptChunk = result[0]?.transcript || '';

          if (result.isFinal) {
            const currentFinal = finalTranscriptRef.current.trim();
            const chunk = transcriptChunk.trim();
            if (chunk) {
              const formattedChunk = formatTechnicalTerms(chunk);
              finalTranscriptRef.current = currentFinal
                ? `${currentFinal} ${formattedChunk}`
                : formattedChunk;
            }
          } else {
            currentInterim += transcriptChunk;
          }
        }

        setInterimText(currentInterim);

        if (onTranscriptRef.current) {
          const fullText = [finalTranscriptRef.current, currentInterim.trim()]
            .filter(Boolean)
            .join(' ');

          onTranscriptRef.current({
            finalTranscript: finalTranscriptRef.current,
            interimTranscript: currentInterim.trim(),
            fullText,
          });
        }
      };

      recognition.onerror = (event) => {
        isStartingRef.current = false;
        const errType = event.error;

        if (errType === 'no-speech') {
          // Non-fatal: candidate paused to think — continuous recording remains active
          return;
        }

        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          isContinuousActiveRef.current = false;
          setIsContinuousActive(false);
          stopTimer();
          setError(
            'Microphone access is blocked in your browser settings. Please allow microphone access in your address bar.'
          );
          setVoiceState(VOICE_STATES.ERROR);
          cleanupRecognition();
        } else if (errType === 'audio-capture') {
          isContinuousActiveRef.current = false;
          setIsContinuousActive(false);
          stopTimer();
          setError('No microphone found on your system. Please check your audio input device.');
          setVoiceState(VOICE_STATES.ERROR);
          cleanupRecognition();
        } else if (errType === 'network') {
          // Network fluctuation with recognition server — keep continuous mode active and retry
          console.warn('SpeechRecognition network fluctuation; will retry connection.');
        } else if (errType !== 'aborted') {
          console.warn('SpeechRecognition error notice:', errType);
        }
      };

      recognition.onend = () => {
        isStartingRef.current = false;
        recognitionRef.current = null;

        // Auto-restart if Global Continuous Voice Recording is active
        if (isContinuousActiveRef.current) {
          const now = Date.now();
          if (now - lastRestartTimeRef.current < 800) {
            restartCountRef.current += 1;
          } else {
            restartCountRef.current = 1;
          }
          lastRestartTimeRef.current = now;

          // Restart immediately to maintain seamless continuous listening
          const delay = restartCountRef.current > 15 ? 500 : 80;
          setTimeout(() => {
            if (isContinuousActiveRef.current && !recognitionRef.current) {
              initAndStartRecognition();
            }
          }, delay);
        } else {
          setVoiceState(VOICE_STATES.IDLE);
          setInterimText('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      isStartingRef.current = false;
      cleanupRecognition();
      console.warn('Failed to start SpeechRecognition:', err);
      if (isContinuousActiveRef.current) {
        setError('Microphone permission or hardware access is required for voice recording.');
        setVoiceState(VOICE_STATES.ERROR);
      }
    }
  }, [isSupported, lang, cleanupRecognition, stopTimer]);

  // ── Global Start Continuous Voice ────────────────────────────────
  const startContinuousVoice = useCallback(
    async (initialText = '') => {
      if (!isSupported) {
        setError('Voice input is not supported in this browser. Please use Chrome or Edge.');
        setVoiceState(VOICE_STATES.ERROR);
        return false;
      }

      // Check Secure Context
      const isContextSecure =
        typeof window !== 'undefined' &&
        (window.isSecureContext !== undefined
          ? Boolean(window.isSecureContext)
          : window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1');

      if (!isContextSecure) {
        setError(
          `Voice recording requires a Secure Context. Please open via http://localhost:${window.location.port || '3000'} or HTTPS.`
        );
        setVoiceState(VOICE_STATES.ERROR);
        return false;
      }

      setError('');
      setLowQualityWarning('');

      // Interactive getUserMedia handshake to ensure permission prompt is accepted
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr) {
          console.warn('Microphone permission check failed during startContinuousVoice:', permErr);
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setError(
              'Microphone permission was denied. Please allow microphone access in your browser address bar.'
            );
            setVoiceState(VOICE_STATES.ERROR);
            return false;
          } else if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
            setError('No microphone device was detected on your computer.');
            setVoiceState(VOICE_STATES.ERROR);
            return false;
          }
        }
      }

      isContinuousActiveRef.current = true;
      setIsContinuousActive(true);
      restartCountRef.current = 0;

      if (initialText !== undefined) {
        finalTranscriptRef.current = initialText;
      }

      cleanupRecognition();
      startTimer();
      initAndStartRecognition();
      return true;
    },
    [isSupported, cleanupRecognition, startTimer, initAndStartRecognition]
  );

  // ── Global Stop Continuous Voice ─────────────────────────────────
  const stopContinuousVoice = useCallback(() => {
    isContinuousActiveRef.current = false;
    setIsContinuousActive(false);
    stopTimer();
    cleanupRecognition();
    setInterimText('');
    setVoiceState(VOICE_STATES.IDLE);
  }, [cleanupRecognition, stopTimer]);

  // ── Global Toggle Continuous Voice ───────────────────────────────
  const toggleContinuousVoice = useCallback(
    async (currentAnswer = '') => {
      if (isContinuousActiveRef.current) {
        stopContinuousVoice();
        return false;
      } else {
        return await startContinuousVoice(currentAnswer);
      }
    },
    [startContinuousVoice, stopContinuousVoice]
  );

  // ── Question Transition: Reset Answer Transcript for New Question ──
  // Clears the sentence buffer for the newly displayed question while KEEPING continuous mic alive!
  const resetQuestionTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setInterimText('');
    setLowQualityWarning('');
    if (onTranscriptRef.current) {
      onTranscriptRef.current({ finalTranscript: '', interimTranscript: '', fullText: '' });
    }

    // If continuous mode is enabled and recognition paused, ensure it's actively running
    if (isContinuousActiveRef.current && !recognitionRef.current) {
      initAndStartRecognition();
    }
  }, [initAndStartRecognition]);

  // ── Sync with Manual Typing ──────────────────────────────────────
  // When candidate edits text via keyboard, sync the speech buffer so future speech appends smoothly
  const syncEditedAnswer = useCallback((typedText) => {
    finalTranscriptRef.current = typedText || '';
  }, []);

  // ── Backward-compatible Single Controls ──────────────────────────
  const startListening = useCallback(
    (initialText = '') => startContinuousVoice(initialText),
    [startContinuousVoice]
  );

  const stopListening = useCallback(() => {
    stopContinuousVoice();
  }, [stopContinuousVoice]);

  const resetVoice = useCallback(() => {
    stopContinuousVoice();
    finalTranscriptRef.current = '';
    setInterimText('');
    setError('');
    setLowQualityWarning('');
    setRecordingSeconds(0);
  }, [stopContinuousVoice]);

  // ── Derived State Flags ──────────────────────────────────────────
  const isListening = voiceState === VOICE_STATES.LISTENING;
  const isProcessing = voiceState === VOICE_STATES.PROCESSING;
  const isStopping = isProcessing;

  // ── Unmount Cleanup ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isContinuousActiveRef.current = false;
      stopTimer();
      cleanupRecognition();
    };
  }, [cleanupRecognition, stopTimer]);

  return {
    voiceState,
    isSupported,
    isListening,
    isProcessing,
    isStopping,
    isContinuousActive,
    interimText,
    recordingSeconds,
    error,
    lowQualityWarning,
    clearError: () => {
      setError('');
      setLowQualityWarning('');
    },
    // Continuous voice API
    startContinuousVoice,
    stopContinuousVoice,
    toggleContinuousVoice,
    resetQuestionTranscript,
    syncEditedAnswer,
    // Backward-compat API
    startListening,
    stopListening,
    resetVoice,
    resetTranscript: resetVoice,
  };
}

export default useSpeechRecognition;
