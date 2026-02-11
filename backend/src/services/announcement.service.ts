/**
 * Announcement Service
 * 
 * Manages broadcast announcements/news ticker for user dashboards
 */

import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreateAnnouncementData {
  title: string;
  message: string;
  type?: 'INFO' | 'WARNING' | 'ALERT' | 'PROMO';
  priority?: number;
  targetRoles?: string;
  targetUserIds?: string;
  startDate?: Date;
  endDate?: Date;
  bgColor?: string;
  textColor?: string;
  icon?: string;
}

export interface UpdateAnnouncementData extends Partial<CreateAnnouncementData> {
  isActive?: boolean;
}

export const announcementService = {
  /**
   * Create a new announcement
   */
  async create(createdById: string, data: CreateAnnouncementData) {
    return prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        priority: data.priority || 0,
        targetRoles: data.targetRoles || 'ALL',
        targetUserIds: data.targetUserIds || null,
        startDate: data.startDate || new Date(),
        endDate: data.endDate || null,
        bgColor: data.bgColor || null,
        textColor: data.textColor || null,
        icon: data.icon || null,
        createdById,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  },

  /**
   * Get all announcements (for admin)
   */
  async getAll(params?: { isActive?: boolean; limit?: number; offset?: number }) {
    const { isActive, limit = 50, offset = 0 } = params || {};

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.announcement.count({ where }),
    ]);

    return { data: announcements, total, limit, offset };
  },

  /**
   * Get active announcements for a specific user (based on role)
   */
  async getActiveForUser(userId: string, userRole: string) {
    const now = new Date();

    // Find announcements that:
    // 1. Are active
    // 2. Started (startDate <= now)
    // 3. Haven't ended (endDate is null or > now)
    // 4. Target this user's role OR target ALL
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gt: now } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // Filter by role
    const filtered = announcements.filter((a) => {
      const roles = a.targetRoles.split(',').map(r => r.trim());
      
      // Check if targets ALL or specific role
      if (roles.includes('ALL')) return true;
      if (roles.includes(userRole)) return true;
      
      // Check if user is specifically targeted
      if (a.targetUserIds) {
        const targetIds = a.targetUserIds.split(',').map(id => id.trim());
        if (targetIds.includes(userId)) return true;
      }
      
      return false;
    });

    // Increment view count for all returned announcements (async, don't wait)
    const announcementIds = filtered.map(a => a.id);
    if (announcementIds.length > 0) {
      prisma.announcement.updateMany({
        where: { id: { in: announcementIds } },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {}); // Ignore errors
    }

    return filtered;
  },

  /**
   * Get announcement by ID
   */
  async getById(id: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    return announcement;
  },

  /**
   * Update announcement
   */
  async update(id: string, data: UpdateAnnouncementData) {
    await this.getById(id); // Check exists

    return prisma.announcement.update({
      where: { id },
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority,
        targetRoles: data.targetRoles,
        targetUserIds: data.targetUserIds,
        startDate: data.startDate,
        endDate: data.endDate,
        bgColor: data.bgColor,
        textColor: data.textColor,
        icon: data.icon,
        isActive: data.isActive,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  },

  /**
   * Toggle announcement active status
   */
  async toggle(id: string, isActive: boolean) {
    await this.getById(id);

    return prisma.announcement.update({
      where: { id },
      data: { isActive },
    });
  },

  /**
   * Delete announcement
   */
  async delete(id: string) {
    await this.getById(id);

    await prisma.announcement.delete({
      where: { id },
    });

    return { message: 'Announcement deleted' };
  },

  /**
   * Get announcement statistics
   */
  async getStats() {
    const [total, active] = await Promise.all([
      prisma.announcement.count(),
      prisma.announcement.count({
        where: {
          isActive: true,
        },
      }),
    ]);

    return { 
      total, 
      active, 
      scheduled: 0, // Not supported in current schema (no startDate/endDate)
      expired: 0    // Not supported in current schema (no startDate/endDate)
    };
  },
};

