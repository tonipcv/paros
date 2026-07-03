"use client";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  children,
  ...rest
}: {
  className?: string;
  variant?: ButtonVariant;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-btn text-body font-medium h-9 px-4 transition-colors duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed";
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-highlight text-bg hover:opacity-90 active:bg-accent",
    secondary:
      "bg-transparent border border-borderDefault text-secondary hover:border-borderHover hover:text-primary active:bg-bgActive",
    ghost: "bg-transparent text-secondary hover:bg-bgHover active:bg-bgActive h-8 px-3",
    danger: "bg-danger text-white hover:bg-red-600",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className || ""}`} {...rest}>
      {children}
    </button>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className || ""}`} {...rest} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input min-h-[80px] resize-y py-2 ${className || ""}`} {...rest} />;
}

export function Card({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={`card p-5 ${className || ""}`}>{children}</div>;
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "accent";
}) {
  const colors = {
    default: "bg-bgActive text-secondary",
    success: "bg-green-500/10 text-success",
    warning: "bg-amber-500/10 text-warning",
    accent: "border border-borderDefault bg-bgPage text-primary",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}
