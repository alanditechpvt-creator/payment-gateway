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
        content: data.message ?? data.title,
        type: data.type || 'INFO',
        targetRoles: data.targetRoles || 'ALL',
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
        orderBy: [{ createdAt: 'desc' }],
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

    const withMessage = announcements.map((a) => ({ ...a, message: a.content }));
    return { data: withMessage, total, limit, offset };
  },

  /**
   * Get active announcements for a specific user (based on role)
   */
  async getActiveForUser(_userId: string, userRole: string) {
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Filter by targetRoles (ALL or user's role)
    const filtered = announcements.filter((a) => {
      const roles = (a.targetRoles || 'ALL').split(',').map((r: string) => r.trim()).filter(Boolean);
      if (roles.includes('ALL')) return true;
      if (roles.includes(userRole)) return true;
      return false;
    });

    // Expose content as message for API compatibility
    return filtered.map((a) => ({ ...a, message: a.content }));
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

    return { ...announcement, message: announcement.content };
  },

  /**
   * Update announcement
   */
  async update(id: string, data: UpdateAnnouncementData) {
    await this.getById(id); // Check exists

    const updateData: { title?: string; content?: string; type?: string; targetRoles?: string; isActive?: boolean } = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.message !== undefined) updateData.content = data.message;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.targetRoles !== undefined) updateData.targetRoles = data.targetRoles;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.announcement.update({
      where: { id },
      data: updateData,
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

