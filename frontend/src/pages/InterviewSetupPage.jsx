import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ---- Allowed option sets (mirrored from backend Literal types) ----
const INTERVIEW_TYPES = ['Technical', 'HR', 'Mixed', 'Behavioral'];
const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const QUESTION_COUNTS = [3, 5, 10];

const INITIAL_FORM = {
  interview_type: '',
  job_role: '',
  experience_level: '',
  job_description: '', // optional description
  difficulty: '',
  question_count: '',
};

// Pill/chip selector component
function OptionGroup({ label, options, value, onChange, fieldName, error }) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-300 tracking-wide">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const strOpt = String(opt);
          const isSelected = String(value) === strOpt;
          return (
            <button
              key={strOpt}
              type="button"
              onClick={() => onChange(fieldName, opt)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                isSelected
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/80 hover:border-slate-600 hover:text-white'
              }`}
            >
              {strOpt}
            </button>
          );
        })}
      </div>
      {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function InterviewSetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);

  const handleSelect = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on selection
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Handle resume PDF file selection with client‑side validation
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setErrors((prev) => ({ ...prev, resume: 'Resume must be a PDF file.' }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2 MiB limit
      setErrors((prev) => ({ ...prev, resume: 'Resume exceeds 2 MiB size limit.' }));
      return;
    }
    setResumeFile(file);
    setErrors((prev) => ({ ...prev, resume: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.interview_type) newErrors.interview_type = 'Please select an interview type.';
    if (!form.job_role) newErrors.job_role = 'Please select a job role.';
    if (!form.experience_level) newErrors.experience_level = 'Please select your experience level.';
    if (!form.difficulty) newErrors.difficulty = 'Please select a difficulty.';
    if (!form.question_count) newErrors.question_count = 'Please select the number of questions.';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('interview_type', form.interview_type);
      formData.append('job_role', form.job_role);
      formData.append('experience_level', form.experience_level);
      formData.append('difficulty', form.difficulty);
      formData.append('question_count', String(form.question_count));
      if (form.job_description) {
        formData.append('job_description', form.job_description);
      }
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const response = await api.post('/interviews/start', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = response.data;
      navigate(`/interview/${data.session_id}`);
    } catch (err) {
      console.error('Interview creation error:', err?.response?.status, err?.response?.data);
      const raw = err?.response?.data?.detail;
      let detail;
      if (Array.isArray(raw)) {
        detail = raw.map((d) => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof raw === 'string') {
        detail = raw;
      } else {
        detail = 'Failed to create interview session. Please try again.';
      }
      setApiError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-6 group"
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

        <h1 className="text-3xl font-bold tracking-tight text-white">
          Set Up Your Interview
        </h1>
        <p className="text-slate-400 mt-2">
          Configure your mock interview session. All fields are required.
        </p>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-8 backdrop-blur-sm">

          {/* Interview Type */}
          <OptionGroup
            label="Interview Type"
            options={INTERVIEW_TYPES}
            value={form.interview_type}
            onChange={handleSelect}
            fieldName="interview_type"
            error={errors.interview_type}
          />

          <div className="border-t border-slate-800" />

          {/* Job Role */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300 tracking-wide">
              Job Role
            </label>
            <input
              type="text"
              placeholder="e.g., Python Developer"
              className={`w-full px-4 py-2 rounded-lg bg-slate-800/60 text-slate-100 border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${errors.job_role ? 'border-rose-500' : 'border-slate-700'}`}
              value={form.job_role}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, job_role: e.target.value }));
                setErrors((prev) => ({ ...prev, job_role: '' }));
              }}
            />
            {errors.job_role && (
              <p className="text-rose-400 text-xs mt-1">{errors.job_role}</p>
            )}
          </div>

          <div className="border-t border-slate-800" />

          {/* Experience Level */}
          <OptionGroup
            label="Experience Level"
            options={EXPERIENCE_LEVELS}
            value={form.experience_level}
            onChange={handleSelect}
            fieldName="experience_level"
            error={errors.experience_level}
          />

          <div className="border-t border-slate-800" />

          {/* Difficulty */}
          <OptionGroup
            label="Difficulty"
            options={DIFFICULTIES}
            value={form.difficulty}
            onChange={handleSelect}
            fieldName="difficulty"
            error={errors.difficulty}
          />

          <div className="border-t border-slate-800" />

          {/* Number of Questions */}
          <OptionGroup
            label="Number of Questions"
            options={QUESTION_COUNTS}
            value={form.question_count}
            onChange={handleSelect}
            fieldName="question_count"
            error={errors.question_count}
          />
        </div>
        {/* Job Description (optional) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300 tracking-wide">
            Job Description (optional)
          </label>
          <textarea
            placeholder="Describe the job role or responsibilities..."
            className={`w-full px-4 py-2 rounded-lg bg-slate-800/60 text-slate-100 border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${errors.job_description ? 'border-rose-500' : 'border-slate-700'}`}
            value={form.job_description}
            rows={4}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, job_description: e.target.value }));
              setErrors((prev) => ({ ...prev, job_description: '' }));
            }}
          />
          {errors.job_description && (
            <p className="text-rose-400 text-xs mt-1">{errors.job_description}</p>
          )}
        </div>

        {/* Resume Upload (optional) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300 tracking-wide">
            Upload Resume (PDF, optional)
          </label>
          <input
            type="file"
            accept="application/pdf"
            className={`w-full px-4 py-2 rounded-lg bg-slate-800/60 border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${errors.resume ? 'border-rose-500' : 'border-slate-700'}`}
            onChange={handleFileChange}
          />
          {errors.resume && (
            <p className="text-rose-400 text-xs mt-1">{errors.resume}</p>
          )}
        </div>

        {/* Summary preview */}
        {(form.interview_type || form.job_role || form.experience_level) && (
          <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-6 py-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            {form.interview_type && (
              <span><span className="text-emerald-400 font-medium">Type:</span> {form.interview_type}</span>
            )}
            {form.job_role && (
              <span><span className="text-emerald-400 font-medium">Role:</span> {form.job_role}</span>
            )}
            {form.experience_level && (
              <span><span className="text-emerald-400 font-medium">Level:</span> {form.experience_level}</span>
            )}
            {form.difficulty && (
              <span><span className="text-emerald-400 font-medium">Difficulty:</span> {form.difficulty}</span>
            )}
            {form.question_count && (
              <span><span className="text-emerald-400 font-medium">Questions:</span> {form.question_count}</span>
            )}
          </div>
        )}

        {/* API Error */}
        {apiError && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/30 rounded-xl px-6 py-4">
            <p className="text-rose-400 text-sm">{apiError}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-6 flex justify-end">
          <button
            id="btn-create-interview"
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Creating Session…
              </>
            ) : (
              <>
                Start Interview
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
