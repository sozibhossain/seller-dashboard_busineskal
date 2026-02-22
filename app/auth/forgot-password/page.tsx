'use client';

import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const forgotPasswordMutation = useMutation({
    mutationFn: () => authAPI.forgotPassword(email),
    onSuccess: () => {
      toast.success('OTP sent to your email');
      localStorage.setItem('resetEmail', email);
      router.push('/auth/enter-otp');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to send OTP. Please try again.';
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    forgotPasswordMutation.mutate();
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4" 
      style={{ backgroundColor: 'rgba(245, 243, 240, 1)' }}
    >
      <div className="w-full max-w-[500px]">
        <CardHeader className="space-y-3 mb-6 p-0">
          <CardTitle className="text-3xl font-bold text-gray-900 text-left">
            Forgot Password
          </CardTitle>
          <CardDescription className="text-[#A3A3A3] text-lg leading-relaxed text-left max-w-[450px]">
            Enter your registered email address. We'll send you a code to reset your password.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-base font-medium text-gray-900">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D99B29]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 pl-12 border-[#F0C478] bg-white rounded-lg focus-visible:ring-[#D99B29] text-base"
                  disabled={forgotPasswordMutation.isPending}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={forgotPasswordMutation.isPending}
              className="w-full h-14 bg-[#D99B29] hover:bg-[#c08924] text-white text-lg font-medium rounded-lg transition-colors shadow-sm mt-2"
            >
              {forgotPasswordMutation.isPending ? 'Sending...' : 'Send OTP'}
            </Button>
          </form>
        </CardContent>
      </div>
    </div>
  );
}