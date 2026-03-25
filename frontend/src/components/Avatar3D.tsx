import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Avatar animation states
export type AvatarState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'celebrating';

interface AvatarMeshProps {
  state: AvatarState;
  isSpeaking: boolean;
  audioLevel?: number;
}

// Eye component for facial expressions
function Eye({ position, state }: { position: [number, number, number]; state: AvatarState }) {
  const eyeRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!eyeRef.current) return;

    // Blinking animation
    const blinkCycle = Math.sin(Date.now() * 0.003);
    if (blinkCycle > 0.95) {
      eyeRef.current.scale.y = 0.1;
    } else {
      eyeRef.current.scale.y = 1;
    }

    // Eye expressions based on state
    if (state === 'thinking') {
      eyeRef.current.scale.x = 0.8;
    } else if (state === 'celebrating') {
      eyeRef.current.scale.set(1.2, 1.2, 1);
    } else {
      eyeRef.current.scale.x = 1;
    }
  });

  return (
    <mesh ref={eyeRef} position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color="#000000" />
    </mesh>
  );
}

// Mouth component that animates with speech
function Mouth({ state, isSpeaking, audioLevel = 0 }: { state: AvatarState; isSpeaking: boolean; audioLevel?: number }) {
  const mouthRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!mouthRef.current) return;

    if (isSpeaking) {
      // Animate mouth based on audio level or default animation
      const openAmount = audioLevel > 0 ? audioLevel * 0.3 : Math.abs(Math.sin(Date.now() * 0.01)) * 0.2;
      mouthRef.current.scale.y = 0.5 + openAmount;
    } else {
      // Closed or slight smile
      mouthRef.current.scale.y = state === 'celebrating' ? 0.8 : 0.3;
    }

    // Mouth shape based on state
    if (state === 'celebrating') {
      mouthRef.current.scale.x = 1.5;
    } else if (state === 'thinking') {
      mouthRef.current.scale.x = 0.8;
    } else {
      mouthRef.current.scale.x = 1;
    }
  });

  return (
    <mesh ref={mouthRef} position={[0, -0.3, 0.5]}>
      <boxGeometry args={[0.3, 0.1, 0.1]} />
      <meshStandardMaterial color="#ff6b6b" />
    </mesh>
  );
}

