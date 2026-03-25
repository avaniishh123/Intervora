import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import { ResumeAnalysis } from '../types';
import '../styles/ResumeUploader.css';

interface LocationState {
  role: string;
  mode: string;
}

const ResumeUploaderEnhanced = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, mode } = (location.state as LocationState) || {};
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!token && !refreshToken) {
        // No tokens at all - redirect to login
        console.log('⚠️ No authentication tokens found on mount');
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              from: '/resume-upload',
              message: 'Please login to upload your resume' 
            } 
          });
        }, 1000);
        return;
      }

      // If no access token but have refresh token, try to refresh silently
      if (!token && refreshToken) {
        console.log('🔄 Access token missing on mount, attempting silent refresh...');
        try {
          const refreshResponse = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/refresh`, {
            refreshToken,
          });
          const { accessToken } = refreshResponse.data;
          localStorage.setItem('accessToken', accessToken);
          console.log('✅ Token refreshed successfully on mount');
        } catch (refreshError) {
          console.error('❌ Token refresh failed on mount:', refreshError);
          setTimeout(() => {
            navigate('/login', { 
              state: { 
                from: '/resume-upload',
                message: 'Your session has expired. Please login again.' 
              } 
            });
          }, 1000);
        }
      }
    };

    checkAuth();
  }, [navigate]);

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a PDF, DOC, or DOCX file';
    }
    if (file.size > maxSize) {
      return 'File size must be less than 5MB';
    }
    return null;
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(droppedFile);
      setError('');
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (isRetry: boolean = false) => {
    if (!file) return;

    // Increment retry count if this is a retry
    if (isRetry) {
      setRetryCount(prev => prev + 1);
    } else {
      setRetryCount(0);
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Pre-flight token check and refresh if needed
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!token && !refreshToken) {
        // No tokens at all - redirect to login
        console.log('⚠️ No authentication tokens found');
        navigate('/login', { 
          state: { 
            from: '/resume-upload',
            message: 'Please login to upload your resume' 
          } 
        });
        return;
      }

      // If no access token but have refresh token, try to refresh silently
      if (!token && refreshToken) {
        console.log('🔄 Access token missing, attempting silent refresh...');
        try {
          const refreshResponse = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/refresh`, {
            refreshToken,
          });
          const { accessToken } = refreshResponse.data.data || refreshResponse.data;
          localStorage.setItem('accessToken', accessToken);
          console.log('✅ Token refreshed successfully');
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          navigate('/login', { 
            state: { 
              from: '/resume-upload',
              message: 'Your session has expired. Please login again.' 
            } 
          });
          return;
        }
      }

      const formData = new FormData();
      formData.append('resume', file);

      console.log('📤 Uploading resume with authentication...');

      // Upload resume - axios interceptor will handle token refresh if needed
      const uploadResponse = await api.post('/api/resume/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      console.log('✅ Resume uploaded successfully');
      setUploadProgress(100);

      // Analyze resume with Gemini - this is where it might fail
      console.log('🤖 Analyzing resume with Gemini AI...');
      
      try {
        const analyzeResponse = await api.post('/api/resume/analyze', {
          resumeUrl: uploadResponse.data.data.resumeUrl,
        });

        console.log('✅ Resume analyzed successfully');
        setAnalysis(analyzeResponse.data.data.analysis);
        setRetryCount(0); // Reset retry count on success
      } catch (analyzeError: any) {
        console.error('❌ Resume analysis error:', analyzeError);
        
        // Check if we should retry
        const shouldRetry = retryCount < maxRetries && 
                           (analyzeError.response?.status === 503 || 
                            analyzeError.response?.status === 500 ||
                            analyzeError.code === 'ECONNABORTED');
        
        if (shouldRetry) {
          const waitTime = (retryCount + 1) * 2; // 2, 4, 6 seconds
          setError(`Analysis failed. Retrying in ${waitTime} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          
          // Retry the upload
          return handleUpload(true);
        } else {
          // Max retries reached or non-retryable error
          throw analyzeError;
        }
      }

    } catch (err: any) {
      console.error('❌ Resume upload/analysis error:', err);
      
      // Handle specific error cases
      if (err.response?.status === 401) {
        // Token refresh already attempted by interceptor and failed
        console.log('⚠️ Authentication failed after retry, redirecting to login');
        navigate('/login', { 
          state: { 
            from: '/resume-upload',
            message: 'Your session has expired. Please login again.' 
          } 
        });
      } else if (err.response?.status === 413) {
        setError('File is too large. Please upload a file smaller than 5MB.');
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.message || 'Unable to process resume. Please ensure the file is not corrupted and contains readable text.');
      } else if (err.response?.status === 503) {
        setError('AI analysis service is temporarily unavailable. Please try again in a moment.');
      } else {
        const errorMsg = err.response?.data?.message || 'Failed to upload and analyze resume.';
        const suggestion = err.response?.data?.suggestion || 'Please try again or use a different file format (PDF recommended).';
        setError(`${errorMsg} ${suggestion}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleContinue = async () => {
    if (!analysis) return;

    try {
      setIsUploading(true);
      setError('');

      // Create interview session with resume analysis
      console.log('🎯 Creating interview session with resume data...');
      const sessionResponse = await api.post('/api/sessions/start', {
        jobRole: role || 'Software Engineer',
        mode: 'resume-based',
        mentorModeEnabled: false,
        resumeUsed: true,
        duration: 15, // Default 15 minutes
        resumeAnalysis: analysis
      });

      const session = sessionResponse.data.data.session;
      console.log('✅ Session created:', session._id);

      // Navigate to interview page with session data
      navigate('/interview', {
        state: {
          sessionId: session._id,
          role: role || 'Software Engineer',
          mode: 'resume-based',
          resumeAnalysis: analysis,
          duration: 15
        },
      });
    } catch (err: any) {
      console.error('❌ Failed to create session:', err);
      setError(err.response?.data?.message || 'Failed to start interview session. Please try again.');
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    navigate('/interview/setup', { state: { role, mode } });
  };

  return (
    <div className="resume-uploader-container">
      <div className="resume-uploader-card">
        <div className="uploader-header">
          <h1>Upload Your Resume</h1>
          <p>Upload your resume to get personalized interview questions powered by Gemini AI</p>
        </div>

        {!analysis ? (
          <div className="upload-section">
            {/* Drag and Drop Area */}
            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={handleUploadClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {!file ? (
                <>
                  <div className="drop-icon">📄</div>
                  <h3>Drag and drop your resume here</h3>
                  <p>or click to browse</p>
                  <p className="file-info">Supported formats: PDF, DOC, DOCX (Max 5MB)</p>
                </>
              ) : (
                <>
                  <div className="file-preview">
                    <div className="file-icon">✓</div>
                    <div className="file-details">
                      <h4>{file.name}</h4>
                      <p>{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button
                    className="change-file-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    Change File
                  </button>
                </>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <p>
                  {uploadProgress < 100 
                    ? `Uploading... ${uploadProgress}%` 
                    : 'Analyzing with Gemini AI...'}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="error-message">
                <p>{error}</p>
                {!isUploading && retryCount < maxRetries && (
                  <button 
                    onClick={() => handleUpload(true)} 
                    className="retry-button"
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Retry Analysis
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="upload-actions">
              <button onClick={handleBack} className="back-button" disabled={isUploading}>
                Back
              </button>
              <button
                onClick={handleUpload}
                className="upload-button"
                disabled={!file || isUploading}
              >
                {isUploading ? 'Processing...' : 'Upload & Analyze'}
              </button>
            </div>
          </div>
        ) : (
          <div className="analysis-section">
            {/* Analysis Results */}
            <div className="analysis-results">
              <h2>Resume Analysis Complete</h2>

              {/* Skills */}
              <div className="analysis-card">
                <h3>🎯 Skills Identified</h3>
                <div className="skills-list">
                  {analysis.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Strength Areas */}
              <div className="analysis-card">
                <h3>💪 Strength Areas</h3>
                <ul>
                  {analysis.strengthAreas.map((area, index) => (
                    <li key={index}>{area}</li>
                  ))}
                </ul>
              </div>

              {/* Improvement Areas */}
              <div className="analysis-card">
                <h3>📈 Areas for Improvement</h3>
                <ul>
                  {analysis.improvementAreas.map((area, index) => (
                    <li key={index}>{area}</li>
                  ))}
                </ul>
              </div>

              {/* Suggestions */}
              <div className="analysis-card">
                <h3>💡 Suggestions</h3>
                <ul>
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>

              {/* JD Match Score */}
              {analysis.jdMatchScore !== undefined && (
                <div className="analysis-card match-score">
                  <h3>🎯 Job Match Score</h3>
                  <div className="score-display">
                    <div className="score-circle">
                      <span className="score-value">{analysis.jdMatchScore}%</span>
                    </div>
                    <p>Your resume matches the job requirements</p>
                  </div>
                </div>
              )}
            </div>

            {/* Continue Actions */}
            <div className="analysis-actions">
              <button onClick={handleBack} className="back-button" disabled={isUploading}>
                Upload Different Resume
              </button>
              <button onClick={handleContinue} className="continue-button" disabled={isUploading}>
                {isUploading ? 'Starting Interview...' : 'Continue to Interview'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeUploaderEnhanced;
