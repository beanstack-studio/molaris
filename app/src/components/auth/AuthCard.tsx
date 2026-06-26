"use client";

import type { ReactNode } from "react";

interface AuthCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#eef2fa]">
      <div className="bg-white rounded-xl shadow-sm max-w-sm w-full mx-auto overflow-hidden">
        {/* Brand header */}
        <div className="px-8 pt-8 flex flex-col items-center text-center">
          <img
            src="/web-app-manifest-192x192.png"
            width={64}
            height={64}
            alt="Molaris"
            className="rounded-2xl mx-auto mb-3 object-cover ring-4 ring-indigo-100"
          />
          <p className="text-xl font-bold text-gray-900 tracking-tight">Molaris</p>
          <p className="text-xs text-gray-500 mt-0.5">Clinic Management Portal</p>
          {title && (
            <p className="text-lg font-semibold text-gray-900 mb-1 mt-6">{title}</p>
          )}
          {subtitle && (
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{subtitle}</p>
          )}
        </div>

        {/* Content slot */}
        <div className={title || subtitle ? "px-8 pb-8" : "px-8 pb-8 mt-6"}>
          {children}
        </div>

        {/* Footer */}
        <div className="text-[11px] text-gray-400 text-center py-4 border-t border-gray-100">
          Powered by Beanstack Studio · Molaris Clinic Management
        </div>
      </div>
    </div>
  );
}
