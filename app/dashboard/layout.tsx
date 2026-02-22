'use client';

import React from "react";
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import Header from "@/components/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50" style={{ backgroundColor: 'rgba(245, 243, 240, 1)' }}>
      {/* The Sidebar (Fixed position) */}
      <DashboardSidebar />
      
      <div className="flex flex-col lg:ml-72 min-h-screen">
        <Header />
        <main className="p-4 md:p-8">
          <div className="">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}