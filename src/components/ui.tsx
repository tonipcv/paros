"use client";

import { ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LucideIcon, X } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  children,
  ...rest
}: {
  className?: string;
  variant?: ButtonVariant;
  children?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-btn text-body font-medium h-9 px-4 transition-colors duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed";
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-highlight text-bg hover:opacity-90 active:bg-accent",
    secondary:
      "bg-transparent border border-borderDefault text-secondary hover:border-borderHover hover:text-primary active:bg-bgActive",
    ghost: "bg-transparent text-secondary hover:bg-bgHover active:bg-bgActive h-8 px-3",
    danger: "bg-danger text-white hover:opacity-90",
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

export function Card({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className || ""}`}>{children}</div>;
}

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "accent";
}) {
  const colors = {
    default: "bg-bgActive text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    accent: "border border-borderDefault bg-bgPage text-primary",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

/* Page scaffolding: one container + one header pattern for every app page. */

export function PageContainer({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  const widths = { narrow: "max-w-3xl", default: "max-w-[1200px]", wide: "max-w-none" };
  return <div className={`mx-auto w-full px-5 py-8 sm:px-8 ${widths[width]} ${className || ""}`}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-borderDefault pb-6">
      <div>
        <h1 className="text-h1 text-grad-light">{title}</h1>
        {description ? <p className="mt-1 text-body text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* Modal with framer-motion entrance; closes on overlay click and Escape. */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
        className={`relative w-full ${width} rounded-card border border-borderDefault bg-surface p-5 shadow-card-hover`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h2 text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-7 w-7 place-items-center rounded-btn text-tertiary transition hover:bg-bgHover hover:text-primary"
          >
            <X size={15} />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </motion.div>
    </div>
  );
}

/* Dropdown that closes on outside click and Escape. */

export function Dropdown({
  trigger,
  children,
  align = "left",
  width = "w-72",
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className={`absolute top-full z-40 mt-2 ${width} ${align === "right" ? "right-0" : "left-0"} rounded-card border border-borderDefault bg-surface p-1.5 shadow-card-hover`}
        >
          {children(() => onOpenChange(false))}
        </motion.div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: {
  icon?: LucideIcon;
  label: string;
  description?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-btn px-2.5 py-2 text-left transition hover:bg-bgHover ${
        active ? "text-primary" : "text-secondary"
      }`}
    >
      {Icon ? <Icon size={15} className={`mt-0.5 shrink-0 ${active ? "text-primary" : "text-tertiary"}`} /> : null}
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-[11px] leading-4 text-tertiary">{description}</span> : null}
      </span>
    </button>
  );
}

/* Toggle switch. */

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-highlight" : "bg-bgActive"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200 ${
          checked ? "left-[18px] bg-bg" : "left-0.5 bg-secondary"
        }`}
      />
    </button>
  );
}

/* Segmented control (Device/Synced, Monthly/Yearly, ...). */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-btn bg-bgActive p-0.5 text-[12px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-[6px] px-3 py-1.5 font-medium transition ${
            value === option.value ? "bg-highlight text-bg" : "text-secondary hover:text-primary"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* Empty state. */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-borderDefault px-6 py-14 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-bgActive text-tertiary">
        <Icon size={18} />
      </span>
      <p className="mt-4 text-body font-medium text-primary">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-caption text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* Stat card (usage/admin metrics): plain, borderless, Linear-style. */

export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="border-l border-borderDefault pl-4 first:border-l-0 first:pl-0 max-sm:border-l-0 max-sm:pl-0">
      <div className="flex items-center gap-1.5 text-caption text-muted">
        <Icon size={13} className="text-tertiary" />
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-primary">{value}</p>
    </div>
  );
}

/* Skeleton helpers for loading states. */

export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ""}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
