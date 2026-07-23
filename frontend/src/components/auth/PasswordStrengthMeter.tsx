import React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const checks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "Uppercase letter (A-Z)", valid: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", valid: /[a-z]/.test(password) },
    { label: "Number (0-9)", valid: /\d/.test(password) },
    { label: "Special character (!@#$%^&*)", valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];

  const score = checks.filter((c) => c.valid).length;

  const getLabel = () => {
    if (score === 0) return "Very Weak";
    if (score <= 2) return "Weak";
    if (score === 3) return "Fair";
    if (score === 4) return "Good";
    return "Strong";
  };

  const getColor = () => {
    if (score <= 2) return "bg-red-500 text-red-400";
    if (score === 3) return "bg-amber-500 text-amber-400";
    if (score === 4) return "bg-blue-500 text-blue-400";
    return "bg-emerald-500 text-emerald-400";
  };

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2 text-xs select-none animate-in fade-in duration-200">
      <div className="flex items-center justify-between font-medium">
        <span className="text-muted-foreground">Password Strength:</span>
        <span className={getColor().split(" ")[1]}>{getLabel()}</span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex gap-1">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-full flex-1 transition-all duration-300 ${
              step <= score ? getColor().split(" ")[0] : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Criteria Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 text-[11px]">
        {checks.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            {item.valid ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            )}
            <span className={item.valid ? "text-foreground font-medium" : "text-muted-foreground/70"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
