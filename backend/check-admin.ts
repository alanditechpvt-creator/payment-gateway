import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAndUpdateAdmin() {
  try {
    // Check existing admin users
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });

    console.log('\n📋 Existing Admin Users:');
    admins.forEach(admin => {
      console.log(`  - ${admin.email} (${admin.firstName} ${admin.lastName}) - Status: ${admin.status}`);
    });

    // Check if admin@newweb.com exists
    const targetAdmin = await prisma.user.findUnique({
      where: { email: 'admin@newweb.com' }
    });

    if (targetAdmin) {
      console.log('\n✅ admin@newweb.com exists');
      console.log('Setting password to Admin@123456...');
      
      const hashedPassword = await bcrypt.hash('Admin@123456', 12);
      await prisma.user.update({
        where: { email: 'admin@newweb.com' },
        data: { password: hashedPassword }
      });
      
      console.log('✅ Password updated successfully');
    } else {
      console.log('\n❌ admin@newweb.com does not exist');
      console.log('Would you like to update admin@alandi.in email to admin@newweb.com?');
      
      // Update admin@alandi.in to admin@newweb.com
      const alandiAdmin = await prisma.user.findUnique({
        where: { email: 'admin@alandi.in' }
      });
      
      if (alandiAdmin) {
        console.log('\n🔄 Updating admin@alandi.in to admin@newweb.com...');
        const hashedPassword = await bcrypt.hash('Admin@123456', 12);
        
        await prisma.user.update({
          where: { email: 'admin@alandi.in' },
          data: { 
            email: 'admin@newweb.com',
            password: hashedPassword
          }
        });
        
        console.log('✅ Updated successfully');
        console.log('\n📧 Login credentials:');
        console.log('   Email: admin@newweb.com');
        console.log('   Password: Admin@123456');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndUpdateAdmin();
