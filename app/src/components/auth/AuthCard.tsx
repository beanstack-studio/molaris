"use client";

import type { ReactNode } from "react";

interface AuthCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="login-page-bg">
      <div className="login-card">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center pb-6">
          <img
            src="/web-app-manifest-192x192.png"
            width={64}
            height={64}
            alt="Molaris"
            className="rounded-2xl mx-auto mb-3 object-cover ring-4 ring-white/60"
          />
          <p className="text-xl font-bold text-gray-900 tracking-tight">Molaris</p>
          <p className="text-xs text-gray-500 mt-0.5">Clinic Management Portal</p>
          {title && (
            <p className="text-lg font-semibold text-gray-900 mt-6 mb-0">{title}</p>
          )}
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{subtitle}</p>
          )}
        </div>

        {/* Content slot */}
        {children}

        {/* Footer */}
        <div className="text-[11px] text-gray-400 text-center pt-5 mt-5 border-t border-gray-100">
          Powered by Beanstack Studio · Molaris Clinic Management
        </div>
      </div>
    </div>
  );
}
