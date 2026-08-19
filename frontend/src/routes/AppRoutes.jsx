import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import InterviewSetupPage from '../pages/InterviewSetupPage';
import InterviewRoomPage from '../pages/InterviewRoomPage';
import InterviewEvaluationPage from '../pages/InterviewEvaluationPage';

// Simple ProtectedRoute wrapper for MVP framework demonstration
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function AppRoutes() {
  return (
    <Routes>
      {/* Main Layout Pages */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="interview/setup"
          element={
            <ProtectedRoute>
              <InterviewSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="interview/:interviewId"
          element={
            <ProtectedRoute>
              <InterviewRoomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="interview/:interviewId/evaluation"
          element={
            <ProtectedRoute>
              <InterviewEvaluationPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Auth Layout Pages */}
      <Route path="/" element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>

      {/* Catch-all Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
