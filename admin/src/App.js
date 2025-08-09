// admin/src/App.js - Applicazione Admin Dashboard Completa

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import { ToastProvider, ErrorBoundary } from './components/Layout';
//import './App.css';

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;