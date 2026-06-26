"use client";

import { AuthCard } from "./AuthCard";

interface AuthSuccessProps {
  message: string;
  subMessage?: string;
}

export function AuthSuccess({ message, subMessage }: AuthSuccessProps) {
  return (
    <AuthCard>
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-emerald-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{message}</p>
          {subMessage && (
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{subMessage}</p>
          )}
        </div>
        <div className="flex gap-1 text-gray-300">
          <span className="animate-bounce text-2xl [animation-delay:0ms]">·</span>
          <span className="animate-bounce text-2xl [animation-delay:150ms]">·</span>
          <span className="animate-bounce text-2xl [animation-delay:300ms]">·</span>
        </div>
      </div>
    </AuthCard>
  );
}