// The actual 3D avatar mesh component with enhanced expressions
function AvatarMesh({ state, isSpeaking, audioLevel }: AvatarMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const [hue, setHue] = useState(0);
  const [transitionProgress, setTransitionProgress] = useState(1);

  // Smooth state transitions
  useEffect(() => {
    setTransitionProgress(0);
    const timer = setTimeout(() => setTransitionProgress(1), 500);
    return () => clearTimeout(timer);
  }, [state]);

  // Animation loop
  useFrame((_, delta) => {
    if (!groupRef.current || !headRef.current) return;

    // Smooth transition
    const progress = Math.min(transitionProgress + delta * 2, 1);
    setTransitionProgress(progress);

    // Different animations based on state
    switch (state) {
      case 'idle':
        // Gentle floating animation
        groupRef.current.rotation.y += delta * 0.3;
        groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.1;
        headRef.current.rotation.x = Math.sin(Date.now() * 0.002) * 0.05;
        break;

      case 'speaking':
        // More active rotation and slight head bobbing
        groupRef.current.rotation.y += delta * 0.6;
        headRef.current.rotation.x = Math.sin(Date.now() * 0.005) * 0.1;
        headRef.current.rotation.z = Math.sin(Date.now() * 0.004) * 0.05;
        
        // Slight scaling with speech
        const speakScale = 1 + (audioLevel || Math.sin(Date.now() * 0.01)) * 0.03;
        headRef.current.scale.set(speakScale, speakScale, speakScale);
        break;

      case 'listening':
        // Slow, attentive movement - slight head tilt
        groupRef.current.rotation.y += delta * 0.2;
        headRef.current.rotation.z = Math.sin(Date.now() * 0.002) * 0.08;
        headRef.current.rotation.x = -0.1; // Slight forward tilt
        break;

      case 'thinking':
        // Tilted, contemplative pose
        groupRef.current.rotation.y += delta * 0.4;
        headRef.current.rotation.x = Math.sin(Date.now() * 0.002) * 0.15 + 0.2;
        headRef.current.rotation.z = 0.15; // Tilt to side
        break;

      case 'celebrating':
        // Energetic spinning and bouncing
        groupRef.current.rotation.y += delta * 2.5;
        groupRef.current.position.y = Math.abs(Math.sin(Date.now() * 0.006)) * 0.6;
        headRef.current.rotation.x = Math.sin(Date.now() * 0.008) * 0.2;
        setHue((prev) => (prev + delta * 120) % 360);
        break;
    }
  });

  // Color changes based on state
  const getColor = () => {
    switch (state) {
      case 'speaking':
        return '#4CAF50'; // Green
      case 'listening':
        return '#2196F3'; // Blue
      case 'thinking':
        return '#FF9800'; // Orange
      case 'celebrating':
        return `hsl(${hue}, 70%, 50%)`; // Rainbow
      default:
        return '#9C27B0'; // Purple (idle)
    }
  };

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Head */}
      <mesh ref={headRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={getColor()} />
      </mesh>

      {/* Eyes */}
      <Eye position={[-0.25, 0.15, 0.5]} state={state} />
      <Eye position={[0.25, 0.15, 0.5]} state={state} />

      {/* Mouth */}
      <Mouth state={state} isSpeaking={isSpeaking} audioLevel={audioLevel} />

      {/* Body - simple representation */}
      <mesh position={[0, -1.2, 0]}>
        <boxGeometry args={[0.8, 1, 0.6]} />
        <meshStandardMaterial color={getColor()} opacity={0.8} transparent />
      </mesh>

      {/* Arms - celebrating gesture */}
      {state === 'celebrating' && (
        <>
          <mesh position={[-0.6, -0.8, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.2, 0.8, 0.2]} />
            <meshStandardMaterial color={getColor()} />
          </mesh>
          <mesh position={[0.6, -0.8, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.2, 0.8, 0.2]} />
            <meshStandardMaterial color={getColor()} />
          </mesh>
        </>
      )}
    </group>
  );
}

interface Avatar3DProps {
  state?: AvatarState;
  enableControls?: boolean;
  className?: string;
  showStateBadge?: boolean;
  audioElement?: HTMLAudioElement | null;
  onStateChange?: (state: AvatarState) => void;
}

// Main Avatar3D component
export default function Avatar3D({ 
  state = 'idle', 
  enableControls = true,
  className = '',
  showStateBadge = true,
  audioElement = null,
  onStateChange
}: Avatar3DProps) {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  // Set up audio analysis for speech synchronization
  useEffect(() => {
    if (!audioElement) {
      setIsSpeaking(false);
      return;
    }

    // Create audio context and analyser
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaElementSource(audioElement);
      
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Analyze audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedLevel = average / 255;
        
        setAudioLevel(normalizedLevel);
        setIsSpeaking(normalizedLevel > 0.01);

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();

      // Listen for audio events
      const handlePlay = () => setIsSpeaking(true);
      const handlePause = () => setIsSpeaking(false);
      const handleEnded = () => setIsSpeaking(false);

      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('ended', handleEnded);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('ended', handleEnded);
        audioContext.close();
      };
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  }, [audioElement]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  return (
    <div className={`avatar-3d-container ${className}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {showStateBadge && (
        <div className={`avatar-state-badge ${state}`}>
          {state}
        </div>
      )}
      
      <Canvas>
        {/* Camera setup */}
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        <spotLight position={[0, 10, 0]} angle={0.3} penumbra={1} intensity={0.5} />

        {/* Avatar mesh */}
        <AvatarMesh state={state} isSpeaking={isSpeaking} audioLevel={audioLevel} />

        {/* Camera controls */}
        {enableControls && (
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={3}
            maxDistance={10}
            maxPolarAngle={Math.PI / 2}
          />
        )}
      </Canvas>
    </div>
  );
}
