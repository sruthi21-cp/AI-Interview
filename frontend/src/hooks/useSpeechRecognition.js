import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for browser-native Web Speech / SpeechRecognition API.
 * Provides voice-to-text transcription with continuous listening and error handling.
 */
export function useSpeechRecognition({ onTranscript, lang = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const isExplicitStopRef = useRef(false);

  // Check browser support for SpeechRecognition or webkitSpeechRecognition
  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    isExplicitStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Recognition might already be stopped
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Please type your answer.');
      return;
    }

    setError('');
    isExplicitStopRef.current = false;

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        // Ignore abort errors
      }
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setError('');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptPiece = result[0]?.transcript || '';
          if (result.isFinal) {
            finalTranscript += transcriptPiece;
          } else {
            interimTranscript += transcriptPiece;
          }
        }

        if (onTranscript) {
          onTranscript({
            finalTranscript: finalTranscript.trim(),
            interimTranscript: interimTranscript.trim(),
            rawResults: event.results,
          });
        }
      };

      recognition.onerror = (event) => {
        const errType = event.error;
        if (errType === 'no-speech') {
          // Normal silence, don't show a blocking error
          return;
        }
        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          setError('Microphone access was denied. Please allow microphone permissions in your browser.');
        } else if (errType === 'audio-capture') {
          setError('No microphone found. Please check your audio input device.');
        } else if (errType === 'network') {
          setError('Network issue with speech recognition service. Please check your connection.');
        } else if (errType !== 'aborted') {
          setError('Speech recognition encountered an issue. You can continue typing your answer.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setError('Unable to start speech recognition. Please check your microphone permissions.');
      setIsListening(false);
    }
  }, [isSupported, lang, onTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clean up recognition instance when unmounting
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    clearError: () => setError(''),
    startListening,
    stopListening,
    toggleListening,
  };
}

export default useSpeechRecognition;
