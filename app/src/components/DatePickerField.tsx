import { useRef } from "react";
import { formatDateStandard } from "@/lib/helpers";

interface DatePickerFieldProps {
  label: string;
  value: string; // ISO format (YYYY-MM-DD)
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  wrapperClassName?: string;
  variant?: "case-modal" | "visit-modal"; // Different styling contexts
}

/**
 * StandardDatePickerField
 * 
 * Universal date picker field component with:
 * - Formatted date display (DD-MMM-YYYY)
 * - Calendar icon SVG
 * - Browser native date picker via showPicker()
 * - Full field click area triggers picker
 * - Fallback to focus() for unsupported browsers
 * 
 * Usage:
 * - In case modals: variant="case-modal" (field-label wrapper styling)
 * - In visit modals: variant="visit-modal" (custom styling)
 */
export function DatePickerField({
  label,
  value,
  onChange,
  inputRef,
  wrapperClassName,
  variant = "case-modal",
}: DatePickerFieldProps) {
  const handleWrapperClick = () => {
    if (inputRef.current) {
      if ("showPicker" in inputRef.current) {
        (inputRef.current as HTMLInputElement).showPicker();
      } else {
        (inputRef.current as HTMLInputElement).focus();
      }
    }
  };

  if (variant === "visit-modal") {
    return (
      <div className={wrapperClassName || "grid-gap-1"}>
        <label className="text-sm-medium-slate-700">{label}</label>
        <div 
          className="relative cursor-pointer"
          onClick={handleWrapperClick}
        >
          <input
            type="text"
            className="input-h10-border-white w-full pr-10"
            value={value ? formatDateStandard(value) : ""}
            readOnly
          />
          <svg 
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
          <input
            ref={inputRef}
            type="date"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-lg"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    );
  }

  // Default: case-modal variant
  return (
    <div className={wrapperClassName || "field-label"}>
      <span className="field-label-text">{label}</span>
      <div 
        className="relative cursor-pointer w-full h-10"
        onClick={handleWrapperClick}
      >
        <input
          type="text"
          className="field-input w-full pr-10"
          value={value ? formatDateStandard(value) : ""}
          readOnly
        />
        <svg 
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
        <input
          ref={inputRef}
          type="date"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
