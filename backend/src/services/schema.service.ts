import prisma from '../lib/prisma';
import { CreateSchemaDTO, SchemaPGRateDTO, PaginationParams } from '../types';
import { AppError } from '../middleware/errorHandler';
// import { UserRole } from '@prisma/client';
type UserRole = 'ADMIN' | 'WHITE_LABEL' | 'MASTER_DISTRIBUTOR' | 'DISTRIBUTOR' | 'RETAILER';
import { Decimal } from '@prisma/client/runtime/library';

export const schemaService = {
  async createSchema(creatorId: string, data: CreateSchemaDTO) {
    // Check if creator has permission
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      include: { permissions: true },
    });
    
    if (!creator) {
      throw new AppError('Creator not found', 404);
    }
    
    // permissions is an array, get the first element
    const creatorPermissions = Array.isArray(creator.permissions) ? creator.permissions[0] : creator.permissions;
    if (creator.role !== 'ADMIN' && !creatorPermissions?.canCreateSchema) {
      throw new AppError('You do not have permission to create schemas', 403);
    }
    
    // Check if code already exists
    const existing = await prisma.schema.findUnique({
      where: { code: data.code.toUpperCase() },
    });
    
    if (existing) {
      throw new AppError('Schema code already exists', 409);
    }
    
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.schema.updateMany({
        where: {
          isDefault: true,
          applicableRoles: { hasSome: data.applicableRoles },
        },
        data: { isDefault: false },
      });
    }
    
    const schema = await prisma.schema.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        applicableRoles: data.applicableRoles,
        isDefault: data.isDefault || false,
        createdById: creatorId,
      },
    });
    
    return schema;
  },
  
  async updateSchema(schemaId: string, data: Partial<CreateSchemaDTO>) {
    const schema = await prisma.schema.update({
      where: { id: schemaId },
      data: {
        name: data.name,
        description: data.description,
        applicableRoles: JSON.stringify(data.applicableRoles),
        isDefault: data.isDefault,
      },
    });
    
    return schema;
  },
  
  async getSchemas(params?: PaginationParams & {
    role?: UserRole;
    creatorId?: string;
    isActive?: boolean;
  }) {
    const where: any = {};
    
    if (params?.role) {
      where.applicableRoles = { has: params.role };
    }
    
    if (params?.creatorId) {
      where.createdById = params.creatorId;
    }
    
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    
    if (!params) {
      return prisma.schema.findMany({
        where,
        include: {
          pgRates: {
            include: { 
              paymentGateway: true,
              payoutSlabs: { orderBy: { minAmount: 'asc' } },
            },
          },
          _count: { select: { users: true } },
        },
        orderBy: { name: 'asc' },
      });
    }
    
    const [schemas, total] = await Promise.all([
      prisma.schema.findMany({
        where,
        include: {
          pgRates: {
            include: { 
              paymentGateway: true,
              payoutSlabs: { orderBy: { minAmount: 'asc' } },
            },
          },
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          _count: { select: { users: true } },
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { [params.sortBy || 'name']: params.sortOrder || 'asc' },
      }),
      prisma.schema.count({ where }),
    ]);
    
    return {
      data: schemas,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  },
  
  async getSchemaById(schemaId: string) {
    const schema = await prisma.schema.findUnique({
      where: { id: schemaId },
      include: {
        pgRates: {
          include: { 
            paymentGateway: true,
            payoutSlabs: {
              orderBy: { minAmount: 'asc' },
            },
          },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        _count: { select: { users: true } },
      },
    });
    
    if (!schema) {
      throw new AppError('Schema not found', 404);
    }
    
    return schema;
  },
  
  async setPGRates(schemaId: string, rates: SchemaPGRateDTO[]) {
    // Delete existing rates and create new ones
    await prisma.$transaction(async (tx) => {
      await tx.schemaPGRate.deleteMany({ where: { schemaId } });
      
      for (const rate of rates) {
        await tx.schemaPGRate.create({
          data: {
            schemaId,
            pgId: rate.pgId,
            payinRate: Number(rate.payinRate),
            payoutRate: Number(rate.payoutRate),
          },
        });
      }
    });
    
    return this.getSchemaById(schemaId);
  },
  
  async addPGRate(schemaId: string, rate: SchemaPGRateDTO) {
    const pgRate = await prisma.schemaPGRate.upsert({
      where: {
        schemaId_pgId: { schemaId, pgId: rate.pgId },
      },
      create: {
        schemaId,
        pgId: rate.pgId,
        payinRate: Number(rate.payinRate),
        payoutRate: Number(rate.payoutRate),
      },
      update: {
        payinRate: Number(rate.payinRate),
        payoutRate: Number(rate.payoutRate),
      },
    });
    
    return pgRate;
  },
  
  async removePGRate(schemaId: string, pgId: string) {
    await prisma.schemaPGRate.delete({
      where: {
        schemaId_pgId: { schemaId, pgId },
      },
    });
    
    return { message: 'PG rate removed from schema' };
  },
  
  async toggleSchemaStatus(schemaId: string, isActive: boolean) {
    const schema = await prisma.schema.update({
      where: { id: schemaId },
      data: { isActive },
    });
    
    return schema;
  },
  
  async deleteSchema(schemaId: string) {
    // Check if schema has users
    const userCount = await prisma.user.count({
      where: { schemaId },
    });
    
    if (userCount > 0) {
      throw new AppError('Cannot delete schema with assigned users. Deactivate or reassign users first.', 400);
    }
    
    // Delete rates first
    await prisma.schemaPGRate.deleteMany({ where: { schemaId } });
    await prisma.schema.delete({ where: { id: schemaId } });
    
    return { message: 'Schema deleted' };
  },
  
  async getDefaultSchemaForRole(role: UserRole) {
    const schema = await prisma.schema.findFirst({
      where: {
        isDefault: true,
        isActive: true,
        applicableRoles: { has: role },
      },
      include: {
        pgRates: {
          include: { paymentGateway: true },
        },
      },
    });
    
    return schema;
  },
  
  async assignSchemaToUser(userId: string, schemaId: string) {
    const schema = await prisma.schema.findUnique({
      where: { id: schemaId },
    });
    
    if (!schema) {
      throw new AppError('Schema not found', 404);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Check if schema is applicable to user's role
    if (!schema.applicableRoles.includes(user.role)) {
      throw new AppError('This schema is not applicable to the user\'s role', 400);
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: { schemaId },
    });
    
    return { message: 'Schema assigned to user' };
  },
  
  // ==================== PAYOUT SLAB MANAGEMENT (Admin Only) ====================
  
  /**
   * Set payout slabs for a schema-PG combination
   * Replaces all existing slabs with the new ones
   */
  async setPayoutSlabs(
    schemaPGRateId: string,
    slabs: Array<{ minAmount: number; maxAmount: number | null; flatFee: number }>
  ) {
    // Validate slabs
    if (!slabs || slabs.length === 0) {
      throw new AppError('At least one payout slab is required', 400);
    }
    
    // Sort by minAmount
    const sortedSlabs = [...slabs].sort((a, b) => a.minAmount - b.minAmount);
    
    // Validate slab ranges don't overlap
    for (let i = 0; i < sortedSlabs.length - 1; i++) {
      const current = sortedSlabs[i];
      const next = sortedSlabs[i + 1];
      
      if (current.maxAmount === null && i < sortedSlabs.length - 1) {
        throw new AppError('Only the last slab can have unlimited max amount', 400);
      }
      
      if (current.maxAmount !== null && next.minAmount <= current.maxAmount) {
        throw new AppError(`Slab ranges overlap: ${current.maxAmount} >= ${next.minAmount}`, 400);
      }
    }
    
    // Delete existing slabs and create new ones in transaction
    await prisma.$transaction(async (tx) => {
      await tx.payoutSlab.deleteMany({ where: { schemaPGRateId } });
      
      for (const slab of sortedSlabs) {
        await tx.payoutSlab.create({
          data: {
            schemaPGRateId,
            minAmount: slab.minAmount,
            maxAmount: slab.maxAmount,
            flatCharge: slab.flatFee, // Database field is flatCharge
          },
        });
      }
    });
    
    // Return updated schemaPGRate with slabs
    return prisma.schemaPGRate.findUnique({
      where: { id: schemaPGRateId },
      include: {
        paymentGateway: true,
        payoutSlabs: { orderBy: { minAmount: 'asc' } },
      },
    });
  },
  
  /**
   * Get payout slabs for a schema-PG combination
   */
  async getPayoutSlabs(schemaPGRateId: string) {
    return prisma.payoutSlab.findMany({
      where: { schemaPGRateId },
      orderBy: { minAmount: 'asc' },
    });
  },
  
  /**
   * Add or update a single payout slab
   */
  async upsertPayoutSlab(
    schemaPGRateId: string,
    slabId: string | null,
    data: { minAmount: number; maxAmount: number | null; flatFee: number }
  ) {
    if (slabId) {
      // Update existing slab
      return prisma.payoutSlab.update({
        where: { id: slabId },
        data: {
          minAmount: data.minAmount,
          maxAmount: data.maxAmount,
          flatCharge: data.flatFee, // Database field is flatCharge
        },
      });
    }
    
    // Create new slab
    return prisma.payoutSlab.create({
      data: {
        schemaPGRateId,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        flatCharge: data.flatFee, // Database field is flatCharge
      },
    });
  },
  
  /**
   * Delete a payout slab
   */
  async deletePayoutSlab(slabId: string) {
    await prisma.payoutSlab.delete({ where: { id: slabId } });
    return { message: 'Payout slab deleted' };
  },
  
  /**
   * Update PG rate with payout settings (charge type and slabs)
   */
  async updatePGRatePayoutSettings(
    schemaPGRateId: string,
    payoutChargeType: 'PERCENTAGE' | 'SLAB',
    payoutRate?: number,
    slabs?: Array<{ minAmount: number; maxAmount: number | null; flatFee: number }>
  ) {
    // Update the charge type
    await prisma.schemaPGRate.update({
      where: { id: schemaPGRateId },
      data: {
        payoutChargeType,
        payoutRate: payoutChargeType === 'PERCENTAGE' && payoutRate !== undefined 
          ? new Decimal(payoutRate) 
          : undefined,
      },
    });
    
    // If slab-based and slabs provided, update them
    if (payoutChargeType === 'SLAB' && slabs && slabs.length > 0) {
      await this.setPayoutSlabs(schemaPGRateId, slabs);
    }
    
    return prisma.schemaPGRate.findUnique({
      where: { id: schemaPGRateId },
      include: {
        paymentGateway: true,
        payoutSlabs: { orderBy: { minAmount: 'asc' } },
      },
    });
  },
};

