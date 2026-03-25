/**
 * WebRTC Recording Service
 * Handles video/audio recording for interview sessions
 */

export interface RecordingOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

export interface RecordingResult {
  blob: Blob;
  url: string;
  duration: number;
  size: number;
}

export class WebRTCRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;

  constructor(private options: RecordingOptions = {}) {
    // Set default options
    this.options = {
      mimeType: this.getSupportedMimeType(),
      videoBitsPerSecond: 2500000, // 2.5 Mbps
      audioBitsPerSecond: 128000,  // 128 kbps
      ...options
    };
  }

  /**
   * Get the best supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // Fallback
  }

  /**
   * Start recording from the provided media stream
   */
  async startRecording(stream: MediaStream): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      throw new Error('Recording is already in progress');
    }

    this.recordedChunks = [];
    this.startTime = Date.now();

    try {
      this.mediaRecorder = new MediaRecorder(stream, this.options);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
      };

      // Start recording with 1 second timeslice
      this.mediaRecorder.start(1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the recorded data
   */
  async stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      if (this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recording is not active'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = Date.now() - this.startTime;
        const blob = new Blob(this.recordedChunks, {
          type: this.options.mimeType || 'video/webm'
        });
        const url = URL.createObjectURL(blob);

        resolve({
          blob,
          url,
          duration,
          size: blob.size
        });

        // Cleanup
        this.recordedChunks = [];
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause the current recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  /**
   * Resume a paused recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  /**
   * Get the current recording state
   */
  getState(): RecordingState {
    return this.mediaRecorder?.state || 'inactive';
  }

  /**
   * Check if recording is supported
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 
           !!navigator.mediaDevices && 
           !!navigator.mediaDevices.getUserMedia && 
           typeof MediaRecorder !== 'undefined';
  }

  /**
   * Get recording duration in milliseconds
   */
  getDuration(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Cancel recording and discard data
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.recordedChunks = [];
    }
  }
}

/**
 * Upload recorded video to server
 */
export async function uploadRecording(
  blob: Blob,
  sessionId: string,
  apiBaseUrl: string
): Promise<{ recordingUrl: string }> {
  const formData = new FormData();
  formData.append('recording', blob, `session-${sessionId}.webm`);
  formData.append('sessionId', sessionId);

  const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/upload-recording`, {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to upload recording');
  }

  return response.json();
}

/**
 * Generate transcript from audio using Web Speech API
 */
export class TranscriptGenerator {
  private recognition: any = null;
  private transcript: string = '';
  private isListening: boolean = false;

  constructor() {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  /**
   * Start generating transcript
   */
  startTranscription(onTranscript: (text: string, isFinal: boolean) => void): void {
    if (!this.recognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    this.transcript = '';
    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.transcript += finalTranscript;
        onTranscript(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        onTranscript(interimTranscript.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    this.recognition.start();
  }

  /**
   * Stop transcription
   */
  stopTranscription(): string {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
    return this.transcript;
  }

  /**
   * Get current transcript
   */
  getTranscript(): string {
    return this.transcript;
  }

  /**
   * Check if transcription is supported
   */
  static isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
}
