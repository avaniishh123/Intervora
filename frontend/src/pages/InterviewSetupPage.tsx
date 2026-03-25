import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/InterviewSetup.css';

type InterviewMode = 'resume-based' | 'jd-based' | 'general' | 'simulation' | 'panel' | 'company';

const InterviewSetupPage = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<InterviewMode | ''>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(15); // Default 15 minutes

  const jobRoles = [
    'Software Engineer',
    'AI/ML Engineer',
    'Cloud Engineer',
    'Cybersecurity Engineer',
    'Data Scientist',
    'DevOps Engineer',
    'Full Stack Developer',
    'Backend Developer',
    'Frontend Developer',
  ];

  const interviewModes = [
    {
      value: 'resume-based' as InterviewMode,
      label: 'Resume-Based Interview',
      description: 'Upload your resume for personalized questions based on your experience',
      icon: '📄',
    },
    {
      value: 'jd-based' as InterviewMode,
      label: 'Job Description-Based Interview',
      description: 'Paste a job description to get role-specific interview questions',
      icon: '💼',
    },
    {
      value: 'general' as InterviewMode,
      label: 'General Interview',
      description: 'Practice with general interview questions for your selected role',
      icon: '🎯',
    },
    {
      value: 'simulation' as InterviewMode,
      label: 'Simulation-Based Interview',
      description: 'Real-world role-specific tasks: coding challenges, incident analysis, architecture reviews, and more',
      icon: '🧪',
    },
    {
      value: 'panel' as InterviewMode,
      label: 'Mock Panel Interview',
      description: 'Face a panel of AI interviewers — Technical Lead, Hiring Manager & HR — with cross-questioning and pressure-driven evaluation',
      icon: '👥',
    },
    {
      value: 'company' as InterviewMode,
      label: 'Company-Specific Interview',
      description: 'Target a company archetype (product, service, startup) for tailored question patterns and evaluation styles',
      icon: '🏢',
    },
  ];

  const handleContinue = () => {
    if (!selectedRole || !selectedMode || !selectedDuration) {
      return;
    }

    // Navigate based on selected mode
    if (selectedMode === 'resume-based') {
      navigate('/interview/setup/resume', { state: { role: selectedRole, mode: selectedMode, duration: selectedDuration } });
    } else if (selectedMode === 'jd-based') {
      navigate('/interview/setup/job-description', { state: { role: selectedRole, mode: selectedMode, duration: selectedDuration } });
    } else if (selectedMode === 'simulation') {
      navigate('/interview/simulation', { state: { role: selectedRole, mode: selectedMode, duration: selectedDuration } });
    } else if (selectedMode === 'panel') {
      navigate('/interview/panel', { state: { role: selectedRole, mode: selectedMode, duration: selectedDuration } });
    } else if (selectedMode === 'company') {
      navigate('/interview/company', { state: { role: selectedRole, mode: selectedMode, duration: selectedDuration } });
    } else {
      // For general mode, create session and go directly to interview
      navigate('/interview', { state: { role: selectedRole, mode: selectedMode, duration: selectedDuration } });
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="interview-setup-container">
      <div className="interview-setup-card">
        <div className="setup-header">
          <h1>Interview Setup</h1>
          <p>Configure your mock interview session</p>
        </div>

        <div className="setup-content">
          {/* Role Selection */}
          <div className="setup-section">
            <h2>1. Select Job Role</h2>
            <p className="section-description">Choose the role you want to practice for</p>
            <div className="form-group">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="role-select"
              >
                <option value="">-- Select a role --</option>
                {jobRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interview Mode Selection */}
          <div className="setup-section">
            <h2>2. Choose Interview Mode</h2>
            <p className="section-description">Select how you want to prepare</p>
            <div className="mode-selection">
              {interviewModes.map((mode) => (
                <div
                  key={mode.value}
                  className={`mode-card ${selectedMode === mode.value ? 'selected' : ''}`}
                  data-mode={mode.value}
                  onClick={() => setSelectedMode(mode.value)}
                >
                  <div className="mode-icon">{mode.icon}</div>
                  <h3>{mode.label}</h3>
                  <p>{mode.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interview Duration Selection */}
          <div className="setup-section">
            <h2>3. Select Interview Duration</h2>
            <p className="section-description">Choose how long you want to practice</p>
            <div className="duration-selection">
              {[5, 10, 15, 25, 40].map((duration) => (
                <div
                  key={duration}
                  className={`duration-card ${selectedDuration === duration ? 'selected' : ''}`}
                  onClick={() => setSelectedDuration(duration)}
                >
                  <div className="duration-time">{duration}</div>
                  <div className="duration-label">minutes</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="setup-actions">
          <button onClick={handleBack} className="back-button">
            Back to Dashboard
          </button>
          <button
            onClick={handleContinue}
            className="continue-button"
            disabled={!selectedRole || !selectedMode || !selectedDuration}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewSetupPage;
