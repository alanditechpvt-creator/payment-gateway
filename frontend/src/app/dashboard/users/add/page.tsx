'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to users page - add user is handled via modal
export default function AddUserPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/dashboard/users?action=add');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
    </div>
  );
}

