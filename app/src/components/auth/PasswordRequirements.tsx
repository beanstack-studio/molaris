interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  if (!password) return null;

  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);

  return (
    <div className="flex gap-3 mt-1.5">
      <span className={hasLength ? "text-xs text-emerald-600 font-medium" : "text-xs text-slate-400"}>
        {hasLength ? "✓" : "·"} 8+ characters
      </span>
      <span className={hasNumber ? "text-xs text-emerald-600 font-medium" : "text-xs text-slate-400"}>
        {hasNumber ? "✓" : "·"} one number
      </span>
    </div>
  );
}
