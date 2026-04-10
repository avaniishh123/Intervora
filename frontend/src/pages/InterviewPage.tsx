import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVoiceMode } from '../hooks/useVoiceMode';
import Avatar3D from '../components/Avatar3D';
import CameraPreview from '../components/CameraPreview';
import QuestionDisplay from '../components/QuestionDisplay';
import AnswerInput from '../components/AnswerInput';
import Timer from '../components/Timer';
import MentorModeToggle from '../components/MentorModeToggle';
import ResponseModeModal from '../components/ResponseModeModal';
import InterviewProctoringOverlay from '../components/InterviewProctoringOverlay';
import { useInterviewProctor } from '../hooks/useInterviewProctor';
import { useProctoringNotifications } from '../hooks/useProctoringNotifications';
import { useInterviewMedia } from '../hooks/useInterviewMedia';
import socketService, {
  QuestionNewData,
  EvaluationResultData,
  ScoreUpdateData,
  SessionCompletedData,
  NotificationData,
} from '../services/socket';
import { Question } from '../types';
import api from '../services/api';
import '../styles/InterviewPage.css';

export default function InterviewPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    stream,
    isStreamReady,
    streamError,
    isRecording,
    recordingDuration,
    startCompositeWithStream,
    stopRecording,
    avatarState,
    setAvatarState,
    audioElement,
    transcript,
    isTranscribing
  } = useInterviewMedia({
    autoStartRecording: false,
    enableTranscription: true
  });

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_totalQuestionsForSession] = useState(0); // kept for legacy compat

  // Duration-based timer state (NEW)
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(15 * 60); // default 15 min
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(15 * 60);
  const [sessionTimerActive, setSessionTimerActive] = useState(false);
  const [closingMessageShown, setClosingMessageShown] = useState(false);
  const sessionTimerRef = useRef<number | null>(null);
  const closingMessageRef = useRef(false);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Progress state (question index only, no fixed total)
  const [answeredQuestions, setAnsweredQuestions] = useState(0);

  // Notification state
  const [notification, setNotification] = useState<NotificationData | null>(null);

  // Mentor mode state
  const [mentorModeEnabled, setMentorModeEnabled] = useState(false);

  // Answer panel resize state
  const [answerPanelHeight, setAnswerPanelHeight] = useState(300); // Default height in pixels
  const [isResizing, setIsResizing] = useState(false);

  // Voice input state — tracks whether candidate mic is open
  // (mirrors voiceMode.isListening, kept for legacy notification calls)
  const [_isListeningToVoice, setIsListeningToVoice] = useState(false);

  // Stable ref so the voice mode silence callback always calls the latest submit
  const handleSubmitAnswerRef = useRef<() => void>(() => {});

  // ── Robust voice mode with strict turn-taking (AI speaks first, then mic opens) ──
  const voiceMode = useVoiceMode({
    onLiveTranscript: (text) => {
      // Update answer box in real-time only while candidate is speaking
      if (responseMode === 'voice') {
        setCurrentAnswer(text);
      }
    },
    // No onSilenceDetected — candidate must submit explicitly
  });

  // Session creation state
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Response mode selection state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseMode, setResponseMode] = useState<'chat' | 'voice' | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<Question | null>(null);

  // ── Interview proctoring: screen-share first, then fullscreen ──────────────
  const { proctoringState, screenShareError, requestScreenShare, enterFullscreen, dismissWarning, maxWarnings } = useInterviewProctor({
    enabled: true,
    maxWarnings: 3,
    onScreenShareGranted: (screenStream: MediaStream) => {
      console.log('✅ Proctoring: screen share granted — starting composite recording');
      // Start composite recording immediately with the obtained screen stream
      startCompositeWithStream(screenStream);
    },
    onFullscreenGranted: () => {
      console.log('✅ Proctoring: fullscreen granted, interview may proceed');
    },
    onTerminate: () => {
      console.warn('🚫 Proctoring: max violations reached — auto-terminating session');
      setTimeout(() => {
        handleAutoEndSession();
      }, 3000);
    },
  });

  // ── Browser notification layer (additive — does not touch modal logic) ─────
  useProctoringNotifications({
    warningCount: proctoringState.warningCount,
    maxWarnings,
    enabled: proctoringState.phase !== 'requesting-screen-share' && proctoringState.phase !== 'requesting-fullscreen',
  });

  // Ensure we have a valid token before doing anything else
  useEffect(() => {
    let cancelled = false;

    const ensureValidAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!accessToken || !refreshToken) {
        setNotification({
          type: 'error',
          message: 'Please sign in to continue.',
        });
        setTimeout(() => navigate('/login'), 1200);
        return;
      }

      try {
        // Quick profile check to verify token
        await api.get('/auth/profile');
        if (!cancelled) {
          setAuthReady(true);
        }
      } catch (error: any) {
        try {
          const refreshResponse = await api.post('/auth/refresh', { refreshToken });
          const { accessToken: newAccessToken } = refreshResponse.data.data || refreshResponse.data;

          if (newAccessToken) {
            localStorage.setItem('accessToken', newAccessToken);
            if (!cancelled) {
              setAuthReady(true);
            }
          } else {
            throw new Error('No token returned');
          }
        } catch (refreshError) {
          if (!cancelled) {
            setNotification({
              type: 'error',
              message: 'Session expired. Please sign in again.',
            });
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setTimeout(() => navigate('/login'), 1500);
          }
        }
      }
    };

    ensureValidAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Get session ID from location state or query params, or create new session
  useEffect(() => {
    if (!authReady) return;

    const stateSessionId = (location.state as any)?.sessionId;
    const queryParams = new URLSearchParams(location.search);
    const querySessionId = queryParams.get('sessionId');
    
    const id = stateSessionId || querySessionId;
    if (id) {
      setSessionId(id);
    } else {
      // No session ID provided, need to create a new session
      const role = (location.state as any)?.role;
      const mode = (location.state as any)?.mode;
      const jobDescription = (location.state as any)?.jobDescription;
      const duration = (location.state as any)?.duration || 15; // Default 15 minutes
      
      // Set session timer based on selected duration
      const durationSecs = duration * 60;
      setSessionDurationSeconds(durationSecs);
      setSessionTimeRemaining(durationSecs);
      
      // Keep totalQuestionsForSession for legacy compat (not shown in UI)
      
      if (!role || !mode) {
        console.error('No session ID and missing role/mode. Redirecting to setup.');
        navigate('/interview/setup');
        return;
      }
      
      // Create new session inline to avoid dependency issues
      const createSession = async () => {
        try {
          setIsCreatingSession(true);
          console.log('Creating new session:', { role, mode, duration, jobDescription: jobDescription ? 'provided' : 'none' });
          
          const response = await api.post('/api/sessions/start', {
            jobRole: role,
            mode,
            mentorModeEnabled: false,
            jobDescription: jobDescription || undefined,
            resumeUsed: false,
            duration: duration * 60 // Convert minutes to seconds
          });

          if (response.data.status === 'success' && response.data.data.session) {
            const newSessionId = response.data.data.session._id;
            console.log('✅ Session created successfully:', newSessionId);
            setSessionId(newSessionId);
          } else {
            throw new Error('Failed to create session');
          }
        } catch (error: any) {
          console.error('❌ Error creating session:', error);
          setNotification({
            type: 'error',
            message: error.response?.data?.message || 'Failed to create interview session. Please try again.',
          });
          
          // Redirect back to setup after a delay
          setTimeout(() => {
            navigate('/interview/setup');
          }, 3000);
        } finally {
          setIsCreatingSession(false);
        }
      };
      
      createSession();
    }
  }, [location, navigate, authReady]);

  // Connect to Socket.io when component mounts
  useEffect(() => {
    if (!authReady) return;

    let mounted = true;

    const connectWithValidToken = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        
        if (!token) {
          console.error('❌ No access token found');
          setNotification({
            type: 'error',
            message: 'Please sign in to continue.',
          });
          setTimeout(() => navigate('/login'), 1500);
          return;
        }

        console.log('🔌 Connecting to interview socket...');

        // Connect to interview namespace
        socketService.connectInterview(token);

        // Set up event listeners
        socketService.onConnect(() => {
          console.log('✅ Connected to interview socket');
          if (mounted) {
            setIsConnected(true);
          }
        });

        socketService.onDisconnect(() => {
          console.log('🔌 Disconnected from interview socket');
          if (mounted) {
            setIsConnected(false);
          }
        });

        socketService.onConnectionError((error) => {
          console.error('❌ Socket connection error:', error);
          if (mounted) {
            // Only redirect on authentication errors, not connection errors
            if (error.message && error.message.includes('Authentication error')) {
              console.error('❌ Authentication error - token invalid');
              setNotification({
                type: 'error',
                message: 'Session expired. Please sign in again.',
              });
              // Clear tokens and redirect
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setTimeout(() => navigate('/login'), 2000);
            } else {
              // For other errors, just show notification but don't redirect
              console.warn('⚠️ Connection error (not auth related)');
              setNotification({
                type: 'warning',
                message: 'Connection issue. Retrying...',
              });
            }
          }
        });
      } catch (error: any) {
        console.error('❌ Error in connectWithValidToken:', error);
        // Don't redirect on general errors, only on auth errors
        if (mounted) {
          setNotification({
            type: 'error',
            message: 'Connection failed. Please check your internet.',
          });
        }
      }
    };

    connectWithValidToken();

    // Clean up on unmount
    return () => {
      mounted = false;
      socketService.removeAllInterviewListeners();
      socketService.disconnectInterview();
    };
  }, [navigate, authReady]);

  // Set up interview event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Listen for new questions
    socketService.onQuestionNew((data: QuestionNewData) => {
      console.log('📥 New question received:', data);

      // UNIVERSAL END-OF-SESSION RULE: block new questions when ≤10s remain
      if (closingMessageRef.current) {
        console.log('🚫 Closing mode active — ignoring new question from server');
        return;
      }
      
      const question: Question = {
        id: data.questionId,
        text: data.text,
        category: data.category as any,
        difficulty: data.difficulty as any,
        expectedKeywords: [],
        timeLimit: data.timeLimit,
      };

      // Store pending question and show response mode modal
      setPendingQuestion(question);
      setShowResponseModal(true);
      setResponseMode(null);
      setCurrentAnswer('');
      setIsEvaluating(false);
      setAvatarState('speaking');
      
      // Show notification
      setNotification({
        type: 'info',
        message: 'New question received - Choose your response method',
      });
    });

    // Listen for evaluation results
    socketService.onEvaluationResult((data: EvaluationResultData) => {
      console.log('📥 Evaluation result received:', data);
      
      // Clear evaluation timeout since we got a result
      if ((window as any).evaluationTimeoutId) {
        clearTimeout((window as any).evaluationTimeoutId);
        (window as any).evaluationTimeoutId = null;
      }
      
      setIsEvaluating(false);
      setAvatarState('idle');
      
      // Show feedback notification with appreciation
      const feedbackMessage = data.appreciation 
        ? `${data.appreciation} - Score: ${data.score}/100`
        : `Score: ${data.score}/100 - ${data.feedback.substring(0, 100)}`;
      
      setNotification({
        type: 'success',
        message: feedbackMessage,
      });

      // Automatically move to next question after showing feedback
      // UNIVERSAL END-OF-SESSION RULE: block follow-up questions when closing mode is active
      if (data.followUpQuestion && !closingMessageRef.current) {
        // Show feedback for 2 seconds, then transition to next question
        setTimeout(() => {
          // Double-check closing mode hasn't activated during the delay
          if (closingMessageRef.current) {
            console.log('🚫 Closing mode activated during delay — suppressing follow-up question');
            return;
          }
          const followUp: Question = {
            id: data.followUpQuestion!.questionId,
            text: data.followUpQuestion!.text,
            category: data.followUpQuestion!.category as any,
            difficulty: data.followUpQuestion!.difficulty as any,
            expectedKeywords: [],
            timeLimit: data.followUpQuestion!.timeLimit,
          };
          
          // Clear previous answer and set new question
          setCurrentAnswer('');
          setCurrentQuestion(followUp);
          setAvatarState('speaking');
          
          // Update progress
          setAnsweredQuestions(prev => prev + 1);
          
          // Show notification for new question
          setNotification({
            type: 'info',
            message: 'Moving to next question...',
          });
        }, 2000); // 2 second delay for user to read feedback
      }
    });

    // Listen for score updates
    socketService.onScoreUpdate((data: ScoreUpdateData) => {
      console.log('📥 Score update received:', data);
      
      // Update answered questions count
      setAnsweredQuestions(data.answeredQuestions);
    });

    // Listen for session completion
    socketService.onSessionCompleted((data: SessionCompletedData) => {
      console.log('📥 Session completed:', data);
      
      setAvatarState('celebrating');
      
      setNotification({
        type: 'success',
        message: 'Interview completed! Redirecting to results...',
      });

      // Navigate to results page after a delay
      setTimeout(() => {
        navigate(`/results?sessionId=${data.sessionId}`);
      }, 3000);
    });

    // Listen for notifications
    socketService.onNotification((data: NotificationData) => {
      console.log('📥 Notification received:', data);
      setNotification(data);
    });

    // Clean up listeners
    return () => {
      socketService.removeAllInterviewListeners();
    };
  }, [isConnected, navigate, setAvatarState]);

  // Auto-start session when everything is ready
  // Note: recording is started by the screen-share callback in the proctoring flow,
  // not here — so we don't call startRecording() in this effect.
  useEffect(() => {
    if (isConnected && sessionId && !sessionStarted && isStreamReady) {
      const timer = setTimeout(() => {
        console.log('🚀 Auto-starting session:', sessionId);
        setSessionStarted(true);

        // Start the session-level countdown timer
        setSessionTimerActive(true);

        setAvatarState('listening');
        socketService.startSession(sessionId);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isConnected, sessionId, sessionStarted, isStreamReady, setAvatarState]);

  // Session-level countdown timer (drives the whole interview duration)
  useEffect(() => {
    if (!sessionTimerActive || !sessionStarted) return;

    sessionTimerRef.current = window.setInterval(() => {
      setSessionTimeRemaining(prev => {
        const next = prev - 1;

        // Trigger closing message at 10-12 seconds remaining
        if (next <= 12 && next >= 10 && !closingMessageRef.current) {
          closingMessageRef.current = true;
          setClosingMessageShown(true);
          setAvatarState('speaking');
          // Clear any active question so no new input is possible
          setCurrentQuestion(null);
          setCurrentAnswer('');
          setIsEvaluating(false);
          setShowResponseModal(false);
          // Speak the closing message via TTS
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(
              'We have come to the end of this session. You can check your report after the session ends. Thank you for attending the session.'
            );
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
          }
        }

        // Timer reached zero — auto-end the interview
        if (next <= 0) {
          if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [sessionTimerActive, sessionStarted, setAvatarState]);

  // Auto-end session when timer expires
  const handleAutoEndSession = useCallback(async () => {
    if (!sessionId) return;
    setSessionTimerActive(false);
    setIsEvaluating(false);
    setAvatarState('celebrating');
    setCurrentQuestion(null);
    setCurrentAnswer('');

    if ((window as any).evaluationTimeoutId) {
      clearTimeout((window as any).evaluationTimeoutId);
      (window as any).evaluationTimeoutId = null;
    }

    // Stop recording and upload the blob (only for timer-completed sessions)
    let recordingUrl: string | undefined;
    let uploadAttempts = 0;
    const MAX_UPLOAD_ATTEMPTS = 3;

    const attemptUpload = async (): Promise<string | undefined> => {
      try {
        const recording = await stopRecording();
        if (!recording?.blob || recording.blob.size === 0) {
          console.warn('⚠️ Recording blob is empty — skipping upload');
          return undefined;
        }
        console.log(`📦 Recording blob: ${(recording.blob.size / 1024).toFixed(1)} KB, type: ${recording.blob.type}`);

        // ── Persist blob locally for immediate download fallback ──
        const ext = recording.blob.type.includes('mp4') ? 'mp4' : 'webm';
        try {
          const blobUrl = URL.createObjectURL(recording.blob);
          sessionStorage.setItem(`recording_blob_${sessionId}`, blobUrl);
          sessionStorage.setItem(`recording_ext_${sessionId}`, ext);
          console.log('💾 Recording blob stored in sessionStorage for local download');
        } catch (storageErr) {
          console.warn('⚠️ Could not store blob URL in sessionStorage:', storageErr);
        }

        // Use FormData (multipart) — avoids JSON body size limits entirely
        const formData = new FormData();
        formData.append('recording', recording.blob, `session-${sessionId}.${ext}`);

        const token = localStorage.getItem('accessToken');
        const backendBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const uploadRes = await fetch(`${backendBase}/api/sessions/${sessionId}/upload-recording`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(`Upload HTTP ${uploadRes.status}: ${errText}`);
        }

        const uploadJson = await uploadRes.json();
        const url = uploadJson.data?.recordingUrl;
        if (!url) throw new Error('No recordingUrl in upload response');
        console.log('✅ Recording uploaded via FormData:', url);
        return url;
      } catch (err) {
        uploadAttempts++;
        console.warn(`⚠️ Recording upload attempt ${uploadAttempts}/${MAX_UPLOAD_ATTEMPTS} failed:`, err);
        if (uploadAttempts < MAX_UPLOAD_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 1500));
          return attemptUpload();
        }
        return undefined;
      }
    };

    recordingUrl = await attemptUpload();

    // Complete the session — wait for this to finish before navigating
    let completeAttempts = 0;
    const MAX_COMPLETE_ATTEMPTS = 3;
    const attemptComplete = async (): Promise<void> => {
      try {
        await api.post(`/api/sessions/${sessionId}/complete`, { recordingUrl });
        console.log('✅ Session completed on backend, recordingUrl saved:', recordingUrl);
      } catch (err) {
        completeAttempts++;
        console.warn(`⚠️ Session complete attempt ${completeAttempts}/${MAX_COMPLETE_ATTEMPTS} failed:`, err);
        if (completeAttempts < MAX_COMPLETE_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 1000));
          return attemptComplete();
        }
      }
    };

    await attemptComplete();

    socketService.endSession(sessionId);

    // Navigate only after both upload and complete have resolved
    navigate(`/interview/report?sessionId=${sessionId}`);
  }, [sessionId, stopRecording, navigate, setAvatarState]);

  // When timer hits zero, auto-end the session
  useEffect(() => {
    if (sessionTimeRemaining === 0 && sessionStarted && sessionTimerActive) {
      console.log('⏰ Session timer expired — auto-ending interview');
      handleAutoEndSession();
    }
  }, [sessionTimeRemaining, sessionStarted, sessionTimerActive, handleAutoEndSession]);

  // Format session time remaining as MM:SS
  const formatSessionTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle response mode selection
  const handleResponseModeSelect = useCallback((mode: 'chat' | 'voice') => {
    console.log(`📝 Response mode selected: ${mode}`);
    
    setResponseMode(mode);
    setShowResponseModal(false);
    
    // Set the pending question as current
    if (pendingQuestion) {
      setCurrentQuestion(pendingQuestion);
      setPendingQuestion(null);
    }
    
    if (mode === 'chat') {
      // Focus the text input for chat mode
      setNotification({
        type: 'success',
        message: 'Chat mode activated - Type your answer below',
      });
      
      // Focus the answer input after a brief delay
      setTimeout(() => {
        const textarea = document.querySelector('.answer-textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
        }
      }, 300);
      
      setAvatarState('listening');
    } else if (mode === 'voice') {
      if (!voiceMode.isSupported) {
        setNotification({
          type: 'warning',
          message: 'Voice not supported in this browser — using text mode instead.',
        });
        setAvatarState('listening');
        return;
      }

      // AI is about to speak the question via TTS — block mic until TTS ends.
      // Mic opens automatically via onSpeechEnd wired on QuestionDisplay.
      voiceMode.setAiSpeaking(true);
      voiceMode.start(); // queued — won't open mic until setAiSpeaking(false)

      setNotification({
        type: 'info',
        message: 'AI Interviewer is speaking — mic opens when done',
      });
      setAvatarState('speaking');
    }
  }, [pendingQuestion, setAvatarState]);

  // Format recording duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle answer submission
  const handleSubmitAnswer = useCallback(() => {
    if (!currentQuestion || !currentAnswer.trim() || !sessionId) {
      return;
    }    console.log('📤 Submitting answer:', {
      sessionId,
      questionId: currentQuestion.id,
      answerLength: currentAnswer.length,
    });

    // Emit answer submission event with question context for DB persistence
    socketService.submitAnswer(
      sessionId,
      currentQuestion.id,
      currentAnswer,
      currentQuestion.text,
      currentQuestion.category,
      (currentQuestion as any).topic
    );

    // Update UI state immediately
    setIsEvaluating(true);
    setAvatarState('thinking');

    setNotification({
      type: 'info',
      message: 'Analyzing your response...',
    });

    // Add timeout to prevent infinite evaluating state
    const evaluationTimeout = setTimeout(() => {
      console.warn('⚠️ Evaluation timeout reached (20s), forcing reset');
      setIsEvaluating(false);
      setAvatarState('idle');
      setNotification({
        type: 'warning',
        message: 'Evaluation took longer than expected. Moving to next question...',
      });
      
      // Auto-generate a fallback question to keep interview flowing
      const fallbackQuestion: Question = {
        id: `fallback_${Date.now()}`,
        text: 'Tell me about a challenging project you worked on and how you approached it.',
        category: 'behavioral',
        difficulty: 'medium',
        expectedKeywords: [],
        timeLimit: 180,
      };
      
      setTimeout(() => {
        setCurrentQuestion(fallbackQuestion);
        setCurrentAnswer('');
        setAvatarState('speaking');
      }, 1500);
    }, 20000); // 20 second timeout

    // Store timeout ID to clear it if evaluation completes normally
    (window as any).evaluationTimeoutId = evaluationTimeout;
  }, [currentQuestion, currentAnswer, sessionId, setAvatarState]);

  // Keep the ref in sync so the voice silence callback always has the latest version
  useEffect(() => {
    handleSubmitAnswerRef.current = handleSubmitAnswer;
  }, [handleSubmitAnswer]);

  // Handle session end (manual)
  const handleEndSession = async () => {
    if (!sessionId) return;

    console.log('🏁 Ending interview session...');

    // STEP 4: Cancel any in-flight evaluation request
    if ((window as any).evaluationTimeoutId) {
      clearTimeout((window as any).evaluationTimeoutId);
      (window as any).evaluationTimeoutId = null;
    }

    // STEP 4: Reset evaluating state immediately
    setIsEvaluating(false);
    setAvatarState('celebrating');

    // STEP 4: Reset interview state
    setCurrentQuestion(null);
    setCurrentAnswer('');
    voiceMode.stop();
    setNotification({
      type: 'info',
      message: 'Ending session...',
    });

    // Stop session timer
    setSessionTimerActive(false);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);

    try {
      const recording = await stopRecording();
      
      if (recording) {
        console.log('Recording saved:', {
          size: recording.size,
          duration: recording.duration,
          url: recording.url
        });
        
        // TODO: Upload recording to server
        // await uploadRecording(recording.blob, sessionId, API_BASE_URL);
      }

      // Emit session end event
      socketService.endSession(sessionId);

      // Complete the session on the backend so the performance report is generated
      try {
        await api.post(`/api/sessions/${sessionId}/complete`, {});
        console.log('✅ Session completed on backend');
      } catch (err) {
        console.warn('⚠️ Could not complete session on backend:', err);
      }

      // Navigate to report page
      setTimeout(() => {
        navigate(`/interview/report?sessionId=${sessionId}`);
      }, 2000);

    } catch (error) {
      console.error('Error ending session:', error);
      // Still redirect even if there's an error
      setTimeout(() => {
        navigate(`/interview/report?sessionId=${sessionId}`);
      }, 1000);
    }
  };

  // Handle timer expiration
  const handleTimerExpire = useCallback(() => {
    console.log('⏰ Timer expired, auto-submitting answer');
    handleSubmitAnswer();
  }, [handleSubmitAnswer]);

  // Handle panel resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new height based on mouse position from bottom of viewport
      const newHeight = window.innerHeight - e.clientY;
      
      // Apply min/max constraints
      const minHeight = 200; // Minimum 200px
      const maxHeight = window.innerHeight - 300; // Leave at least 300px for question area
      
      const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      setAnswerPanelHeight(constrainedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Stop voice mic when evaluation starts or mode changes away from voice
  useEffect(() => {
    if (isEvaluating || responseMode !== 'voice') {
      voiceMode.stop();
      setIsListeningToVoice(false);
    }
  }, [isEvaluating, responseMode]);

  // When a new question arrives in voice mode, signal AI is speaking so mic stays blocked.
  // The mic will open via onSpeechEnd callback on QuestionDisplay once TTS finishes.
  useEffect(() => {
    if (responseMode === 'voice' && currentQuestion && !isEvaluating) {
      voiceMode.reset();
      setCurrentAnswer('');
      setIsListeningToVoice(false);
      // Block mic — TTS is about to start for the new question
      voiceMode.setAiSpeaking(true);
      voiceMode.start(); // queued until setAiSpeaking(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

  return (
    <div className="interview-page">
      {/* Interview Proctoring Overlay — screen-share gate → fullscreen gate → violation warnings */}
      <InterviewProctoringOverlay
        state={proctoringState}
        maxWarnings={maxWarnings}
        screenShareError={screenShareError}
        onRequestScreenShare={requestScreenShare}
        onEnterFullscreen={enterFullscreen}
        onDismissWarning={dismissWarning}
      />

      {/* Response Mode Selection Modal */}
      <ResponseModeModal
        isOpen={showResponseModal}
        onSelectMode={handleResponseModeSelect}
        autoSelectAfter={15}
        questionNumber={answeredQuestions + 1}
      />

      {/* Fixed Header */}
      <header className="interview-header">
        <div className="header-left">
          <h1 className="interview-title">AI Interview Session</h1>
        </div>
        <div className="header-right">
          {/* Session countdown timer synced with recording indicator */}
          <div className={`recording-indicator ${sessionTimeRemaining <= 30 ? 'recording-warning' : ''}`}>
            <span className="recording-dot"></span>
            <span className="recording-text">
              {isRecording ? `REC ${formatDuration(recordingDuration)}` : 'Session'}
            </span>
            <span className="session-countdown">
              {formatSessionTime(sessionTimeRemaining)}
            </span>
          </div>
          <MentorModeToggle
            isEnabled={mentorModeEnabled}
            onToggle={setMentorModeEnabled}
            showTips={false}
            compact={true}
          />
          {notification && (
            <div className={`header-notification notification-${notification.type}`}>
              <span className="notification-icon">
                {notification.type === 'success' && '✓'}
                {notification.type === 'error' && '✗'}
                {notification.type === 'warning' && '⚠'}
                {notification.type === 'info' && 'ℹ'}
              </span>
              <span className="notification-message">{notification.message}</span>
              <button
                className="notification-close"
                onClick={() => setNotification(null)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Interview Area - Two Column Layout */}
      <main className="interview-main">
        {/* LEFT SIDE - Primary Focus (65%) */}
        <section className="interview-left">
          {/* Question Card - Always at Top Left */}
          {currentQuestion && sessionStarted && (
            <div className="question-card">
              {/* Closing message overlay */}
              {closingMessageShown && (
                <div className="closing-message-banner">
                  <span className="closing-icon">🎙️</span>
                  <span>We have come to the end of this session. You can check your report after the session ends. Thank you for attending the session.</span>
                </div>
              )}
              <QuestionDisplay
                question={currentQuestion}
                currentQuestionNumber={answeredQuestions + 1}
                totalQuestions={0}
                enableTextToSpeech={true}
                onSpeechEnd={() => {
                  // TTS finished — if in voice mode, unblock mic and start listening
                  if (responseMode === 'voice') {
                    voiceMode.setAiSpeaking(false);
                    setIsListeningToVoice(true);
                    setAvatarState('listening');
                    setNotification({
                      type: 'success',
                      message: 'Your turn — speak your answer, then press Submit',
                    });
                  }
                }}
              />
              {/* Per-question answer timer */}
              {currentQuestion && (
                <div className="question-timer">
                  <Timer
                    duration={currentQuestion.timeLimit}
                    onTimeUp={handleTimerExpire}
                    isActive={!isEvaluating}
                    warningThreshold={10}
                    showProgress={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Time-based session progress bar */}
          {sessionStarted && (
            <div className="progress-section">
              <div className="session-progress-bar-wrapper">
                <div className="session-progress-label">
                  <span>Session Progress</span>
                  <span className={`session-time-left ${sessionTimeRemaining <= 60 ? 'time-critical' : sessionTimeRemaining <= 180 ? 'time-warning' : ''}`}>
                    {formatSessionTime(sessionTimeRemaining)} remaining
                  </span>
                </div>
                <div className="session-progress-track">
                  <div
                    className="session-progress-fill"
                    style={{
                      width: `${Math.max(0, ((sessionDurationSeconds - sessionTimeRemaining) / sessionDurationSeconds) * 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Initialization Message */}
          {!sessionStarted && (
            <div className="initialization-card">
              <div className="init-content">
                <div className="init-icon">🤖</div>
                <div className="init-message">
                  {isCreatingSession && 'Creating your interview session...'}
                  {!sessionId && !isCreatingSession && 'Initializing interview environment...'}
                  {sessionId && !isConnected && 'Connecting to AI interviewer...'}
                  {sessionId && isConnected && !isStreamReady && streamError && (
                    <>
                      <div>Camera/Microphone access required</div>
                      <div className="init-submessage">{streamError.message}</div>
                      <button
                        onClick={() => window.location.reload()}
                        className="retry-button"
                      >
                        Retry Permissions
                      </button>
                    </>
                  )}
                  {sessionId && isConnected && !isStreamReady && !streamError && 'Requesting camera/microphone access...'}
                  {sessionId && isConnected && isStreamReady && 'Starting your interview session...'}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT SIDE - Secondary (35%) */}
        <aside className="interview-right">
          {/* Camera Preview */}
          <div className="camera-section">
            <CameraPreview
              stream={stream}
              manageOwnStream={false}
              onStreamReady={(mediaStream) => {
                console.log('Stream ready from CameraPreview:', mediaStream);
              }}
              onError={(error) => {
                console.error('Camera error:', error);
                setNotification({
                  type: 'error',
                  message: 'Failed to access camera/microphone. Please check permissions.',
                });
              }}
              showControls={true}
            />
          </div>

          {/* AI Interviewer Avatar */}
          <div className="avatar-section">
            <div className="avatar-header">
              <h3 className="avatar-title">AI Interviewer</h3>
              <div className={`avatar-status status-${avatarState}`}>
                {avatarState === 'speaking' && '🗣️ Speaking'}
                {avatarState === 'listening' && '👂 Listening'}
                {avatarState === 'thinking' && '🤔 Thinking'}
                {avatarState === 'idle' && '😊 Ready'}
                {avatarState === 'celebrating' && '🎉 Great job!'}
              </div>
            </div>
            <Avatar3D
              state={avatarState}
              enableControls={false}
              showStateBadge={false}
              audioElement={audioElement}
            />
          </div>

          {/* Session Timer */}
          {sessionStarted && (
            <div className="countdown-section">
              <div className="session-timer">
                <span className="timer-label">Time Remaining:</span>
                <span className={`timer-value ${sessionTimeRemaining <= 60 ? 'time-critical' : sessionTimeRemaining <= 180 ? 'time-warning' : ''}`}>
                  {formatSessionTime(sessionTimeRemaining)}
                </span>
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Fixed Bottom Answer Section */}
      {sessionStarted && currentQuestion && (
        <footer 
          className={`answer-section resizable ${isResizing ? 'resizing' : ''}`}
          style={{ height: `${answerPanelHeight}px` }}
        >
          {/* Resize Handle */}
          <div 
            className="resize-handle"
            onMouseDown={handleResizeStart}
            title="Drag to resize panel"
          >
            <div className="resize-handle-bar"></div>
          </div>

          <div className="answer-section-inner">
            <div className="answer-container">
              {/* Response Mode Indicator */}
              {responseMode && (
                <div className={`response-mode-indicator mode-${responseMode}${responseMode === 'voice' && voiceMode.isAiSpeaking ? ' mode-ai-speaking' : ''}`}>
                  <span className="mode-icon">
                    {responseMode === 'voice'
                      ? (voiceMode.isAiSpeaking ? '🔊' : '🎤')
                      : '💬'}
                  </span>
                  <span className="mode-text">
                    {responseMode === 'voice'
                      ? (voiceMode.isAiSpeaking
                          ? 'AI Speaking — mic blocked'
                          : voiceMode.isListening
                            ? 'Listening — speak your answer'
                            : 'Voice Mode Active')
                      : 'Chat Mode Active'}
                  </span>
                  {responseMode === 'voice' && voiceMode.isListening && (
                    <span className="listening-pulse"></span>
                  )}
                </div>
              )}

              {/* Answer Input — primary focus */}
              <div className="answer-input-wrapper">
                <AnswerInput
                  value={currentAnswer}
                  onChange={setCurrentAnswer}
                  disabled={isEvaluating}
                  placeholder={
                    mentorModeEnabled
                      ? 'Structure your answer using Context-Action-Result framework...'
                      : 'Type your answer here or speak into the microphone...'
                  }
                  maxLength={5000}
                />
              </div>

              {/* Controls row */}
              <div className="answer-actions">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={isEvaluating || !currentAnswer.trim()}
                  className="submit-button primary"
                >
                  {isEvaluating ? (
                    <>
                      <span className="loading-spinner"></span>
                      Evaluating...
                    </>
                  ) : (
                    'Submit Answer'
                  )}
                </button>
                
                <button
                  onClick={handleEndSession}
                  className="end-button secondary"
                >
                  End Interview
                </button>
              </div>

              {/* Live Transcription — below controls, never overlapping */}
              {isTranscribing && transcript && (
                <div className="transcript-section">
                  <div className="transcript-header">
                    <span className="transcript-icon">🎤</span>
                    <span className="transcript-title">Live Transcript</span>
                  </div>
                  <div className="transcript-content">
                    {transcript}
                  </div>
                </div>
              )}
              {/* Voice mode error fallback */}
              {responseMode === 'voice' && voiceMode.error && (
                <div className="voice-error-banner">
                  <span>⚠️ {voiceMode.error} — you can still type your answer above.</span>
                </div>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Error Banner */}
      {streamError && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{streamError.message}</span>
          <button onClick={() => window.location.reload()} className="error-retry">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
