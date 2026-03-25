/**
 * useTurnGate — manages the Turn Gate state machine.
 *
 * States:
 *   locked   → question is being delivered (mic + input disabled)
 *   open     → candidate may answer (mic + input enabled)
 *   submitted → answer sent (mic + input disabled until next question)
 *
 * Integrates with useVoiceMode via setAiSpeaking:
 *   lock()   → setAiSpeaking(true)
 *   open()   → setAiSpeaking(false)
 */
import { useState, useCallback, useRef } from 'react';
import { TurnGateState } from '../types/hybrid.types';

interface UseTurnGateOptions {
  /** Called when gate opens — pass useVoiceMode.setAiSpeaking */
  onOpen?: () => void;
  /** Called when gate locks */
  onLock?: () => void;
}

export function useTurnGate({ onOpen, onLock }: UseTurnGateOptions = {}) {
  const [state, setState] = useState<TurnGateState>('locked');
  const stateRef = useRef<TurnGateState>('locked');

  const lock = useCallback(() => {
    stateRef.current = 'locked';
    setState('locked');
    onLock?.();
  }, [onLock]);

  const open = useCallback(() => {
    stateRef.current = 'open';
    setState('open');
    onOpen?.();
  }, [onOpen]);

  const submit = useCallback(() => {
    stateRef.current = 'submitted';
    setState('submitted');
  }, []);

  const reset = useCallback(() => {
    stateRef.current = 'locked';
    setState('locked');
  }, []);

  return { state, stateRef, lock, open, submit, reset };
}
