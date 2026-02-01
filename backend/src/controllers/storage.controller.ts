import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { storageService } from '../services/storage.service';

export const storageController = {
  // Get storage statistics (Admin only)
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = storageService.getStorageStats();
      
      // Format size for readability
      const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };
      
      res.json({
        success: true,
        data: {
          totalFiles: stats.totalFiles,
          totalSize: stats.totalSize,
          totalSizeFormatted: formatSize(stats.totalSize),
          byCategory: stats.byCategory,
          storageProvider: storageService.config.provider,
          imageCompression: storageService.config.imageCompression,
        },
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Get storage configuration (Admin only)
  async getConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          provider: storageService.config.provider,
          imageCompression: storageService.config.imageCompression,
          maxImageWidth: storageService.config.maxImageWidth,
          maxImageHeight: storageService.config.maxImageHeight,
          imageQuality: storageService.config.imageQuality,
          cacheDuration: storageService.config.cacheDuration,
        },
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Trigger cleanup of orphaned files (Admin only)
  async cleanupOrphaned(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // This would need to be implemented with actual database queries
      // For now, return a placeholder response
      res.json({
        success: true,
        message: 'Cleanup initiated. This would compare stored files against database records.',
        data: {
          status: 'not_implemented',
          note: 'Full implementation requires comparing all file paths in database with files on disk',
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

