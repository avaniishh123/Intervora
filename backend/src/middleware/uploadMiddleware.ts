import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import config from '../config/env';

/**
 * Ensure upload directories exist
 */
const ensureUploadDirectories = () => {
  const uploadDir = config.uploadDir;
  const resumesDir = path.join(uploadDir, 'resumes');
  const recordingsDir = path.join(uploadDir, 'recordings');

  [uploadDir, resumesDir, recordingsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

// Initialize directories
ensureUploadDirectories();

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const resumesDir = path.join(config.uploadDir, 'resumes');
    cb(null, resumesDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename using UUID
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const filename = `${uniqueId}${fileExtension}`;
    cb(null, filename);
  }
});

/**
 * File filter to validate file types
 * Enhanced security: validates both MIME type and file extension
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  // Allowed file types
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Validate MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(
      new Error(
        'Invalid file type. Only PDF, DOC, and DOCX files are allowed.'
      )
    );
    return;
  }

  // Validate file extension
  if (!allowedExtensions.includes(fileExtension)) {
    cb(
      new Error(
        'Invalid file extension. Only .pdf, .doc, and .docx extensions are allowed.'
      )
    );
    return;
  }

  // Additional security: check for double extensions (e.g., file.pdf.exe)
  const filename = file.originalname.toLowerCase();
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.js', '.php', '.asp', '.jsp'];
  const hasSuspiciousExtension = suspiciousExtensions.some(ext => filename.includes(ext));
  
  if (hasSuspiciousExtension) {
    cb(
      new Error(
        'Suspicious file detected. File contains potentially dangerous extensions.'
      )
    );
    return;
  }

  cb(null, true);
};

/**
 * Configure multer storage for recordings (separate from resume storage)
 */
const recordingStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const recordingsDir = path.join(config.uploadDir, 'recordings');
    // Ensure directory exists
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    cb(null, recordingsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const sessionId = req.params.id || uuidv4();
    const ext = path.extname(file.originalname) || '.webm';
    const filename = `${sessionId}_${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

/**
 * Multer upload for session recordings — 500MB limit, video files only
 */
export const uploadRecording = multer({
  storage: recordingStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/webm', 'video/mp4', 'video/ogg', 'application/octet-stream'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported recording MIME type: ${file.mimetype}`));
    }
  }
});


/**
 * Multer upload configuration (for resumes)
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize // 5MB default
  }
});

/**
 * Middleware to handle multer errors
 */
export const handleUploadError = (err: any, _req: Request, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: `File size exceeds the limit of ${config.maxFileSize / (1024 * 1024)}MB`
      });
    }
    return res.status(400).json({
      status: 'error',
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
  next();
};

export default upload;
