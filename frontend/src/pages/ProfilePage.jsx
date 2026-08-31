import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── Simple inline alert ──────────────────────────────────── */
function Alert({ type, message }) {
  if (!message) return null;
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error:   'bg-rose-500/10 border-rose-500/30 text-rose-400',
  };
  return (
    <div className={`border rounded-xl px-5 py-3 text-sm ${styles[type]}`}>
      {message}
    </div>
  );
}

/* ── Section card wrapper ─────────────────────────────────── */
function Card({ title, icon, children }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
        <span className="text-emerald-400">{icon}</span>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ── Input field ──────────────────────────────────────────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, disabled, hint }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-2.5 rounded-xl bg-slate-800/70 text-slate-100 border border-slate-700 placeholder-slate-500
                   focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const navigate = useNavigate();

  /* profile data */
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');

  /* name form */
  const [fullName, setFullName]       = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg]         = useState({ type: '', text: '' });

  /* password form */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading]             = useState(false);
  const [pwMsg, setPwMsg]                     = useState({ type: '', text: '' });

  /* ── Load user profile on mount ─────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
        setFullName(data.full_name || '');
      } catch (err) {
        if (err?.response?.status === 401) navigate('/login');
        else setLoadError('Failed to load your profile. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── Update display name ─────────────────────────────── */
  const handleNameSave = async (e) => {
    e.preventDefault();
    setNameMsg({ type: '', text: '' });
    setNameLoading(true);
    try {
      const { data } = await api.put('/auth/me', { full_name: fullName.trim() || null });
      setUser(data);
      setFullName(data.full_name || '');
      setNameMsg({ type: 'success', text: 'Display name updated successfully.' });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setNameMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to update name.' });
    } finally {
      setNameLoading(false);
    }
  };

  /* ── Change password ─────────────────────────────────── */
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setPwLoading(true);
    try {
      await api.put('/auth/me', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setPwMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to change password.' });
    } finally {
      setPwLoading(false);
    }
  };

  /* ── Loading / error states ─────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading your profile…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
        <p className="text-rose-400">{loadError}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  /* ── Initials avatar ─────────────────────────────────── */
  const initials = (user?.full_name || user?.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      {/* Back link */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* ── Profile header ─────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900/90 via-slate-800/60 to-emerald-900/20 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm flex items-center gap-6">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-emerald-600/20 border-2 border-emerald-500/40 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-emerald-400">{initials}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-white truncate">
            {user?.full_name || 'No display name set'}
          </h1>
          <p className="text-slate-400 text-sm mt-1 truncate">{user?.email}</p>
          <span className={`mt-2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold border ${user?.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
            {user?.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* ── Update display name ────────────────────────── */}
      <Card
        title="Display Name"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        }
      >
        <form onSubmit={handleNameSave} className="space-y-4">
          <Field
            id="full-name"
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g., Alex Smith"
            disabled={nameLoading}
            hint="This name appears across your dashboard and reports."
          />
          <Alert type={nameMsg.type} message={nameMsg.text} />
          <div className="flex justify-end">
            <button
              id="btn-save-name"
              type="submit"
              disabled={nameLoading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20"
            >
              {nameLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Save Name'}
            </button>
          </div>
        </form>
      </Card>

      {/* ── Account info (read-only) ───────────────────── */}
      <Card
        title="Account Information"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      >
        <div className="space-y-4">
          <Field
            id="profile-email"
            label="Email Address"
            value={user?.email || ''}
            onChange={() => {}}
            disabled
            hint="Email cannot be changed. Contact support if needed."
          />
        </div>
      </Card>

      {/* ── Change password ────────────────────────────── */}
      <Card
        title="Change Password"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        }
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Field
            id="current-password"
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
            disabled={pwLoading}
          />
          <Field
            id="new-password"
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={pwLoading}
          />
          <Field
            id="confirm-password"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            disabled={pwLoading}
          />
          <Alert type={pwMsg.type} message={pwMsg.text} />
          <div className="flex justify-end">
            <button
              id="btn-change-password"
              type="submit"
              disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20"
            >
              {pwLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating…
                </>
              ) : 'Change Password'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
