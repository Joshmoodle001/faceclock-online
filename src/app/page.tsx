'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center mb-2">
          <Camera className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">FaceAttend</h1>
      </div>
      <Button size="lg" asChild className="min-w-[200px]">
        <Link href="/login">Admins Only</Link>
      </Button>
    </div>
  );
}
