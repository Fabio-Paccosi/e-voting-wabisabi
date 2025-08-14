import React, { createContext, useContext, useState } from 'react';

const VotingContext = createContext();

export const useVoting = () => {
  const context = useContext(VotingContext);
  if (!context) {
    throw new Error('useVoting must be used within a VotingProvider');
  }
  return context;
};

export const VotingProvider = ({ children }) => {
  const [voting, setVoting] = useState({
    currentElection: null,
    selectedCandidate: null,
    bitcoinAddress: null,
    credential: null,
    voteCommitment: null,
    transactionId: null,
    step: 'idle', // idle, selection, crypto, voting, complete
    progress: 0,
    error: null
  });

  const updateVoting = (updates) => {
    setVoting(prev => ({
      ...prev,
      ...updates
    }));
  };

  const resetVoting = () => {
    setVoting({
      currentElection: null,
      selectedCandidate: null,
      bitcoinAddress: null,
      credential: null,
      voteCommitment: null,
      transactionId: null,
      step: 'idle',
      progress: 0,
      error: null
    });
  };

  const value = {
    voting,
    setVoting,
    updateVoting,
    resetVoting
  };

  return (
    <VotingContext.Provider value={value}>
      {children}
    </VotingContext.Provider>
  );
};