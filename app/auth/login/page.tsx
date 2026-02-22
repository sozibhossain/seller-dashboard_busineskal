'use client';

import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => authAPI.login(email, password),
    onSuccess: (response) => {
      const { accessToken, refreshToken, role, _id, name, email } = response.data.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('userId', _id);
      localStorage.setItem('role', role);
      localStorage.setItem('userData', JSON.stringify({ _id, name, email, role }));

      toast.success('Login successful');
      router.push('/dashboard');
      router.refresh();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    loginMutation.mutate();
  };

  return (
    // Fixed the background style interpolation
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(245, 243, 240, 1)' }}>
      <div className="w-full max-w-[500px]"> {/* Increased max-width to match the visual weight of the image */}
        <CardHeader className="space-y-3 mb-4">
          <CardTitle className="text-3xl font-bold text-gray-900">Login To Your Account</CardTitle>
          <CardDescription className="text-gray-400 text-lg">
            Please enter your email and password to continue
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-3">
              <Label htmlFor="email" className="text-base font-medium text-gray-900">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D99B29]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 pl-12 border-[#F0C478] bg-white rounded-lg focus-visible:ring-[#D99B29]"
                  disabled={loginMutation.isPending}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-3">
              <Label htmlFor="password" className="text-base font-medium text-gray-900">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D99B29]" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 pl-12 border-[#F0C478] bg-white rounded-lg focus-visible:ring-[#D99B29]"
                  disabled={loginMutation.isPending}
                />
              </div>
              <div className="flex justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-[#D99B29] hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-14 bg-[#D99B29] hover:bg-[#c08924] text-white text-lg font-medium rounded-lg transition-colors"
            >
              {loginMutation.isPending ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </div>
    </div>
  );
}