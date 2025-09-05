// client/src/App.js - App principale aggiornato con i nuovi componenti

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Componenti esistenti
import LoginPage from './components/LoginPage';
import ElectionResults from './components/ElectionResults';
import ResultsPage from './components/ResultsPage';

// Nuovi componenti adattati
import ElectionSelectionWithWallet from './components/ElectionSelectionWithWallet';
import VotingPage from './components/VotingPage';

// CSS
import './App.css';

// Componente ProtectedRoute per proteggere le rotte autenticate
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

// Componente PublicRoute per rotte non autenticate
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }
  
  return user ? <Navigate to="/" replace /> : children;
};

// Componente App principale
function App() {
  return (
    <div className="app">
    <header className="app-header">
      <div className="container">
        <h1>🗳️ E-Voting WabiSabi</h1>
        <p>Progetto di Tesi Magistrale di Fabio Paccosi</p>
      </div>
    </header>
    
    <main className="app-main">
      <div className="container">
        <AuthProvider>
          <Router>
            <div className="App">
              <Routes>
                {/* Rotte pubbliche (solo per utenti non autenticati) */}
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  } 
                />

                {/* Rotte protette (solo per utenti autenticati) */}
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <ElectionSelectionWithWallet />
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
                
                <Route 
                  path="/elections/:electionId/results" 
                  element={
                    <ProtectedRoute>
                      <ElectionResults />
                    </ProtectedRoute>
                  } 
                />

                {/* Rotta catch-all per reindirizzare a home o login */}
                <Route 
                  path="*" 
                  element={<Navigate to="/" replace />} 
                />
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </div>
    </main>
    </div>
  );
}

export default App;