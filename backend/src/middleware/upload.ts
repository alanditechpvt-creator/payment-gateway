import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { config } from '../config';
import { storageService } from '../services/storage.service';

// Ensure temp upload directory exists
const tempUploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Configure multer storage for temporary files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random hash
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const fieldName = file.fieldname;
    cb(null, `${fieldName}-${timestamp}-${hash}${ext}`);
  },
});

// File filter for allowed types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimes.join(', ')}`));
  }
};

// Create multer instance with configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize || 5 * 1024 * 1024, // Default 5MB
    files: 5, // Max 5 files per request
  },
});

// Helper to process uploaded files through storage service
export async function processUploadedFiles(
  files: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined,
  userId: string
): Promise<{ [fieldname: string]: string }> {
  const result: { [fieldname: string]: string } = {};
  
  if (!files) return result;
  
  // Handle array of files
  if (Array.isArray(files)) {
    for (const file of files) {
      const category = getFileCategory(file.fieldname);
      const saved = await storageService.saveUploadedFile(file, userId, category);
      result[file.fieldname] = saved.path;
    }
  } else {
    // Handle object of files by fieldname
    for (const [fieldname, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const category = getFileCategory(fieldname);
        const saved = await storageService.saveUploadedFile(file, userId, category);
        result[fieldname] = saved.path;
      }
    }
  }
  
  return result;
}

// Determine file category from fieldname
function getFileCategory(fieldname: string): 'PROFILE_PHOTO' | 'AADHAAR' | 'PAN' | 'DOCUMENTS' | 'TRANSACTIONS' | 'OTHER' {
  const fieldLower = fieldname.toLowerCase();
  
  if (fieldLower.includes('profile') || fieldLower.includes('photo') || fieldLower.includes('avatar')) {
    return 'PROFILE_PHOTO';
  }
  if (fieldLower.includes('aadhaar') || fieldLower.includes('aadhar')) {
    return 'AADHAAR';
  }
  if (fieldLower.includes('pan')) {
    return 'PAN';
  }
  if (fieldLower.includes('document') || fieldLower.includes('doc')) {
    return 'DOCUMENTS';
  }
  if (fieldLower.includes('transaction') || fieldLower.includes('receipt')) {
    return 'TRANSACTIONS';
  }
  
  return 'OTHER';
}

// Cleanup temp files periodically
export function cleanupTempFiles(maxAgeMs: number = 3600000) { // Default 1 hour
  if (!fs.existsSync(tempUploadDir)) return;
  
  const now = Date.now();
  const files = fs.readdirSync(tempUploadDir);
  
  let cleaned = 0;
  for (const file of files) {
    const filePath = path.join(tempUploadDir, file);
    const stat = fs.statSync(filePath);
    
    if (now - stat.mtimeMs > maxAgeMs) {
      try {
        fs.unlinkSync(filePath);
        cleaned++;
      } catch (e) {
        // Ignore
      }
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Upload] Cleaned up ${cleaned} temp files`);
  }
}

// Run cleanup every hour
setInterval(() => cleanupTempFiles(), 3600000);

export default upload;

