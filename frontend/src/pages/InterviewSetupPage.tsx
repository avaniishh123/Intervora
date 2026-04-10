import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoleCategoryToggle, { RoleCategory } from '../components/RoleCategoryToggle';
import { NON_TECHNICAL_ROLES } from '../data/nonTechnicalRoles';
import '../styles/InterviewSetup.css';

type InterviewMode = 'resume-based' | 'jd-based' | 'general' | 'simulation' | 'panel' | 'company';

const TECHNICAL_ROLES = [
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

const InterviewSetupPage = () => {
  const navigate = useNavigate();
  const [roleCategory, setRoleCategory] = useState<RoleCategory>('technical');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<InterviewMode | ''>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(15); // Default 15 minutes

  // Switch category → reset role & mode so stale selections don't carry over
  const handleCategoryChange = (cat: RoleCategory) => {
    setRoleCategory(cat);
    setSelectedRole('');
    setSelectedMode('');
  };

  const jobRoles =
    roleCategory === 'technical'
      ? TECHNICAL_ROLES
      : NON_TECHNICAL_ROLES.map(r => r.label);

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
      description: roleCategory === 'technical'
        ? 'Practice with general interview questions for your selected role'
        : 'Practice with behavioural, situational, and role-specific questions',
      icon: '🎯',
    },
    {
      value: 'simulation' as InterviewMode,
      label: 'Simulation-Based Interview',
      description: roleCategory === 'technical'
        ? 'Real-world role-specific tasks: coding challenges, incident analysis, architecture reviews, and more'
        : 'Real-world case studies, scenario analysis, and role-specific challenges',
      icon: roleCategory === 'technical' ? '🧪' : '📋',
    },
    {
      value: 'panel' as InterviewMode,
      label: 'Mock Panel Interview',
      description: roleCategory === 'technical'
        ? 'Face a panel of AI interviewers — Technical Lead, Hiring Manager & HR — with cross-questioning and pressure-driven evaluation'
        : 'Face a panel of AI interviewers — Hiring Manager, Senior Leader & HR — with cross-questioning and pressure-driven evaluation',
      icon: '👥',
    },
    {
      value: 'company' as InterviewMode,
      label: 'Company-Specific Interview',
      description: 'Target a company archetype (product, service, startup) for tailored question patterns and evaluation styles',
      icon: '🏢',
    },
  ];

  // For non-technical roles, filter modes to only those the selected role supports
  const selectedRoleMeta = roleCategory === 'non-technical'
    ? NON_TECHNICAL_ROLES.find(r => r.label === selectedRole)
    : null;

  const visibleModes = selectedRoleMeta
    ? interviewModes.filter(m => selectedRoleMeta.supportedModes.includes(m.value))
    : interviewModes;

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

            {/* Technical / Non-Technical toggle */}
            <div className="role-category-row">
              <RoleCategoryToggle value={roleCategory} onChange={handleCategoryChange} />
              {selectedRoleMeta && (
                <div className="role-focus-areas">
                  {selectedRoleMeta.focusAreas.map(area => (
                    <span key={area} className="focus-chip">{area}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <select
                value={selectedRole}
                onChange={(e) => { setSelectedRole(e.target.value); setSelectedMode(''); }}
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
              {visibleModes.map((mode) => (
                <div
                  key={mode.value}
                  className={`mode-card ${selectedMode === mode.value ? 'selected' : ''}`}
                  data-mode={mode.value}
                  data-category={roleCategory}
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
