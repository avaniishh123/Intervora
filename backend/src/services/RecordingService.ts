import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * RecordingService - Handles video/audio recording storage and transcript generation
 */
export class RecordingService {
  private recordingsDir: string;
  private transcriptsDir: string;

  constructor() {
    // Use environment variable or default to uploads directory
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.recordingsDir = path.join(uploadDir, 'recordings');
    this.transcriptsDir = path.join(uploadDir, 'transcripts');
    
    // Ensure directories exist
    this.initializeDirectories();
  }

  /**
   * Initialize storage directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
      await fs.mkdir(this.transcriptsDir, { recursive: true });
      console.log('✅ Recording directories initialized');
    } catch (error) {
      console.error('❌ Failed to initialize recording directories:', error);
    }
  }

  /**
   * Save recording file to storage
   * @param fileBuffer - The recording file buffer
   * @param fileExtension - File extension (e.g., 'webm', 'mp4')
   * @param sessionId - Associated session ID
   * @returns URL to access the recording
   */
  async saveRecording(
    fileBuffer: Buffer,
    fileExtension: string,
    sessionId: string
  ): Promise<string> {
    try {
      // Generate unique filename
      const filename = `${sessionId}_${uuidv4()}.${fileExtension}`;
      const filePath = path.join(this.recordingsDir, filename);

      // Save file to disk
      await fs.writeFile(filePath, fileBuffer);

      // Return URL (relative to server)
      const recordingUrl = `/uploads/recordings/${filename}`;
      console.log(`✅ Recording saved: ${recordingUrl}`);
      
      return recordingUrl;
    } catch (error) {
      console.error('❌ Failed to save recording:', error);
      throw new Error('Failed to save recording file');
    }
  }

  /**
   * Save recording from base64 string
   * @param base64Data - Base64 encoded recording data
   * @param fileExtension - File extension
   * @param sessionId - Associated session ID
   * @returns URL to access the recording
   */
  async saveRecordingFromBase64(
    base64Data: string,
    fileExtension: string,
    sessionId: string
  ): Promise<string> {
    try {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:.*?;base64,/, '');
      
      // Convert base64 to buffer
      const fileBuffer = Buffer.from(base64String, 'base64');
      
      return await this.saveRecording(fileBuffer, fileExtension, sessionId);
    } catch (error) {
      console.error('❌ Failed to save recording from base64:', error);
      throw new Error('Failed to save recording from base64');
    }
  }

  /**
   * Generate transcript from text content
   * Note: In a production environment, this would integrate with a speech-to-text service
   * For now, we accept pre-transcribed text from the client (Web Speech API)
   * 
   * @param transcriptText - The transcript text
   * @param sessionId - Associated session ID
   * @returns URL to access the transcript
   */
  async saveTranscript(
    transcriptText: string,
    sessionId: string
  ): Promise<string> {
    try {
      // Generate unique filename
      const filename = `${sessionId}_${uuidv4()}.txt`;
      const filePath = path.join(this.transcriptsDir, filename);

      // Save transcript to disk
      await fs.writeFile(filePath, transcriptText, 'utf-8');

      // Return URL (relative to server)
      const transcriptUrl = `/uploads/transcripts/${filename}`;
      console.log(`✅ Transcript saved: ${transcriptUrl}`);
      
      return transcriptUrl;
    } catch (error) {
      console.error('❌ Failed to save transcript:', error);
      throw new Error('Failed to save transcript file');
    }
  }

  /**
   * Generate structured transcript with timestamps
   * @param transcriptData - Array of transcript entries with timestamps
   * @param sessionId - Associated session ID
   * @returns URL to access the transcript
   */
  async saveStructuredTranscript(
    transcriptData: Array<{
      timestamp: number;
      speaker: 'interviewer' | 'candidate';
      text: string;
    }>,
    sessionId: string
  ): Promise<string> {
    try {
      // Format transcript with timestamps
      let formattedTranscript = 'Interview Transcript\n';
      formattedTranscript += '='.repeat(50) + '\n\n';

      transcriptData.forEach((entry) => {
        const time = this.formatTimestamp(entry.timestamp);
        const speaker = entry.speaker === 'interviewer' ? 'Interviewer' : 'Candidate';
        formattedTranscript += `[${time}] ${speaker}: ${entry.text}\n\n`;
      });

      return await this.saveTranscript(formattedTranscript, sessionId);
    } catch (error) {
      console.error('❌ Failed to save structured transcript:', error);
      throw new Error('Failed to save structured transcript');
    }
  }

  /**
   * Format timestamp in MM:SS format
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Delete recording file
   * @param recordingUrl - URL of the recording to delete
   */
  async deleteRecording(recordingUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = path.basename(recordingUrl);
      const filePath = path.join(this.recordingsDir, filename);

      // Check if file exists
      await fs.access(filePath);

      // Delete file
      await fs.unlink(filePath);
      console.log(`✅ Recording deleted: ${recordingUrl}`);
    } catch (error) {
      console.error('❌ Failed to delete recording:', error);
      // Don't throw error if file doesn't exist
    }
  }

  /**
   * Delete transcript file
   * @param transcriptUrl - URL of the transcript to delete
   */
  async deleteTranscript(transcriptUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = path.basename(transcriptUrl);
      const filePath = path.join(this.transcriptsDir, filename);

      // Check if file exists
      await fs.access(filePath);

      // Delete file
      await fs.unlink(filePath);
      console.log(`✅ Transcript deleted: ${transcriptUrl}`);
    } catch (error) {
      console.error('❌ Failed to delete transcript:', error);
      // Don't throw error if file doesn't exist
    }
  }

  /**
   * Get recording file path
   * @param recordingUrl - URL of the recording
   * @returns Absolute file path
   */
  getRecordingPath(recordingUrl: string): string {
    const filename = path.basename(recordingUrl);
    return path.join(this.recordingsDir, filename);
  }

  /**
   * Get transcript file path
   * @param transcriptUrl - URL of the transcript
   * @returns Absolute file path
   */
  getTranscriptPath(transcriptUrl: string): string {
    const filename = path.basename(transcriptUrl);
    return path.join(this.transcriptsDir, filename);
  }

  /**
   * Check if recording exists
   * @param recordingUrl - URL of the recording
   * @returns True if recording exists
   */
  async recordingExists(recordingUrl: string): Promise<boolean> {
    try {
      const filePath = this.getRecordingPath(recordingUrl);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if transcript exists
   * @param transcriptUrl - URL of the transcript
   * @returns True if transcript exists
   */
  async transcriptExists(transcriptUrl: string): Promise<boolean> {
    try {
      const filePath = this.getTranscriptPath(transcriptUrl);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const recordingService = new RecordingService();
export default recordingService;
