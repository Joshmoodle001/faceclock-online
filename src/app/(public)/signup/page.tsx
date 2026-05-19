'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';

const signupSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupData) => {
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: data.orgName,
          email: data.email,
          password: data.password,
          displayName: data.displayName,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Registration failed');
        return;
      }

      setSuccess(true);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) {
        setError('Account created. Please sign in.');
        return;
      }

      router.push('/admin/dashboard');
    } catch {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Create Your Organization</CardTitle>
          <CardDescription>Set up your workspace to get started with FaceAttend</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="font-medium text-lg">Account created!</p>
              <p className="text-sm text-muted-foreground">Signing you in...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input id="orgName" placeholder="e.g. Acme Corp" {...register('orgName')} />
                {errors.orgName && <p className="text-sm text-destructive">{errors.orgName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Your Name</Label>
                <Input id="displayName" placeholder="John Doe" {...register('displayName')} />
                {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Create Organization
              </Button>
            </form>
          )}
        </CardContent>
        <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline hover:text-foreground">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
