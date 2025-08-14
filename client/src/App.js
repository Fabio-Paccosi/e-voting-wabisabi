import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import ElectionSelectionPage from './components/ElectionSelectionPage';
import VotingPage from './components/VotingPage';
import ResultsPage from './components/ResultsPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VotingProvider } from './contexts/VotingContext';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Caricamento...</p>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <VotingProvider>
        <Router>
          <div className="app">
            <header className="app-header">
              <div className="container">
                <h1>🗳️ E-Voting WabiSabi</h1>
                <p>Sistema di Voto Elettronico Anonimo e Sicuro</p>
              </div>
            </header>
            
            <main className="app-main">
              <div className="container">
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route 
                    path="/elections" 
                    element={
                      <ProtectedRoute>
                        <ElectionSelectionPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/vote/:electionId" 
                    element={
                      <ProtectedRoute>
                        <VotingPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/results" 
                    element={
                      <ProtectedRoute>
                        <ResultsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                </Routes>
              </div>
            </main>
            
            <footer className="app-footer">
              <div className="container">
                <p>&copy; 2025 E-Voting WabiSabi - Sistema Sicuro e Anonimo</p>
              </div>
            </footer>
          </div>
        </Router>
      </VotingProvider>
    </AuthProvider>
  );
};

export default App;