import { useState, useEffect, useCallback } from 'react';

/**
 * Enhanced hook for browser microphone permissions.
 *
 * Checks:
 *   1. Secure Context (window.isSecureContext) — required for WebRTC / getUserMedia.
 *   2. Hardware MediaDevices API availability.
 *   3. navigator.permissions.query for 'microphone' (with graceful fallback for Firefox/Safari).
 *   4. Direct interactive verification via navigator.mediaDevices.getUserMedia({ audio: true }).
 *
 * Returns:
 *   status: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'insecure-context' | 'no-device' | 'checking'
 *   isSecureContext: boolean
 *   errorDetails: string
 *   requestPermission: async () => { success: boolean, error?: string }
 *   checkPermission: async () => string
 */
export function useMicPermission() {
  const [status, setStatus] = useState('checking');
  const [isSecure, setIsSecure] = useState(true);
  const [errorDetails, setErrorDetails] = useState('');

  // Initial passive status check
  const checkPermission = useCallback(async () => {
    if (typeof window === 'undefined') {
      setStatus('unsupported');
      return 'unsupported';
    }

    // 1. Secure context check
    const isContextSecure =
      window.isSecureContext !== undefined
        ? Boolean(window.isSecureContext)
        : window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';

    setIsSecure(isContextSecure);

    if (!isContextSecure) {
      setStatus('insecure-context');
      setErrorDetails(
        `Microphone recording requires a Secure Context (HTTPS or http://localhost:${window.location.port || '3000'}). You are accessing via an unencrypted network IP (${window.location.hostname}).`
      );
      return 'insecure-context';
    }

    // 2. MediaDevices check
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('unsupported');
      setErrorDetails('Audio input (navigator.mediaDevices.getUserMedia) is not supported in this browser.');
      return 'unsupported';
    }

    // 3. Try navigator.permissions.query (Chrome, Edge, Opera)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        setStatus(result.state); // 'granted' | 'denied' | 'prompt'
        result.onchange = () => {
          setStatus(result.state);
        };
        return result.state;
      } catch (_) {
        // Firefox and Safari reject { name: 'microphone' } with TypeError
        // Fall back to 'prompt' so the user can interactively trigger permission
        setStatus('prompt');
        return 'prompt';
      }
    }

    // Fallback: assume prompt is possible
    setStatus('prompt');
    return 'prompt';
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Interactive permission request (must be called from a user gesture)
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined') return { success: false, error: 'no-window' };

    const isContextSecure =
      window.isSecureContext !== undefined
        ? Boolean(window.isSecureContext)
        : window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';

    if (!isContextSecure) {
      setStatus('insecure-context');
      const err = `Microphone recording requires a Secure Context. Please access the application via http://localhost:${window.location.port || '3000'} or HTTPS.`;
      setErrorDetails(err);
      return { success: false, error: 'insecure-context', message: err };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('unsupported');
      const err = 'Audio recording is not supported in this browser.';
      setErrorDetails(err);
      return { success: false, error: 'unsupported', message: err };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop all audio tracks after verifying permission
      stream.getTracks().forEach((track) => track.stop());
      setStatus('granted');
      setErrorDetails('');
      return { success: true };
    } catch (err) {
      console.warn('Microphone permission request failed:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorDetails(
          'Microphone permission was dismissed or blocked in browser settings. Please allow microphone access in your browser address bar.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStatus('no-device');
        setErrorDetails('No microphone device was detected on your system. Please connect an audio input device.');
      } else {
        setStatus('error');
        setErrorDetails(err.message || 'An error occurred while requesting microphone access.');
      }
      return { success: false, error: err.name, message: err.message };
    }
  }, []);

  return {
    status,
    isSecureContext: isSecure,
    errorDetails,
    requestPermission,
    checkPermission,
  };
}

export default useMicPermission;
