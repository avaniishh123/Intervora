import Session from '../models/Session';
import { Readable } from 'stream';

/**
 * Export filter options
 */
export interface ExportFilters {
  userId?: string;
  jobRole?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minScore?: number;
  maxScore?: number;
}

/**
 * Export Service
 * Handles data export functionality for session data
 */
class ExportService {
  /**
   * Convert session data to CSV format
   */
  private sessionToCSVRow(session: any): string {
    const fields = [
      session._id?.toString() || '',
      session.userId?.email || session.userId?.toString() || '',
      session.userId?.profile?.name || '',
      session.jobRole || '',
      session.mode || '',
      session.status || '',
      session.startTime ? new Date(session.startTime).toISOString() : '',
      session.endTime ? new Date(session.endTime).toISOString() : '',
      session.questions?.length || 0,
      session.performanceReport?.overallScore || '',
      session.performanceReport?.categoryScores?.technical || '',
      session.performanceReport?.categoryScores?.behavioral || '',
      session.performanceReport?.categoryScores?.communication || '',
      session.performanceReport?.wordCountMetrics?.average || '',
      session.performanceReport?.sentimentAnalysis?.confidence || '',
      session.performanceReport?.sentimentAnalysis?.clarity || '',
      session.metadata?.mentorModeEnabled ? 'Yes' : 'No',
      session.recordingUrl || '',
      session.transcriptUrl || ''
    ];

    // Escape and quote fields that might contain commas or quotes
    return fields.map(field => {
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    }).join(',');
  }

  /**
   * Get CSV header row
   */
  private getCSVHeader(): string {
    return [
      'Session ID',
      'User Email',
      'User Name',
      'Job Role',
      'Mode',
      'Status',
      'Start Time',
      'End Time',
      'Questions Count',
      'Overall Score',
      'Technical Score',
      'Behavioral Score',
      'Communication Score',
      'Avg Word Count',
      'Confidence',
      'Clarity',
      'Mentor Mode',
      'Recording URL',
      'Transcript URL'
    ].join(',');
  }

  /**
   * Build filter query from export filters
   */
  private buildFilterQuery(filters: ExportFilters): any {
    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.jobRole) {
      query.jobRole = { $regex: filters.jobRole, $options: 'i' };
    }

    if (filters.status && ['in-progress', 'completed', 'abandoned'].includes(filters.status)) {
      query.status = filters.status;
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.startTime = {};
      if (filters.startDate) {
        query.startTime.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.startTime.$lte = new Date(filters.endDate);
      }
    }

    // Score range filter
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      query['performanceReport.overallScore'] = {};
      if (filters.minScore !== undefined) {
        query['performanceReport.overallScore'].$gte = filters.minScore;
      }
      if (filters.maxScore !== undefined) {
        query['performanceReport.overallScore'].$lte = filters.maxScore;
      }
    }

    return query;
  }

  /**
   * Export sessions to CSV format
   * Uses streaming to handle large datasets efficiently
   */
  async exportToCSV(filters: ExportFilters): Promise<Readable> {
    try {
      const query = this.buildFilterQuery(filters);

      // Create a readable stream
      const stream = new Readable({
        read() {}
      });

      // Add CSV header
      stream.push(this.getCSVHeader() + '\n');

      // Use cursor for memory-efficient streaming
      const cursor = Session.find(query)
        .populate('userId', 'email profile.name')
        .sort({ startTime: -1 })
        .cursor();

      let count = 0;

      // Process each session
      cursor.on('data', (session: any) => {
        const csvRow = this.sessionToCSVRow(session);
        stream.push(csvRow + '\n');
        count++;
      });

      cursor.on('end', () => {
        stream.push(null); // Signal end of stream
        console.log(`✅ Exported ${count} sessions to CSV`);
      });

      cursor.on('error', (error: Error) => {
        console.error('Error during CSV export:', error);
        stream.destroy(error);
      });

      return stream;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error('Failed to export data to CSV');
    }
  }

  /**
   * Export sessions to JSON format
   * Uses streaming to handle large datasets efficiently
   */
  async exportToJSON(filters: ExportFilters): Promise<Readable> {
    try {
      const query = this.buildFilterQuery(filters);

      // Create a readable stream
      const stream = new Readable({
        read() {}
      });

      // Start JSON array
      stream.push('[\n');

      // Use cursor for memory-efficient streaming
      const cursor = Session.find(query)
        .populate('userId', 'email profile.name')
        .sort({ startTime: -1 })
        .cursor();

      let isFirst = true;
      let count = 0;

      // Process each session
      cursor.on('data', (session: any) => {
        const sessionObj = session.toObject();
        
        // Add comma before each item except the first
        if (!isFirst) {
          stream.push(',\n');
        }
        isFirst = false;

        stream.push(JSON.stringify(sessionObj, null, 2));
        count++;
      });

      cursor.on('end', () => {
        stream.push('\n]'); // Close JSON array
        stream.push(null); // Signal end of stream
        console.log(`✅ Exported ${count} sessions to JSON`);
      });

      cursor.on('error', (error: Error) => {
        console.error('Error during JSON export:', error);
        stream.destroy(error);
      });

      return stream;
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      throw new Error('Failed to export data to JSON');
    }
  }

  /**
   * Get export statistics
   */
  async getExportStats(filters: ExportFilters): Promise<{ count: number; estimatedSize: string }> {
    try {
      const query = this.buildFilterQuery(filters);
      const count = await Session.countDocuments(query);
      
      // Rough estimate: ~2KB per session
      const estimatedBytes = count * 2048;
      const estimatedSize = this.formatBytes(estimatedBytes);

      return { count, estimatedSize };
    } catch (error) {
      console.error('Error getting export stats:', error);
      throw new Error('Failed to get export statistics');
    }
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default new ExportService();
