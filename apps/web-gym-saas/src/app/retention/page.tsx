'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RetentionRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/communications');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-xs">
      Redirecting to Messaging & Communications Center...
    </div>
  );
}