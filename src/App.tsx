import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import SalesLeads from './pages/SalesLeads';
import Retention from './pages/Retention';
import LeadDetails from './pages/LeadDetails';
import UserManagement from './pages/UserManagement';
import UserDetails from './pages/UserDetails';
import LeadStatuses from './pages/LeadStatuses';
import LeadQuestions from './pages/LeadQuestions';
import ApiKeys from './pages/ApiKeys';
import ApiDashboard from './pages/ApiDashboard';
import AssignmentRules from './pages/AssignmentRules';
import Settings from './pages/Settings';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function ProtectedRoute({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  return (
    <AuthGuard requireAdmin={requireAdmin}>
      <Layout>{children}</Layout>
    </AuthGuard>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><SalesLeads /></ProtectedRoute>} />
        <Route path="/retention" element={<ProtectedRoute><Retention /></ProtectedRoute>} />
        <Route path="/lead/:id" element={<ProtectedRoute><LeadDetails /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute requireAdmin><UserManagement /></ProtectedRoute>} />
        <Route path="/user/:id" element={<ProtectedRoute requireAdmin><UserDetails /></ProtectedRoute>} />
        <Route path="/statuses" element={<ProtectedRoute requireAdmin><LeadStatuses /></ProtectedRoute>} />
        <Route path="/questions" element={<ProtectedRoute requireAdmin><LeadQuestions /></ProtectedRoute>} />
        <Route path="/api" element={<ProtectedRoute requireAdmin><ApiKeys /></ProtectedRoute>} />
        <Route path="/api/dashboard" element={<ProtectedRoute requireAdmin><ApiDashboard /></ProtectedRoute>} />
        <Route path="/assignment-rules" element={<ProtectedRoute requireAdmin><AssignmentRules /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;