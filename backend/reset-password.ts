import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword(email: string, newPassword: string) {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      return;
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the password
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    console.log(`✅ Password reset successfully for ${email}`);
    console.log(`📧 Email: ${updatedUser.email}`);
    console.log(`🆔 User ID: ${updatedUser.id}`);
    console.log(`👤 Name: ${updatedUser.firstName} ${updatedUser.lastName}`);
    console.log(`📊 Role: ${updatedUser.role}`);
    console.log(`📌 Status: ${updatedUser.status}`);
    console.log(`\n🔐 New Password: ${newPassword}`);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email and password from command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: npx ts-node reset-password.ts <email> <newPassword>');
  console.error('Example: npx ts-node reset-password.ts shabbhg@gmail.com MyNewPassword123');
  process.exit(1);
}

resetPassword(email, password);
