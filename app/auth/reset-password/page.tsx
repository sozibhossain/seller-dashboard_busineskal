'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    const storedEmail = localStorage.getItem('resetEmail');
    const storedOTP = localStorage.getItem('resetOTP');
    
    if (!storedEmail || !storedOTP) {
      router.push('/auth/forgot-password');
      return;
    }
    
    setEmail(storedEmail);
    setOtp(storedOTP);
  }, [router]);

  const resetPasswordMutation = useMutation({
    mutationFn: () => authAPI.resetPassword(email, otp, newPassword, confirmPassword),
    onSuccess: () => {
      toast.success('Password reset successful. Please login.');
      localStorage.removeItem('resetEmail');
      localStorage.removeItem('resetOTP');
      router.push('/auth/login');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to reset password.';
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    resetPasswordMutation.mutate();
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4" 
      style={{ backgroundColor: 'rgba(245, 243, 240, 1)' }}
    >
      <div className="w-full max-w-[500px]">
        <CardHeader className="mb-10 p-0">
          <CardTitle className="text-xl font-semibold text-center text-gray-900">
            Reset Password
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div className="space-y-3">
              <Label htmlFor="newPassword" className="text-base font-medium text-gray-900">
                New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D99B29]" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-14 pl-12 border-[#F0C478] bg-white rounded-lg focus-visible:ring-[#D99B29] text-base"
                  disabled={resetPasswordMutation.isPending}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-3">
              <Label htmlFor="confirmPassword" className="text-base font-medium text-gray-900">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D99B29]" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-14 pl-12 border-[#F0C478] bg-white rounded-lg focus-visible:ring-[#D99B29] text-base"
                  disabled={resetPasswordMutation.isPending}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="w-full h-14 bg-[#D99B29] hover:bg-[#c08924] text-white text-lg font-medium rounded-lg transition-colors shadow-sm mt-4"
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </div>
    </div>
  );
}