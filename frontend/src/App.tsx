import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import { ToastProvider } from './contexts/ToastContext';
import './App.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const InterviewSetupPage = lazy(() => import('./pages/InterviewSetupPage'));
const InterviewPage = lazy(() => import('./pages/InterviewPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const SessionAnalyticsPage = lazy(() => import('./pages/SessionAnalyticsPage'));
const ResumeUploader = lazy(() => import('./components/ResumeUploaderEnhanced'));
const JDInput = lazy(() => import('./components/JDInput'));
const InterviewReportPage = lazy(() => import('./pages/InterviewReportPage'));
const SimulationInterviewPage = lazy(() => import('./pages/SimulationInterviewPage'));
const SimulationReportPage = lazy(() => import('./pages/SimulationReportPage'));
const PanelInterviewPage = lazy(() => import('./pages/PanelInterviewPage'));
const PanelReportPage = lazy(() => import('./pages/PanelReportPage'));
const CompanyInterviewPage = lazy(() => import('./pages/CompanyInterviewPage'));
const PastSessionsPage = lazy(() => import('./pages/PastSessionsPage'));
const HybridSetupPage = lazy(() => import('./pages/HybridSetupPage'));
const HybridInterviewPage = lazy(() => import('./pages/HybridInterviewPage'));
const HybridWaitingRoomPage = lazy(() => import('./pages/HybridWaitingRoomPage'));
const JoinSessionPage = lazy(() => import('./pages/JoinSessionPage'));
const InterviewerPanelPage = lazy(() => import('./pages/InterviewerPanelPage'));
const ContestPage = lazy(() => import('./pages/ContestPage'));
const ContestLeaderboardPage = lazy(() => import('./pages/ContestLeaderboardPage'));
const ContestModePage = lazy(() => import('./pages/ContestModePage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  useEffect(() => { checkAuth(); }, [checkAuth]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/interview/setup" element={<ProtectedRoute><InterviewSetupPage /></ProtectedRoute>} />
              <Route path="/interview/setup/resume" element={<ProtectedRoute><ResumeUploader /></ProtectedRoute>} />
              <Route path="/interview/setup/job-description" element={<ProtectedRoute><JDInput /></ProtectedRoute>} />
              <Route path="/interview" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
              <Route path="/interview/simulation" element={<ProtectedRoute><SimulationInterviewPage /></ProtectedRoute>} />
              <Route path="/interview/simulation/report" element={<ProtectedRoute><SimulationReportPage /></ProtectedRoute>} />
              <Route path="/interview/panel" element={<ProtectedRoute><PanelInterviewPage /></ProtectedRoute>} />
              <Route path="/interview/panel/report" element={<ProtectedRoute><PanelReportPage /></ProtectedRoute>} />
              <Route path="/interview/company" element={<ProtectedRoute><CompanyInterviewPage /></ProtectedRoute>} />
              <Route path="/interview/report" element={<ProtectedRoute><InterviewReportPage /></ProtectedRoute>} />
              <Route path="/interview/report/:sessionId" element={<ProtectedRoute><InterviewReportPage /></ProtectedRoute>} />
              <Route path="/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/results/:sessionId" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><UserManagementPage /></ProtectedRoute>} />
              <Route path="/admin/sessions" element={<ProtectedRoute requiredRole="admin"><SessionAnalyticsPage /></ProtectedRoute>} />
              <Route path="/sessions/history" element={<ProtectedRoute><PastSessionsPage /></ProtectedRoute>} />
              <Route path="/hybrid/setup" element={<ProtectedRoute><HybridSetupPage /></ProtectedRoute>} />
              <Route path="/hybrid/room/:sessionId" element={<ProtectedRoute><HybridWaitingRoomPage /></ProtectedRoute>} />
              <Route path="/hybrid/interview/:sessionId" element={<ProtectedRoute><HybridInterviewPage /></ProtectedRoute>} />
              <Route path="/hybrid/interviewer/:sessionId" element={<ProtectedRoute><InterviewerPanelPage /></ProtectedRoute>} />
              <Route path="/contest/mode" element={<ProtectedRoute><ContestModePage /></ProtectedRoute>} />
              <Route path="/hybrid/contest/:contestId" element={<ProtectedRoute><ContestPage /></ProtectedRoute>} />
              <Route path="/hybrid/contest/:contestId/leaderboard" element={<ProtectedRoute><ContestLeaderboardPage /></ProtectedRoute>} />
              <Route path="/join/:sessionId" element={<JoinSessionPage />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;