import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const MAX_PROFILES_PER_USER = 3;

function ensurePayoutProfileModel() {
  if (typeof (prisma as any).payoutProfile?.findUnique !== 'function') {
    throw new AppError(
      'PayoutProfile model not available. Run: npx prisma generate',
      503
    );
  }
}

const normalizeMobile = (mobile: string) => mobile.replace(/\D/g, '').slice(-10);

const validateMobile = (mobile: string): boolean => {
  const m = normalizeMobile(mobile);
  return m.length === 10 && /^[6-9]/.test(m);
};

export interface CreatePayoutProfileDTO {
  mobile: string;
  name: string;
  email?: string;
}

export const payoutProfileService = {
  async createProfile(userId: string, data: CreatePayoutProfileDTO) {
    ensurePayoutProfileModel();
    if (!data.name || data.name.trim().length < 2) {
      throw new AppError('Name must be at least 2 characters', 400);
    }
    if (!data.mobile || !validateMobile(data.mobile)) {
      throw new AppError('Invalid mobile number (10 digits, starting with 6-9)', 400);
    }

    const mobile = normalizeMobile(data.mobile);

    const count = await prisma.payoutProfile.count({ where: { userId } });
    if (count >= MAX_PROFILES_PER_USER) {
      throw new AppError(`You can create only ${MAX_PROFILES_PER_USER} payout profiles`, 400);
    }

    const existing = await prisma.payoutProfile.findUnique({
      where: { userId_mobile: { userId, mobile } },
    });
    if (existing) {
      throw new AppError('A profile with this mobile number already exists', 400);
    }

    const profile = await prisma.payoutProfile.create({
      data: {
        userId,
        mobile,
        name: data.name.trim(),
        email: data.email?.trim() || null,
      },
    });
    return profile;
  },

  async getProfiles(userId: string) {
    return prisma.payoutProfile.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { beneficiaries: true } },
      },
    });
  },

  async getProfileByMobile(userId: string, mobile: string) {
    ensurePayoutProfileModel();
    const normalized = normalizeMobile(mobile);
    const profile = await prisma.payoutProfile.findUnique({
      where: { userId_mobile: { userId, mobile: normalized } },
      include: {
        beneficiaries: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return profile;
  },

  async getProfileById(userId: string, profileId: string) {
    const profile = await prisma.payoutProfile.findFirst({
      where: { id: profileId, userId },
      include: {
        beneficiaries: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!profile) throw new AppError('Profile not found', 404);
    return profile;
  },

  async updateProfile(userId: string, profileId: string, data: Partial<CreatePayoutProfileDTO>) {
    await this.getProfileById(userId, profileId);
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.email !== undefined) updateData.email = data.email.trim() || null;
    if (data.mobile !== undefined) {
      if (!validateMobile(data.mobile)) throw new AppError('Invalid mobile number', 400);
      const mobile = normalizeMobile(data.mobile);
      const existing = await prisma.payoutProfile.findFirst({
        where: { userId, mobile, id: { not: profileId } },
      });
      if (existing) throw new AppError('Another profile already uses this mobile number', 400);
      updateData.mobile = mobile;
    }
    return prisma.payoutProfile.update({
      where: { id: profileId },
      data: updateData,
    });
  },

  async deleteProfile(userId: string, profileId: string) {
    await this.getProfileById(userId, profileId);
    await prisma.payoutProfile.update({
      where: { id: profileId },
      data: { isActive: false },
    });
    return { success: true };
  },
};
