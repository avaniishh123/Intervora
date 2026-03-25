import { appendFileSync } from 'fs';
const T = 'frontend/src/pages/CompanyInterviewPage.tsx';

appendFileSync(T, `
  const handleEnd = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionEnded(true); setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    voice.cancelSpeech(); voice.stopListening();
    setMessages(prev => [...prev, { from: 'system', text: 'The interview has concluded. Thank you for your time.', timestamp: Date.now() }]);
    cameraStream?.getTracks().forEach(t => t.stop());
    setTimeout(() => {
      navigate('/interview/report', {
        state: { sessionId: String(sessionId ?? ''), role: String(role), mode: 'company' },
      });
    }, 3000);
  }, [sessionId, role, navigate, cameraStream, voice]);

  const handleEndRef = useRef(handleEnd);
  useEffect(() => { handleEndRef.current = handleEnd; }, [handleEnd]);

  useEffect(() => {
    if (!timerActive) return;
    timerRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleEndRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  const fetchCompanyQuestion = useCallback(async (panelId: string): Promise<string> => {
    const companyName = selectedCompany ? selectedCompany.name : 'a top tech company';
    try {
      const res = await api.post('/api/gemini/company-questions', {
        company: companyName, role, interviewerType: panelId,
        conversationHistory: conversationHistoryRef.current.slice(-6), count: 1,
      });
      const questions: string[] = res.data?.data?.questions ?? [];
      return questions[0] ?? getFallbackQuestion(panelId, role);
    } catch { return getFallbackQuestion(panelId, role); }
  }, [selectedCompany, role]);

  const askNextQuestion = useCallback((panelId: string) => {
    setActiveSpeaker(panelId); setIsThinking(true);
    fetchCompanyQuestion(panelId).then(questionText => {
      setIsThinking(false);
      setMessages(m => [...m, { from: panelId, text: questionText, timestamp: Date.now() }]);
      conversationHistoryRef.current.push({ role: panelId, text: questionText });
      setActiveSpeaker(panelId);
      voice.speakAs(panelId, questionText, () => {
        setActiveSpeaker(null);
        if (voice.responseMode === 'voice') {
          setTimeout(() => { voice.clearTranscript(); voice.startListening(); }, 300);
        } else { setTimeout(() => answerRef.current?.focus(), 200); }
      });
    });
  }, [fetchCompanyQuestion, voice]);

  useEffect(() => {
    if (!sessionStarted) return;
    const companyName = selectedCompany ? selectedCompany.name : 'the company';
    const welcomeText = 'Welcome to your ' + companyName + ' interview for the ' + role + ' role. You will be interviewed by ' + PANEL.map(p => p.name).join(', ') + '. Answer each question thoroughly. Good luck!';
    setMessages([{ from: 'system', text: welcomeText, timestamp: Date.now() }]);
    setTimeout(() => askNextQuestion('tech'), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted]);

  const handleSubmitAnswer = useCallback(() => {
    const text = answer.trim();
    if (!text || sessionEnded) return;
    if (voice.responseMode === 'voice') { voice.stopListening(); voice.clearTranscript(); }
    setMessages(prev => [...prev, { from: 'candidate', text, timestamp: Date.now() }]);
    conversationHistoryRef.current.push({ role: 'candidate', text });
    setAnswer('');
    const newCount = questionCount + 1;
    setQuestionCount(newCount);
    if (newCount >= totalQuestions) { setTimeout(() => handleEndRef.current(), 800); return; }
    const shouldCross = Math.random() < 0.25;
    const nextPanelIdx = (currentPanel + 1) % PANEL.length;
    if (shouldCross) {
      const crosserId = PANEL[(currentPanel + 1 + Math.floor(Math.random() * 2)) % PANEL.length].id;
      const crossQ = getCrossQuestion(crosserId);
      setActiveSpeaker(crosserId); setIsThinking(true);
      setTimeout(() => {
        setIsThinking(false);
        setMessages(prev => [...prev, { from: crosserId, text: crossQ, timestamp: Date.now(), isCross: true }]);
        conversationHistoryRef.current.push({ role: crosserId, text: crossQ });
        setActiveSpeaker(crosserId);
        voice.speakAs(crosserId, crossQ, () => {
          setActiveSpeaker(null);
          if (voice.responseMode === 'voice') {
            setTimeout(() => { voice.clearTranscript(); voice.startListening(); }, 300);
          } else { setTimeout(() => answerRef.current?.focus(), 200); }
        });
      }, 900 + Math.random() * 500);
    } else { setCurrentPanel(nextPanelIdx); setTimeout(() => askNextQuestion(PANEL[nextPanelIdx].id), 800); }
  }, [answer, sessionEnded, currentPanel, questionCount, totalQuestions, askNextQuestion, voice]);

  const handleToggleResponseMode = useCallback((mode: ResponseMode) => {
    voice.setResponseMode(mode); setAnswer('');
    if (mode === 'voice' && !voice.isSpeaking) { voice.clearTranscript(); voice.startListening(); }
  }, [voice]);

  const handleMicToggle = useCallback(() => {
    if (voice.isListening) voice.stopListening();
    else { voice.clearTranscript(); voice.startListening(); }
  }, [voice]);

  const handleShareScreen = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      setScreenShared(true);
    } catch { /* user cancelled */ }
  }, []);

  const handleEnterFullscreen = useCallback(async () => {
    try { await document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    catch { setIsFullscreen(true); }
  }, []);

  const formatTime = (s: number) =>
    String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  const timerPct   = Math.round((timeRemaining / (duration * 60)) * 100);
  const timerColor = timeRemaining > 120 ? '#3b82f6' : timeRemaining > 60 ? '#f59e0b' : '#ef4444';
  const filteredCompanies = COMPANIES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activePanelMember = PANEL.find(p => p.id === (voice.activeVoiceSpeaker || activeSpeaker));
  const companyColor = selectedCompany ? selectedCompany.color : '#3b82f6';
  const companyName  = selectedCompany ? selectedCompany.name  : '';
`, 'utf8');
console.log('Part 3 written');
