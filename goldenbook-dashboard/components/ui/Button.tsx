import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 text-lg font-semibold rounded-xl px-8 py-4 transition-colors cursor-pointer";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-gold text-white hover:bg-gold-dark active:bg-[#A5835A]",
    secondary:
      "bg-text text-white hover:bg-[#333330] active:bg-[#444440]",
    outline:
      "border-2 border-gold text-gold bg-white hover:bg-[#FBF7F0]",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
