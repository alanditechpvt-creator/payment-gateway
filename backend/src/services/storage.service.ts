import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '../config';

// Storage configuration
export interface StorageConfig {
  provider: 'local' | 's3' | 'azure' | 'gcs';
  localPath: string;
  // Cloud storage configs (to be used when needed)
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  azure?: {
    containerName: string;
    connectionString: string;
  };
  gcs?: {
    bucket: string;
    projectId: string;
    keyFilename: string;
  };
  // Optimization settings
  imageCompression: boolean;
  maxImageWidth: number;
  maxImageHeight: number;
  imageQuality: number;
  // Cache settings
  cacheDuration: number; // in seconds
}

const defaultConfig: StorageConfig = {
  provider: 'local',
  localPath: path.join(process.cwd(), 'uploads'),
  imageCompression: true,
  maxImageWidth: 1920,
  maxImageHeight: 1920,
  imageQuality: 80,
  cacheDuration: 86400 * 30, // 30 days
};

// File type categories for organized storage
const FILE_CATEGORIES = {
  PROFILE_PHOTO: 'profiles',
  AADHAAR: 'kyc/aadhaar',
  PAN: 'kyc/pan',
  DOCUMENTS: 'documents',
  TRANSACTIONS: 'transactions',
  OTHER: 'other',
};

