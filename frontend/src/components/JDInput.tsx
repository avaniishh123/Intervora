import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/JDInput.css';

interface LocationState {
  role: string;
  mode: string;
  duration: number;
}

const JDInput = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, mode, duration } = (location.state as LocationState) || {};

  const [jobDescription, setJobDescription] = useState<string>('');
  const [error, setError] = useState<string>('');

  const maxCharacters = 5000;
  const characterCount = jobDescription.length;
  const isValid = characterCount > 0 && characterCount <= maxCharacters;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    if (value.length <= maxCharacters) {
      setJobDescription(value);
      setError('');
    } else {
      setError(`Job description cannot exceed ${maxCharacters} characters`);
    }
  };

  const handleContinue = () => {
    if (!isValid) {
      setError('Please enter a job description');
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError('Job description is too short. Please provide more details (at least 50 characters)');
      return;
    }

    // Navigate to interview page with JD data
    navigate('/interview', {
      state: {
        role,
        mode,
        jobDescription,
        duration,
      },
    });
  };

  const handleBack = () => {
    navigate('/interview/setup', { state: { role, mode, duration } });
  };

  const handlePasteSample = () => {
    const sampleJD = `We are seeking a talented ${role} to join our dynamic team. 

Key Responsibilities:
- Design, develop, and maintain high-quality software applications
- Collaborate with cross-functional teams to define and implement new features
- Write clean, maintainable, and efficient code
- Participate in code reviews and provide constructive feedback
- Troubleshoot and debug applications
- Stay up-to-date with emerging technologies and industry trends

Required Qualifications:
- Bachelor's degree in Computer Science or related field
- 3+ years of professional software development experience
- Strong problem-solving and analytical skills
- Excellent communication and teamwork abilities
- Experience with modern development tools and practices

Preferred Skills:
- Experience with cloud platforms (AWS, Azure, or GCP)
- Knowledge of CI/CD pipelines
- Familiarity with Agile methodologies
- Strong understanding of software design patterns`;

    setJobDescription(sampleJD);
    setError('');
  };

  return (
    <div className="jd-input-container">
      <div className="jd-input-card">
        <div className="jd-header">
          <h1>Job Description</h1>
          <p>Paste the job description to get tailored interview questions</p>
        </div>

        <div className="jd-content">
          <div className="jd-info">
            <div className="info-item">
              <span className="info-icon">💼</span>
              <div>
                <h3>Role-Specific Questions</h3>
                <p>Get interview questions tailored to the job requirements</p>
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">🎯</span>
              <div>
                <h3>Targeted Preparation</h3>
                <p>Focus on the skills and experience mentioned in the JD</p>
              </div>
            </div>
          </div>

          <div className="jd-form">
            <div className="form-header">
              <label htmlFor="job-description">Job Description</label>
              <button onClick={handlePasteSample} className="sample-button">
                Use Sample JD
              </button>
            </div>

            <textarea
              id="job-description"
              className={`jd-textarea ${error ? 'error' : ''}`}
              placeholder="Paste the job description here...

Include:
• Job title and responsibilities
• Required qualifications and skills
• Preferred experience
• Company information (optional)"
              value={jobDescription}
              onChange={handleInputChange}
              rows={15}
            />

            <div className="jd-footer">
              <div className="character-count">
                <span className={characterCount > maxCharacters ? 'error' : ''}>
                  {characterCount.toLocaleString()} / {maxCharacters.toLocaleString()}
                </span>
                <span className="count-label">characters</span>
              </div>
              {error && <div className="error-message">{error}</div>}
            </div>
          </div>
        </div>

        <div className="jd-actions">
          <button onClick={handleBack} className="back-button">
            Back
          </button>
          <button
            onClick={handleContinue}
            className="continue-button"
            disabled={!isValid}
          >
            Continue to Interview
          </button>
        </div>
      </div>
    </div>
  );
};

export default JDInput;
