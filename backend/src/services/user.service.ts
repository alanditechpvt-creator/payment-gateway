import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { CreateUserDTO, UpdateUserDTO, UpdatePermissionsDTO, ALLOWED_CHILD_ROLES, ROLE_HIERARCHY, PaginationParams, OnboardingDTO, UserRole, UserStatus } from '../types';
import { AppError } from '../middleware/errorHandler';
import { emailService } from './email.service';
// import { UserRole, UserStatus } from '@prisma/client';

export const userService = {
  async createUser(creatorId: string, data: CreateUserDTO) {
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      include: { permissions: true },
    });
    
    if (!creator) {
      throw new AppError('Creator not found', 404);
    }
    
    // Check if creator can create users
    // permissions is an array, get the first one
    const creatorPermissions = Array.isArray(creator.permissions) 
      ? creator.permissions[0] 
      : creator.permissions;
    if (creator.role !== 'ADMIN' && !creatorPermissions?.canCreateUsers) {
      throw new AppError('You do not have permission to create users', 403);
    }
    
    // Check role hierarchy
    const allowedRoles = ALLOWED_CHILD_ROLES[creator.role as UserRole];
    if (!allowedRoles.includes(data.role)) {
      throw new AppError(`You cannot create users with role ${data.role}`, 403);
    }
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }
    
    // Generate onboarding token
    const onboardingToken = uuidv4();
    const onboardingTokenExpiry = new Date();
    onboardingTokenExpiry.setHours(onboardingTokenExpiry.getHours() + 24);
    
    // Create user with pending status
    const hashedPassword = await bcrypt.hash(data.password, 12);
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role,
        status: 'PENDING_ONBOARDING',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        businessName: data.businessName,
        parentId: creatorId,
        schemaId: data.schemaId,
        onboardingToken,
        onboardingTokenExpiry,
      },
    });
    
    // Create wallet for user
    await prisma.wallet.create({
      data: { userId: user.id },
    });
    
    // Create default permissions
    await prisma.userPermission.create({
      data: {
        userId: user.id,
        canViewReports: true,
        canViewTransactions: true,
        canInitiatePayin: data.role === 'RETAILER',
        canInitiatePayout: data.role === 'RETAILER',
      },
    });
    
    // Send onboarding email
    const creatorName = `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email;
    await emailService.sendOnboardingInvite(data.email, onboardingToken, creatorName);
    
    return user;
  },
  
  async getOnboardingInfo(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        onboardingToken: token,
        onboardingTokenExpiry: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });
    
    if (!user) {
      throw new AppError('Invalid or expired onboarding link', 400);
    }
    
    return user;
  },
  
  async completeOnboarding(token: string, data: OnboardingDTO, files: {
    profilePhoto?: string;
    aadhaarFront?: string;
    aadhaarBack?: string;
  }) {
    const user = await prisma.user.findFirst({
      where: {
        onboardingToken: token,
        onboardingTokenExpiry: { gt: new Date() },
      },
    });
    
    if (!user) {
      throw new AppError('Invalid or expired onboarding link', 400);
    }
    
    // Update user with onboarding data
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        businessName: data.businessName,
        panNumber: data.panNumber,
        panVerified: 'PENDING',
        aadhaarNumber: data.aadhaarNumber,
        aadhaarFront: files.aadhaarFront,
        aadhaarBack: files.aadhaarBack,
        profilePhoto: files.profilePhoto,
        aadhaarVerified: 'PENDING',
        status: 'PENDING_APPROVAL',
        onboardingToken: null,
        onboardingTokenExpiry: null,
      },
    });
    
    return updatedUser;
  },
  
  async verifyEmail(userId: string, otp: string) {
    // In production, verify OTP from cache/DB
    // For now, we'll mark email as verified
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    
    return { message: 'Email verified successfully' };
  },
  
  async approveUser(approverId: string, userId: string, approved: boolean, reason?: string) {
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      include: { permissions: true },
    });
    
    if (!approver) {
      throw new AppError('Approver not found', 404);
    }
    
    // permissions is an array, get the first element
    const approverPermissions = Array.isArray(approver.permissions) 
      ? approver.permissions[0] 
      : approver.permissions;
    if (approver.role !== 'ADMIN' && !approverPermissions?.canApproveUsers) {
      throw new AppError('You do not have permission to approve users', 403);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Check hierarchy
    if (user.parentId !== approverId && approver.role !== 'ADMIN') {
      // Check if approver is in the hierarchy above the user
      let currentParentId = user.parentId;
      let isInHierarchy = false;
      
      while (currentParentId) {
        if (currentParentId === approverId) {
          isInHierarchy = true;
          break;
        }
        const parent = await prisma.user.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        });
        currentParentId = parent?.parentId || null;
      }
      
      if (!isInHierarchy) {
        throw new AppError('You can only approve users in your hierarchy', 403);
      }
    }
    
    const newStatus: UserStatus = approved ? 'ACTIVE' : 'REJECTED';
    
    await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });
    
    // Send email notification
    await emailService.sendApprovalNotification(user.email, approved, reason);
    
    return { message: `User ${approved ? 'approved' : 'rejected'} successfully` };
  },
  
  async getUserById(requesterId: string, userId: string) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });
    
    if (!requester) {
      throw new AppError('Requester not found', 404);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
        wallet: true,
        schema: true,
        pgAssignments: {
          include: { paymentGateway: true },
        },
        parent: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Check access - admin can see anyone, others can only see their hierarchy
    if (requester.role !== 'ADMIN' && requesterId !== userId) {
      const canAccess = await this.isInHierarchy(requesterId, userId);
      if (!canAccess) {
        throw new AppError('Access denied', 403);
      }
    }
    
    // Remove sensitive data
    const { password, onboardingToken, ...safeUser } = user;
    
    // Normalize file paths - strip any prefix, return just filename
    // Frontend will prepend /uploads/ as needed
    const normalizeFilePath = (path: string | null): string | null => {
      if (!path) return null;
      // Remove ./ or uploads/ or uploads\ prefix (handle both forward and backward slashes)
      return path.replace(/^\.?[\/\\]?(uploads[\/\\])?/, '');
    };
    
    if (safeUser.profilePhoto) {
      safeUser.profilePhoto = normalizeFilePath(safeUser.profilePhoto);
    }
    if (safeUser.aadhaarFront) {
      safeUser.aadhaarFront = normalizeFilePath(safeUser.aadhaarFront);
    }
    if (safeUser.aadhaarBack) {
      safeUser.aadhaarBack = normalizeFilePath(safeUser.aadhaarBack);
    }
    
    return safeUser;
  },
  
  async isInHierarchy(parentId: string, childId: string): Promise<boolean> {
    const child = await prisma.user.findUnique({
      where: { id: childId },
      select: { parentId: true },
    });
    
    if (!child) return false;
    if (child.parentId === parentId) return true;
    if (!child.parentId) return false;
    
    return this.isInHierarchy(parentId, child.parentId);
  },
  
  async getUsers(requesterId: string, params: PaginationParams & {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
  }) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });
    
    if (!requester) {
      throw new AppError('Requester not found', 404);
    }
    
    const where: any = {};
    
    // Filter by role
    if (params.role) {
      where.role = params.role;
    }
    
    // Filter by status
    if (params.status) {
      where.status = params.status;
    }
    
    // Search
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { businessName: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    
    // Hierarchy filter - non-admins can only see their downline
    if (requester.role !== 'ADMIN') {
      const childIds = await this.getAllChildIds(requesterId);
      where.id = { in: childIds };
    }
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          firstName: true,
          lastName: true,
          businessName: true,
          phone: true,
          createdAt: true,
          lastLoginAt: true,
          onboardingToken: true, // Include for pending onboarding users
          parent: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: {
            select: { children: true },
          },
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { [params.sortBy || 'createdAt']: params.sortOrder || 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    
    // Only include onboardingToken for PENDING_ONBOARDING users
    const sanitizedUsers = users.map(user => ({
      ...user,
      onboardingToken: user.status === 'PENDING_ONBOARDING' ? user.onboardingToken : undefined,
    }));
    
    return {
      data: sanitizedUsers,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  },
  
  async getAllChildIds(parentId: string): Promise<string[]> {
    const children = await prisma.user.findMany({
      where: { parentId },
      select: { id: true },
    });
    
    const childIds = children.map(c => c.id);
    
    for (const child of children) {
      const grandchildIds = await this.getAllChildIds(child.id);
      childIds.push(...grandchildIds);
    }
    
    return childIds;
  },
  
  async updateUser(requesterId: string, userId: string, data: UpdateUserDTO) {
    const hasAccess = await this.checkAccess(requesterId, userId);
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });
    
    return user;
  },
  
  async updatePermissions(requesterId: string, userId: string, permissions: UpdatePermissionsDTO) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });
    
    if (!requester) {
      throw new AppError('Requester not found', 404);
    }
    
    const hasAccess = await this.checkAccess(requesterId, userId);
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }
    
    const { customPermissions, ...otherPermissions } = permissions;
    const permissionData = {
      ...otherPermissions,
      customPermissions: customPermissions ? JSON.stringify(customPermissions) : undefined,
    };
    
    const userPermission = await prisma.userPermission.upsert({
      where: { userId },
      create: { userId, ...permissionData },
      update: permissionData,
    });
    
    return userPermission;
  },
  
  async assignPG(requesterId: string, userId: string, pgId: string, customRate?: number) {
    const hasAccess = await this.checkAccess(requesterId, userId);
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }
    
    const assignment = await prisma.userPGAssignment.upsert({
      where: {
        userId_pgId: { userId, pgId },
      },
      create: {
        userId,
        pgId,
        customRate: customRate ? customRate : undefined,
      },
      update: {
        customRate: customRate ? customRate : undefined,
        isEnabled: true,
      },
    });
    
    return assignment;
  },
  
  async removePGAssignment(requesterId: string, userId: string, pgId: string) {
    const hasAccess = await this.checkAccess(requesterId, userId);
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }
    
    await prisma.userPGAssignment.update({
      where: {
        userId_pgId: { userId, pgId },
      },
      data: { isEnabled: false },
    });
    
    return { message: 'PG assignment removed' };
  },
  
  async checkAccess(requesterId: string, targetId: string): Promise<boolean> {
    if (requesterId === targetId) return true;
    
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });
    
    if (!requester) return false;
    if (requester.role === 'ADMIN') return true;
    
    return this.isInHierarchy(requesterId, targetId);
  },
  
  async suspendUser(requesterId: string, userId: string) {
    const hasAccess = await this.checkAccess(requesterId, userId);
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
    
    // Invalidate all tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });
    
    return { message: 'User suspended successfully' };
  },
  
  async reactivateUser(requesterId: string, userId: string) {
    const hasAccess = await this.checkAccess(requesterId, userId);
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
    
    return { message: 'User reactivated successfully' };
  },
  
  async sendOnboardingOTP(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        onboardingToken: token,
        onboardingTokenExpiry: { gt: new Date() },
      },
    });
    
    if (!user) {
      throw new AppError('Invalid or expired onboarding link', 400);
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes
    
    // Store OTP in user record (using a custom field or just email verification field)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
      },
    });
    
    // Send OTP email
    await emailService.sendOTP(user.email, otp);
    
    return { message: 'OTP sent to your email' };
  },
  
  async getOnboardingLink(requesterId: string, userId: string) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });
    
    if (!requester) {
      throw new AppError('Requester not found', 404);
    }
    
    // Check access - admin can see anyone, others can only see their children
    if (requester.role !== 'ADMIN') {
      const hasAccess = await this.isInHierarchy(requesterId, userId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403);
      }
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingToken: true, onboardingTokenExpiry: true, status: true },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    if (!user.onboardingToken || !user.onboardingTokenExpiry) {
      throw new AppError('No onboarding link available for this user', 400);
    }
    
    if (user.onboardingTokenExpiry < new Date()) {
      throw new AppError('Onboarding link has expired', 400);
    }
    
    return { 
      token: user.onboardingToken,
      status: user.status,
    };
  },
  
  async verifyOnboardingOTP(token: string, otp: string) {
    const user = await prisma.user.findFirst({
      where: {
        onboardingToken: token,
        onboardingTokenExpiry: { gt: new Date() },
      },
    });
    
    if (!user) {
      throw new AppError('Invalid or expired onboarding link', 400);
    }
    
    if (!user.emailOtp || !user.emailOtpExpiry) {
      throw new AppError('Please request an OTP first', 400);
    }
    
    if (new Date() > user.emailOtpExpiry) {
      throw new AppError('OTP has expired. Please request a new one', 400);
    }
    
    if (user.emailOtp !== otp) {
      throw new AppError('Invalid OTP', 400);
    }
    
    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailOtp: null,
        emailOtpExpiry: null,
      },
    });
    
    return { message: 'Email verified successfully' };
  },

  async resendOnboardingEmail(requesterId: string, userId: string) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, role: true, firstName: true, lastName: true },
    });
    
    if (!requester) {
      throw new AppError('Requester not found', 404);
    }
    
    // Check access - admin can resend for anyone, others can only resend for their children
    if (requester.role !== 'ADMIN') {
      const hasAccess = await this.isInHierarchy(requesterId, userId);
      if (!hasAccess) {
        throw new AppError('Access denied', 403);
      }
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        onboardingToken: true, 
        onboardingTokenExpiry: true, 
        status: true 
      },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    if (user.status !== 'PENDING_ONBOARDING') {
      throw new AppError('User has already completed onboarding or is not in pending state', 400);
    }
    
    // Generate new token if expired or doesn't exist
    let onboardingToken = user.onboardingToken;
    if (!onboardingToken || !user.onboardingTokenExpiry || user.onboardingTokenExpiry < new Date()) {
      onboardingToken = crypto.randomBytes(32).toString('hex');
      const onboardingTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingToken, onboardingTokenExpiry },
      });
    }
    
    // Send onboarding email
    const creatorName = `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || 'Admin';
    await emailService.sendOnboardingInvite(user.email, onboardingToken, creatorName);
    
    return { 
      message: 'Onboarding email sent successfully',
      token: onboardingToken,
    };
  },
};

