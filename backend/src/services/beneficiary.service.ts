import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

interface CreateBeneficiaryDTO {
  name: string;
  nickName?: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string;
  accountType?: string;
  email?: string;
  phone?: string;
}

// Validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string): boolean => {
  // Indian mobile number: 10 digits starting with 6-9
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

const validateIfsc = (ifsc: string): boolean => {
  // IFSC: 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
};

const validateAccountNumber = (accountNumber: string): boolean => {
  // Account number: 9-18 digits
  const cleaned = accountNumber.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 18;
};

export const beneficiaryService = {
  async createBeneficiary(userId: string, data: CreateBeneficiaryDTO) {
    // Validate required fields
    if (!data.name || data.name.trim().length < 3) {
      throw new AppError('Name must be at least 3 characters', 400);
    }
    
    if (!data.accountNumber || !validateAccountNumber(data.accountNumber)) {
      throw new AppError('Invalid account number (must be 9-18 digits)', 400);
    }
    
    if (!data.ifscCode || !validateIfsc(data.ifscCode)) {
      throw new AppError('Invalid IFSC code format (e.g., HDFC0001234)', 400);
    }
    
    // Validate optional fields if provided
    if (data.email && !validateEmail(data.email)) {
      throw new AppError('Invalid email address', 400);
    }
    
    if (data.phone && !validatePhone(data.phone)) {
      throw new AppError('Invalid mobile number (must be 10 digits starting with 6-9)', 400);
    }
    
    // Check if beneficiary with same account already exists for this user
    const existing = await prisma.beneficiary.findFirst({
      where: {
        userId,
        accountNumber: data.accountNumber.replace(/\D/g, ''),
        ifscCode: data.ifscCode.toUpperCase(),
      },
    });

    if (existing) {
      throw new AppError('Beneficiary with this account already exists', 400);
    }
    
    // Get bank details from IFSC
    const bankDetails = await this.getIfscDetails(data.ifscCode);

    const beneficiary = await prisma.beneficiary.create({
      data: {
        userId,
        name: data.name.trim(),
        nickName: data.nickName?.trim(),
        accountNumber: data.accountNumber.replace(/\D/g, ''),
        ifscCode: data.ifscCode.toUpperCase(),
        bankName: bankDetails?.bank || data.bankName || this.getBankNameFromIfsc(data.ifscCode),
        accountType: data.accountType || 'SAVINGS',
        email: data.email?.toLowerCase().trim(),
        phone: data.phone?.replace(/\D/g, ''),
      },
    });

    return beneficiary;
  },

  async getBeneficiaries(userId: string, params?: { search?: string; isActive?: boolean }) {
    const where: any = { userId };

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { nickName: { contains: params.search } },
        { accountNumber: { contains: params.search } },
        { bankName: { contains: params.search } },
      ];
    }

    const beneficiaries = await prisma.beneficiary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return beneficiaries;
  },

  async getBeneficiaryById(userId: string, beneficiaryId: string) {
    const beneficiary = await prisma.beneficiary.findFirst({
      where: {
        id: beneficiaryId,
        userId,
      },
    });

    if (!beneficiary) {
      throw new AppError('Beneficiary not found', 404);
    }

    return beneficiary;
  },

  async updateBeneficiary(userId: string, beneficiaryId: string, data: Partial<CreateBeneficiaryDTO>) {
    const beneficiary = await this.getBeneficiaryById(userId, beneficiaryId);

    // If account details are being changed, check for duplicates
    if (data.accountNumber || data.ifscCode) {
      const existing = await prisma.beneficiary.findFirst({
        where: {
          userId,
          accountNumber: data.accountNumber || beneficiary.accountNumber,
          ifscCode: data.ifscCode || beneficiary.ifscCode,
          id: { not: beneficiaryId },
        },
      });

      if (existing) {
        throw new AppError('Beneficiary with this account already exists', 400);
      }
    }

    const updated = await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: {
        name: data.name,
        nickName: data.nickName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode?.toUpperCase(),
        bankName: data.bankName,
        accountType: data.accountType,
        email: data.email,
        phone: data.phone,
      },
    });

    return updated;
  },

  async deleteBeneficiary(userId: string, beneficiaryId: string) {
    await this.getBeneficiaryById(userId, beneficiaryId);

    // Check if beneficiary has any transactions
    const transactionCount = await prisma.transaction.count({
      where: { beneficiaryId },
    });

    if (transactionCount > 0) {
      // Soft delete - just mark as inactive
      await prisma.beneficiary.update({
        where: { id: beneficiaryId },
        data: { isActive: false },
      });
      return { message: 'Beneficiary deactivated (has transaction history)' };
    }

    // Hard delete if no transactions
    await prisma.beneficiary.delete({
      where: { id: beneficiaryId },
    });

    return { message: 'Beneficiary deleted' };
  },

  async toggleBeneficiaryStatus(userId: string, beneficiaryId: string) {
    const beneficiary = await this.getBeneficiaryById(userId, beneficiaryId);

    const updated = await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: { isActive: !beneficiary.isActive },
    });

    return updated;
  },

  // Verify beneficiary account (mock - in production, call bank API)
  async verifyBeneficiary(userId: string, beneficiaryId: string) {
    const beneficiary = await this.getBeneficiaryById(userId, beneficiaryId);

    // In production, this would call a bank API to verify the account
    // For now, we'll mark it as verified after a mock verification
    const updated = await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    return updated;
  },

  // Fetch IFSC details from external API
  async getIfscDetails(ifscCode: string): Promise<{
    bank: string;
    branch: string;
    address: string;
    city: string;
    state: string;
  } | null> {
    try {
      // Use Razorpay's free IFSC API
      const response = await fetch(`https://ifsc.razorpay.com/${ifscCode.toUpperCase()}`);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      return {
        bank: data.BANK || '',
        branch: data.BRANCH || '',
        address: data.ADDRESS || '',
        city: data.CITY || '',
        state: data.STATE || '',
      };
    } catch (error) {
      console.error('Error fetching IFSC details:', error);
      return null;
    }
  },

  // Helper to get bank name from IFSC code (fallback)
  getBankNameFromIfsc(ifscCode: string): string {
    const bankCodes: Record<string, string> = {
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'SBIN': 'State Bank of India',
      'UTIB': 'Axis Bank',
      'KKBK': 'Kotak Mahindra Bank',
      'YESB': 'Yes Bank',
      'PUNB': 'Punjab National Bank',
      'BARB': 'Bank of Baroda',
      'CNRB': 'Canara Bank',
      'UBIN': 'Union Bank of India',
      'IDFB': 'IDFC First Bank',
      'INDB': 'IndusInd Bank',
      'FDRL': 'Federal Bank',
      'RATN': 'RBL Bank',
      'CITI': 'Citibank',
      'SCBL': 'Standard Chartered Bank',
      'HSBC': 'HSBC Bank',
      'DBSS': 'DBS Bank',
      'AIRP': 'Airtel Payments Bank',
      'PYTM': 'Paytm Payments Bank',
      'JAKA': 'Jammu & Kashmir Bank',
      'KARB': 'Karnataka Bank',
      'KVBL': 'Karur Vysya Bank',
      'SIBL': 'South Indian Bank',
      'TMBL': 'Tamilnad Mercantile Bank',
      'CSBK': 'Catholic Syrian Bank',
      'DLXB': 'Dhanlaxmi Bank',
      'LAVB': 'Lakshmi Vilas Bank',
      'NKGS': 'NKGSB Co-op Bank',
      'BKID': 'Bank of India',
      'CBIN': 'Central Bank of India',
      'UCBA': 'UCO Bank',
      'PSIB': 'Punjab & Sind Bank',
      'BDBL': 'Bandhan Bank',
      'ESFB': 'Equitas Small Finance Bank',
      'AUBL': 'AU Small Finance Bank',
      'UJVN': 'Ujjivan Small Finance Bank',
      'JSFB': 'Jana Small Finance Bank',
      'FSFB': 'Fincare Small Finance Bank',
      'NSPB': 'North East Small Finance Bank',
      'SVCB': 'Shamrao Vithal Co-op Bank',
      'CORP': 'Union Bank (erstwhile Corp Bank)',
      'ANDB': 'Union Bank (erstwhile Andhra Bank)',
      'ORBC': 'PNB (erstwhile Oriental Bank)',
      'ALLA': 'Indian Bank (erstwhile Allahabad Bank)',
      'IDIB': 'Indian Bank',
      'MAHB': 'Bank of Maharashtra',
      'IOBA': 'Indian Overseas Bank',
    };

    const prefix = ifscCode.substring(0, 4).toUpperCase();
    return bankCodes[prefix] || 'Unknown Bank';
  },
  
  // Public endpoint to lookup IFSC
  async lookupIfsc(ifscCode: string) {
    if (!validateIfsc(ifscCode)) {
      throw new AppError('Invalid IFSC code format', 400);
    }
    
    const details = await this.getIfscDetails(ifscCode);
    
    if (!details) {
      // Fallback to local mapping
      const bankName = this.getBankNameFromIfsc(ifscCode);
      return {
        ifsc: ifscCode.toUpperCase(),
        bank: bankName,
        branch: '',
        address: '',
        city: '',
        state: '',
        valid: bankName !== 'Unknown Bank',
      };
    }
    
    return {
      ifsc: ifscCode.toUpperCase(),
      ...details,
      valid: true,
    };
  },
};

