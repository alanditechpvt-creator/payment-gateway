import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreateCardTypeDTO {
  pgId: string;
  code: string;
  name: string;
  description?: string;
  internalPG?: string;
  cardNetwork?: string;
  cardCategory?: string;
  baseRate: number;
}

export interface SchemaCardTypeRateDTO {
  schemaId: string;
  cardTypeId: string;
  payinRate: number;
}

export const cardTypeService = {
  // ==================== CARD TYPE CRUD ====================
  
  /**
   * Create a new card type for a PG
   */
  async createCardType(data: CreateCardTypeDTO) {
    // Verify PG exists
    const pg = await prisma.paymentGateway.findUnique({
      where: { id: data.pgId },
    });
    
    if (!pg) {
      throw new AppError('Payment gateway not found', 404);
    }
    
    // Check if code already exists for this PG
    const existing = await prisma.cardType.findUnique({
      where: {
        pgId_code: { pgId: data.pgId, code: data.code },
      },
    });
    
    if (existing) {
      throw new AppError('Card type code already exists for this PG', 409);
    }
    
    const cardType = await prisma.cardType.create({
      data: {
        pgId: data.pgId,
        code: data.code,
        name: data.name,
        description: data.description,
        internalPG: data.internalPG,
        cardNetwork: data.cardNetwork,
        cardCategory: data.cardCategory,
        baseRate: data.baseRate,
      },
      include: {
        paymentGateway: true,
      },
    });
    
    return cardType;
  },
  
  /**
   * Update a card type
   */
  async updateCardType(cardTypeId: string, data: Partial<CreateCardTypeDTO>) {
    const cardType = await prisma.cardType.update({
      where: { id: cardTypeId },
      data: {
        name: data.name,
        description: data.description,
        internalPG: data.internalPG,
        cardNetwork: data.cardNetwork,
        cardCategory: data.cardCategory,
        baseRate: data.baseRate,
      },
      include: {
        paymentGateway: true,
      },
    });
    
    return cardType;
  },
  
  /**
   * Get all card types for a PG
   */
  async getCardTypesByPG(pgId: string) {
    return prisma.cardType.findMany({
      where: { pgId },
      include: {
        paymentGateway: true,
        schemaRates: {
          include: { schema: true },
        },
      },
      orderBy: [
        { internalPG: 'asc' },
        { cardNetwork: 'asc' },
        { cardCategory: 'asc' },
      ],
    });
  },
  
  /**
   * Get all card types (optionally filtered)
   */
  async getAllCardTypes(filters?: {
    pgId?: string;
    internalPG?: string;
    cardNetwork?: string;
    isActive?: boolean;
  }) {
    const where: any = {};
    
    if (filters?.pgId) where.pgId = filters.pgId;
    if (filters?.internalPG) where.internalPG = filters.internalPG;
    if (filters?.cardNetwork) where.cardNetwork = filters.cardNetwork;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    
    return prisma.cardType.findMany({
      where,
      include: {
        paymentGateway: true,
      },
      orderBy: [
        { paymentGateway: { name: 'asc' } },
        { internalPG: 'asc' },
        { cardNetwork: 'asc' },
      ],
    });
  },
  
  /**
   * Get card type by ID
   */
  async getCardTypeById(cardTypeId: string) {
    const cardType = await prisma.cardType.findUnique({
      where: { id: cardTypeId },
      include: {
        paymentGateway: true,
        schemaRates: {
          include: { schema: true },
        },
      },
    });
    
    if (!cardType) {
      throw new AppError('Card type not found', 404);
    }
    
    return cardType;
  },
  
  /**
   * Get card type by code and PG
   */
  async getCardTypeByCode(pgId: string, code: string) {
    return prisma.cardType.findUnique({
      where: {
        pgId_code: { pgId, code },
      },
      include: {
        paymentGateway: true,
      },
    });
  },
  
  /**
   * Toggle card type active status
   */
  async toggleCardTypeStatus(cardTypeId: string, isActive: boolean) {
    return prisma.cardType.update({
      where: { id: cardTypeId },
      data: { isActive },
    });
  },
  
  /**
   * Delete a card type
   */
  async deleteCardType(cardTypeId: string) {
    // Check if card type has transactions
    const txCount = await prisma.transaction.count({
      where: { cardTypeId },
    });
    
    if (txCount > 0) {
      throw new AppError('Cannot delete card type with existing transactions. Deactivate instead.', 400);
    }
    
    // Delete related rates first
    await prisma.schemaCardTypeRate.deleteMany({ where: { cardTypeId } });
    await prisma.userCardTypeRate.deleteMany({ where: { cardTypeId } });
    
    await prisma.cardType.delete({ where: { id: cardTypeId } });
    
    return { message: 'Card type deleted' };
  },
  
  // ==================== SCHEMA CARD TYPE RATES ====================
  
  /**
   * Set schema rate for a card type
   */
  async setSchemaCardTypeRate(schemaId: string, cardTypeId: string, payinRate: number) {
    return prisma.schemaCardTypeRate.upsert({
      where: {
        schemaId_cardTypeId: { schemaId, cardTypeId },
      },
      create: {
        schemaId,
        cardTypeId,
        payinRate,
      },
      update: {
        payinRate,
      },
      include: {
        schema: true,
        cardType: true,
      },
    });
  },
  
  /**
   * Get all schema rates for card types
   */
  async getSchemaCardTypeRates(schemaId: string) {
    return prisma.schemaCardTypeRate.findMany({
      where: { schemaId },
      include: {
        cardType: {
          include: { paymentGateway: true },
        },
      },
      orderBy: {
        cardType: { code: 'asc' },
      },
    });
  },
  
  /**
   * Bulk set schema card type rates
   */
  async bulkSetSchemaCardTypeRates(schemaId: string, rates: Array<{ cardTypeId: string; payinRate: number }>) {
    const results = [];
    
    for (const rate of rates) {
      const result = await this.setSchemaCardTypeRate(schemaId, rate.cardTypeId, rate.payinRate);
      results.push(result);
    }
    
    return results;
  },
  
  // ==================== USER CARD TYPE RATES ====================
  
  /**
   * Assign card type rate to a user
   */
  async assignUserCardTypeRate(
    assignerId: string,
    targetUserId: string,
    cardTypeId: string,
    payinRate: number
  ) {
    // Validate assigner
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      include: { permissions: true },
    });
    
    if (!assigner) {
      throw new AppError('Assigner not found', 404);
    }
    
    // Check permissions
    const assignerPermissions = Array.isArray(assigner.permissions) ? assigner.permissions[0] : assigner.permissions;
    const canAssign = assigner.role === 'ADMIN' || 
                      assigner.role === 'WHITE_LABEL' || 
                      assigner.role === 'MASTER_DISTRIBUTOR' ||
                      assignerPermissions?.canAssignRates;
    
    if (!canAssign) {
      throw new AppError('You do not have permission to assign rates', 403);
    }
    
    // Validate target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }
    
    // Check hierarchy
    if (assigner.role !== 'ADMIN' && targetUser.parentId !== assignerId) {
      throw new AppError('You can only assign rates to your direct children', 403);
    }
    
    // Get assigner's rate for this card type
    const assignerRate = await this.getUserCardTypeRate(assignerId, cardTypeId);
    
    // Validate rate
    if (payinRate < assignerRate) {
      throw new AppError(
        `Rate (${(payinRate * 100).toFixed(2)}%) cannot be lower than your rate (${(assignerRate * 100).toFixed(2)}%)`,
        400
      );
    }
    
    // Create or update rate
    return prisma.userCardTypeRate.upsert({
      where: {
        userId_cardTypeId: { userId: targetUserId, cardTypeId },
      },
      create: {
        userId: targetUserId,
        cardTypeId,
        assignedById: assignerId,
        payinRate,
      },
      update: {
        payinRate,
        assignedById: assignerId,
      },
      include: {
        cardType: {
          include: { paymentGateway: true },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  },
  
  /**
   * Get user's rate for a specific card type
   * Returns the effective rate considering hierarchy
   */
  async getUserCardTypeRate(userId: string, cardTypeId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { schema: true },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Admin sees base rate
    if (user.role === 'ADMIN') {
      const cardType = await prisma.cardType.findUnique({
        where: { id: cardTypeId },
      });
      return cardType?.baseRate || 0;
    }
    
    // Check for user-specific rate
    const userRate = await prisma.userCardTypeRate.findUnique({
      where: {
        userId_cardTypeId: { userId, cardTypeId },
      },
    });
    
    if (userRate) {
      return userRate.payinRate;
    }
    
    // Fall back to schema rate
    if (user.schemaId) {
      const schemaRate = await prisma.schemaCardTypeRate.findUnique({
        where: {
          schemaId_cardTypeId: { schemaId: user.schemaId, cardTypeId },
        },
      });
      
      if (schemaRate) {
        return schemaRate.payinRate;
      }
    }
    
    // Fall back to card type base rate
    const cardType = await prisma.cardType.findUnique({
      where: { id: cardTypeId },
    });
    
    return cardType?.baseRate || 0;
  },
  
  /**
   * Get all card type rates for a user
   */
  async getUserCardTypeRates(userId: string) {
    return prisma.userCardTypeRate.findMany({
      where: { userId },
      include: {
        cardType: {
          include: { paymentGateway: true },
        },
        assignedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  },
  
  /**
   * Get rates assigned by a user to their children
   */
  async getCardTypeRatesAssignedByMe(assignerId: string) {
    return prisma.userCardTypeRate.findMany({
      where: { assignedById: assignerId },
      include: {
        cardType: {
          include: { paymentGateway: true },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  },
  
  // ==================== TRANSACTION HELPERS ====================
  
  /**
   * Find or create card type from PG response
   * Used when processing transactions to auto-create card types
   */
  async findOrCreateCardTypeFromResponse(
    pgId: string,
    pgResponse: {
      cardTypeCode?: string;
      internalPG?: string;
      cardNetwork?: string;
      cardCategory?: string;
    }
  ) {
    // Generate code from response
    const code = pgResponse.cardTypeCode || 
                 `${pgResponse.internalPG || 'unknown'}_${pgResponse.cardNetwork || 'unknown'}-${pgResponse.cardCategory || 'normal'}`.toLowerCase();
    
    // Try to find existing
    let cardType = await prisma.cardType.findUnique({
      where: {
        pgId_code: { pgId, code },
      },
    });
    
    if (!cardType) {
      // Get PG for base rate
      const pg = await prisma.paymentGateway.findUnique({
        where: { id: pgId },
      });
      
      // Auto-create with PG's base rate
      cardType = await prisma.cardType.create({
        data: {
          pgId,
          code,
          name: this.generateCardTypeName(pgResponse),
          internalPG: pgResponse.internalPG,
          cardNetwork: pgResponse.cardNetwork,
          cardCategory: pgResponse.cardCategory,
          baseRate: pg?.baseRate || 0.02,
        },
      });
      
      console.log(`[CardType] Auto-created card type: ${code} for PG ${pgId}`);
    }
    
    return cardType;
  },
  
  /**
   * Generate human-readable name for card type
   */
  generateCardTypeName(response: {
    internalPG?: string;
    cardNetwork?: string;
    cardCategory?: string;
  }): string {
    const parts = [];
    
    if (response.internalPG) {
      parts.push(response.internalPG.charAt(0).toUpperCase() + response.internalPG.slice(1));
    }
    if (response.cardNetwork) {
      parts.push(response.cardNetwork.toUpperCase());
    }
    if (response.cardCategory) {
      parts.push(response.cardCategory.charAt(0).toUpperCase() + response.cardCategory.slice(1));
    }
    
    return parts.join(' ') || 'Unknown Card Type';
  },
  
  /**
   * Get rate for a transaction based on card type
   */
  async getTransactionRate(userId: string, pgId: string, cardTypeCode?: string): Promise<{
    rate: number;
    cardTypeId?: string;
    source: 'USER_CARD_TYPE' | 'SCHEMA_CARD_TYPE' | 'CARD_TYPE_BASE' | 'USER_PG' | 'SCHEMA_PG' | 'PG_BASE';
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // If card type code provided, try card type specific rates
    if (cardTypeCode) {
      const cardType = await prisma.cardType.findUnique({
        where: {
          pgId_code: { pgId, code: cardTypeCode },
        },
      });
      
      if (cardType) {
        // Check user card type rate
        const userCardTypeRate = await prisma.userCardTypeRate.findUnique({
          where: {
            userId_cardTypeId: { userId, cardTypeId: cardType.id },
          },
        });
        
        if (userCardTypeRate) {
          return {
            rate: userCardTypeRate.payinRate,
            cardTypeId: cardType.id,
            source: 'USER_CARD_TYPE',
          };
        }
        
        // Check schema card type rate
        if (user.schemaId) {
          const schemaCardTypeRate = await prisma.schemaCardTypeRate.findUnique({
            where: {
              schemaId_cardTypeId: { schemaId: user.schemaId, cardTypeId: cardType.id },
            },
          });
          
          if (schemaCardTypeRate) {
            return {
              rate: schemaCardTypeRate.payinRate,
              cardTypeId: cardType.id,
              source: 'SCHEMA_CARD_TYPE',
            };
          }
        }
        
        // Use card type base rate
        return {
          rate: cardType.baseRate,
          cardTypeId: cardType.id,
          source: 'CARD_TYPE_BASE',
        };
      }
    }
    
    // Fall back to PG-level rates
    const userPGRate = await prisma.userPGRate.findUnique({
      where: {
        userId_pgId: { userId, pgId },
      },
    });
    
    if (userPGRate) {
      return { rate: userPGRate.payinRate, source: 'USER_PG' };
    }
    
    // Check schema PG rate
    if (user.schemaId) {
      const schemaPGRate = await prisma.schemaPGRate.findUnique({
        where: {
          schemaId_pgId: { schemaId: user.schemaId, pgId },
        },
      });
      
      if (schemaPGRate) {
        return { rate: schemaPGRate.payinRate, source: 'SCHEMA_PG' };
      }
    }
    
    // Fall back to PG base rate
    const pg = await prisma.paymentGateway.findUnique({
      where: { id: pgId },
    });
    
    return { rate: pg?.baseRate || 0, source: 'PG_BASE' };
  },
};