export const storageService = {
  config: defaultConfig,
  
  /**
   * Initialize storage service with configuration
   */
  init(customConfig?: Partial<StorageConfig>) {
    this.config = { ...defaultConfig, ...customConfig };
    
    // Ensure base upload directory exists
    if (this.config.provider === 'local') {
      this.ensureDirectoryExists(this.config.localPath);
    }
    
    console.log(`[Storage] Initialized with provider: ${this.config.provider}`);
  },
  
  /**
   * Generate organized file path based on date and user
   * Structure: uploads/{category}/{year}/{month}/{userId}/{filename}
   */
  generateFilePath(userId: string, category: keyof typeof FILE_CATEGORIES, originalFilename: string): string {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Generate unique filename with hash
    const ext = path.extname(originalFilename).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const filename = `${timestamp}-${hash}${ext}`;
    
    // Create organized path
    const categoryPath = FILE_CATEGORIES[category] || FILE_CATEGORIES.OTHER;
    const relativePath = path.join(categoryPath, year, month, userId, filename);
    
    return relativePath;
  },
  
  /**
   * Ensure directory exists, create if not
   */
  ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  },
  
  /**
   * Save file with optimization
   */
  async saveFile(
    buffer: Buffer,
    userId: string,
    category: keyof typeof FILE_CATEGORIES,
    originalFilename: string,
    mimeType: string
  ): Promise<{ path: string; size: number; optimized: boolean }> {
    const relativePath = this.generateFilePath(userId, category, originalFilename);
    const fullPath = path.join(this.config.localPath, relativePath);
    
    // Ensure directory exists
    this.ensureDirectoryExists(path.dirname(fullPath));
    
    let finalBuffer = buffer;
    let optimized = false;
    
    // Optimize images if enabled
    if (this.config.imageCompression && this.isImage(mimeType)) {
      try {
        finalBuffer = await this.optimizeImage(buffer, mimeType);
        optimized = true;
      } catch (error) {
        console.warn('[Storage] Image optimization failed, using original:', error);
      }
    }
    
    // Write file
    fs.writeFileSync(fullPath, finalBuffer);
    
    console.log(`[Storage] Saved file: ${relativePath} (${finalBuffer.length} bytes, optimized: ${optimized})`);
    
    return {
      path: relativePath,
      size: finalBuffer.length,
      optimized,
    };
  },
  
  /**
   * Save file from multer upload
   */
  async saveUploadedFile(
    file: Express.Multer.File,
    userId: string,
    category: keyof typeof FILE_CATEGORIES
  ): Promise<{ path: string; size: number; optimized: boolean }> {
    const buffer = fs.readFileSync(file.path);
    const result = await this.saveFile(buffer, userId, category, file.originalname, file.mimetype);
    
    // Remove temp file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return result;
  },
  
  /**
   * Check if mime type is an image
   */
  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/') && 
           ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType);
  },
  
  /**
   * Optimize image using sharp
   */
  async optimizeImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
    let sharpInstance = sharp(buffer);
    
    // Get image metadata
    const metadata = await sharpInstance.metadata();
    
    // Resize if too large
    if (metadata.width && metadata.width > this.config.maxImageWidth) {
      sharpInstance = sharpInstance.resize(this.config.maxImageWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }
    
    if (metadata.height && metadata.height > this.config.maxImageHeight) {
      sharpInstance = sharpInstance.resize(null, this.config.maxImageHeight, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }
    
    // Apply format-specific compression
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      return sharpInstance.jpeg({ quality: this.config.imageQuality, mozjpeg: true }).toBuffer();
    } else if (mimeType === 'image/png') {
      return sharpInstance.png({ quality: this.config.imageQuality, compressionLevel: 9 }).toBuffer();
    } else if (mimeType === 'image/webp') {
      return sharpInstance.webp({ quality: this.config.imageQuality }).toBuffer();
    }
    
    return sharpInstance.toBuffer();
  },
  
  /**
   * Get file from storage
   */
  getFile(relativePath: string): { buffer: Buffer; mimeType: string } | null {
    const fullPath = path.join(this.config.localPath, relativePath);
    
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(relativePath).toLowerCase();
    const mimeType = this.getMimeType(ext);
    
    return { buffer, mimeType };
  },
  
  /**
   * Delete file from storage
   */
  deleteFile(relativePath: string): boolean {
    const fullPath = path.join(this.config.localPath, relativePath);
    
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`[Storage] Deleted file: ${relativePath}`);
        return true;
      }
    } catch (error) {
      console.error(`[Storage] Failed to delete file: ${relativePath}`, error);
    }
    
    return false;
  },
  
  /**
   * Get mime type from extension
   */
  getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  },
  
  /**
   * Get cache headers for file serving
   */
  getCacheHeaders(): Record<string, string> {
    return {
      'Cache-Control': `public, max-age=${this.config.cacheDuration}`,
      'Expires': new Date(Date.now() + this.config.cacheDuration * 1000).toUTCString(),
    };
  },
  
  /**
   * Migrate existing files to new structure
   * Run this once to reorganize existing uploads
   */
  async migrateExistingFiles(getUserIdFromFilename: (filename: string) => string | null): Promise<{ migrated: number; failed: number }> {
    const oldUploadsPath = path.join(process.cwd(), 'uploads');
    let migrated = 0;
    let failed = 0;
    
    if (!fs.existsSync(oldUploadsPath)) {
      return { migrated, failed };
    }
    
    const files = fs.readdirSync(oldUploadsPath);
    
    for (const filename of files) {
      const filePath = path.join(oldUploadsPath, filename);
      const stat = fs.statSync(filePath);
      
      // Skip directories
      if (stat.isDirectory()) continue;
      
      try {
        // Determine category from filename
        let category: keyof typeof FILE_CATEGORIES = 'OTHER';
        if (filename.includes('profilePhoto')) category = 'PROFILE_PHOTO';
        else if (filename.includes('aadhaar')) category = 'AADHAAR';
        else if (filename.includes('pan')) category = 'PAN';
        
        // Try to extract user ID from filename or use default
        const userId = getUserIdFromFilename(filename) || 'legacy';
        
        // Read file
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mimeType = this.getMimeType(ext);
        
        // Save to new structure
        await this.saveFile(buffer, userId, category, filename, mimeType);
        
        migrated++;
      } catch (error) {
        console.error(`[Storage] Failed to migrate: ${filename}`, error);
        failed++;
      }
    }
    
    console.log(`[Storage] Migration complete. Migrated: ${migrated}, Failed: ${failed}`);
    return { migrated, failed };
  },
  
  /**
   * Get storage statistics
   */
  getStorageStats(): { totalFiles: number; totalSize: number; byCategory: Record<string, number> } {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {} as Record<string, number>,
    };
    
    const countFiles = (dir: string, category: string = 'root') => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const itemStat = fs.statSync(itemPath);
        
        if (itemStat.isDirectory()) {
          countFiles(itemPath, item);
        } else {
          stats.totalFiles++;
          stats.totalSize += itemStat.size;
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        }
      }
    };
    
    countFiles(this.config.localPath);
    
    return stats;
  },
  
  /**
   * Clean up old/orphaned files
   */
  async cleanupOrphanedFiles(validPaths: string[]): Promise<number> {
    let cleaned = 0;
    const validSet = new Set(validPaths.map(p => path.normalize(p)));
    
    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const itemStat = fs.statSync(itemPath);
        
        if (itemStat.isDirectory()) {
          scanDir(itemPath);
          
          // Remove empty directories
          const contents = fs.readdirSync(itemPath);
          if (contents.length === 0) {
            fs.rmdirSync(itemPath);
          }
        } else {
          const relativePath = path.relative(this.config.localPath, itemPath);
          if (!validSet.has(path.normalize(relativePath))) {
            try {
              fs.unlinkSync(itemPath);
              cleaned++;
            } catch (e) {
              // Ignore
            }
          }
        }
      }
    };
    
    scanDir(this.config.localPath);
    console.log(`[Storage] Cleaned up ${cleaned} orphaned files`);
    
    return cleaned;
  },
};

// Initialize with default config
storageService.init();

export default storageService;

