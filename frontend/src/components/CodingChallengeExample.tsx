/**
 * Example usage of CodingChallenge component
 * 
 * This file demonstrates how to integrate the CodingChallenge component
 * into your interview flow or as a standalone feature.
 */

import React from 'react';
import CodingChallenge from './CodingChallenge';
import { CodeFeedback } from '../types';

const CodingChallengeExample: React.FC = () => {
  const handleChallengeComplete = (feedback: CodeFeedback) => {
    console.log('Challenge completed with feedback:', feedback);
    
    // You can handle the feedback here:
    // - Store it in session state
    // - Send it to the backend
    // - Navigate to next question
    // - Show a success message
    
    if (feedback.isCorrect) {
      console.log('All tests passed! Code quality:', feedback.geminiAnalysis.codeQuality);
    } else {
      console.log('Some tests failed. Review the feedback.');
    }
    
    // Handle follow-up questions if any
    if (feedback.followUpQuestions && feedback.followUpQuestions.length > 0) {
      console.log('Follow-up questions:', feedback.followUpQuestions);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Coding Challenge</h1>
      <p>Complete the coding challenge below for the selected role.</p>
      
      <CodingChallenge
        role="Software Engineer" // Can be: "AI/ML", "Cloud", "Cybersecurity", "Software Engineer"
        onComplete={handleChallengeComplete}
        sessionId="optional-session-id" // Optional: link to interview session
      />
    </div>
  );
};

export default CodingChallengeExample;

/**
 * Integration with InterviewPage:
 * 
 * You can conditionally render the CodingChallenge component when:
 * 1. The current question category is 'coding'
 * 2. The job role requires technical assessment
 * 
 * Example:
 * 
 * {currentQuestion?.category === 'coding' && (
 *   <CodingChallenge
 *     role={jobRole}
 *     onComplete={(feedback) => {
 *       // Store feedback in session
 *       // Move to next question
 *     }}
 *     sessionId={sessionId}
 *   />
 * )}
 */
