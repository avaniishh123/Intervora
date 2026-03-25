import { appendFileSync } from 'fs';
const T = 'frontend/src/pages/CompanyInterviewPage.tsx';

appendFileSync(T, `
function questionsForDuration(mins: number): number {
  if (mins <= 5)  return 3;
  if (mins <= 10) return 5;
  if (mins <= 15) return 7;
  if (mins <= 25) return 10;
  return 14;
}

interface Message { from: string; text: string; timestamp: number; isCross?: boolean; }
type Phase = 'select-company' | 'precheck' | 'interview';

export default function CompanyInterviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = ((location.state ?? {}) as Record<string, unknown>);
  const role: string     = typeof locState.role     === 'string' ? locState.role     : 'Software Engineer';
  const duration: number = typeof locState.duration === 'number' ? locState.duration : 15;

  const [phase,           setPhase]           = useState<Phase>('select-company');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [screenShared,    setScreenShared]    = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [sessionId,       setSessionId]       = useState<string | null>(null);
  const [authReady,       setAuthReady]       = useState(false);
  const [sessionStarted,  setSessionStarted]  = useState(false);
  const [timeRemaining,   setTimeRemaining]   = useState(duration * 60);
  const [timerActive,     setTimerActive]     = useState(false);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [answer,          setAnswer]          = useState('');
  const [activeSpeaker,   setActiveSpeaker]   = useState<string | null>(null);
  const [currentPanel,    setCurrentPanel]    = useState(0);
  const [isThinking,      setIsThinking]      = useState(false);
  const [sessionEnded,    setSessionEnded]    = useState(false);
  const [cameraStream,    setCameraStream]    = useState<MediaStream | null>(null);
  const [leftCollapsed,   setLeftCollapsed]   = useState(false);
  const [questionCount,   setQuestionCount]   = useState(0);
  const totalQuestions = questionsForDuration(duration);

  const conversationHistoryRef = useRef<{ role: string; text: string }[]>([]);
  const cameraRef   = useRef<HTMLVideoElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<number | null>(null);
  const answerRef   = useRef<HTMLTextAreaElement>(null);
  const sessionEndedRef = useRef(false);

  const voice = usePanelVoice();

  useEffect(() => {
    if (voice.responseMode === 'voice' && voice.isListening) setAnswer(voice.transcript);
  }, [voice.transcript, voice.responseMode, voice.isListening]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }
    api.get('/auth/profile').then(() => setAuthReady(true)).catch(() => navigate('/login'));
  }, [navigate]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => setCameraStream(s)).catch(() => {});
  }, []);

  useEffect(() => {
    if (cameraRef.current && cameraStream) cameraRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    if (!authReady || phase !== 'interview') return;
    const companyName = selectedCompany ? selectedCompany.name : 'Unknown';
    api.post('/api/sessions', { jobRole: role, mode: 'company', duration, company: companyName })
      .then(res => {
        setSessionId(String(res.data.data?.sessionId || res.data.data?._id || 'company-' + Date.now()));
        setSessionStarted(true); setTimerActive(true);
      })
      .catch(() => { setSessionId('company-' + Date.now()); setSessionStarted(true); setTimerActive(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, phase]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
`, 'utf8');
console.log('Part 2 written');
