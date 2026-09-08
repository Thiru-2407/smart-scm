import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import VersionDetails from './pages/VersionDetails';
import BugDetails from './pages/BugDetails';
import ChangeRequestDetails from './pages/ChangeRequestDetails';
import ReleaseDetails from './pages/ReleaseDetails';
import Reports from './pages/Reports';
import UVCS from './pages/UVCS';
import Activity from './pages/Activity';
import Traceability from './pages/Traceability';
import ImpactAnalysis from './pages/ImpactAnalysis';
import ReleaseReadiness from './pages/ReleaseReadiness';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/projects/:projectId/versions/:versionId" element={<VersionDetails />} />
            <Route path="/projects/:projectId/bugs/:bugId" element={<BugDetails />} />
            <Route path="/projects/:projectId/change-requests/:changeRequestId" element={<ChangeRequestDetails />} />
            <Route path="/projects/:projectId/releases/:releaseId" element={<ReleaseDetails />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/traceability" element={<Traceability />} />
            <Route path="/impact-analysis" element={<ImpactAnalysis />} />
            <Route path="/release-readiness" element={<ReleaseReadiness />} />
            <Route path="/uvcs" element={<UVCS />} />
          </Route>

          {/* Fallback Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
