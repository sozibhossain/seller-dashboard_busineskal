'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { authAPI } from '@/lib/api';

export default function EnterOTPPage() {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    const storedEmail = localStorage.getItem('resetEmail');
    if (!storedEmail) {
      router.push('/auth/forgot-password');
      return;
    }
    setEmail(storedEmail);
  }, [router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const resendOTPMutation = useMutation({
    mutationFn: () => authAPI.forgotPassword(email),
    onSuccess: () => {
      toast.success('OTP resent to your email');
      setCanResend(false);
      setResendTimer(60);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to resend OTP';
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }
    localStorage.setItem('resetOTP', otp);
    router.push('/auth/reset-password');
  };

  const handleResend = () => {
    if (canResend) resendOTPMutation.mutate();
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4" 
      style={{ backgroundColor: 'rgba(245, 243, 240, 1)' }}
    >
      <div className="w-full max-w-[600px]">
        <CardHeader className="mb-8">
          <CardTitle className="text-xl font-semibold text-center text-gray-900">
            Enter OTP
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                className="gap-4"
              >
                <InputOTPGroup className="gap-3">
                  {[...Array(6)].map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="w-[70px] h-[85px] border-[#F0C478] bg-white rounded-lg text-3xl font-bold text-[#D99B29] border-2 focus:ring-2 focus:ring-[#D99B29]"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="text-center text-lg">
              <span className="text-gray-900">Didn't Receive OTP? </span>
              <button
                type="button"
                onClick={handleResend}
                className="font-semibold text-[#D99B29] hover:text-[#c08924] transition-colors"
              >
                {resendOTPMutation.isPending ? 'SENDING...' : 'RESEND OTP'}
                {!canResend && !resendOTPMutation.isPending && ` (${resendTimer}s)`}
              </button>
            </div>

            <Button
              type="submit"
              disabled={otp.length !== 6}
              className="w-full h-14 bg-[#D99B29] hover:bg-[#c08924] text-white text-xl font-medium rounded-lg transition-colors"
            >
              Verify
            </Button>
          </form>
        </CardContent>
      </div>
    </div>
  );
}