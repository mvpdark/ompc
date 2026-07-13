import { cn } from "@/lib/zscj/utils";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

/* ---------- 状态标签 ---------- */

type StatusKind = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_STYLES: Record<StatusKind, string> = {
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-slate-100 text-slate-600",
};

export function StatusBadge({
  status,
  children,
}: {
  status: StatusKind;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {children}
    </span>
  );
}

export function statusFromValue(value: string | null | undefined): StatusKind {
  if (!value) return "neutral";
  const v = value.toLowerCase();
  if (["completed", "approved", "success", "done", "ok"].includes(v)) {
    return "success";
  }
  if (["running", "queued", "pending", "processing", "in_progress"].includes(v)) {
    return "warning";
  }
  if (["failed", "rejected", "error"].includes(v)) {
    return "danger";
  }
  return "neutral";
}

export function StatusBadgeForValue({ value }: { value: string | null | undefined }) {
  const kind = statusFromValue(value);
  const label = value ?? "未知";
  return <StatusBadge status={kind}>{label}</StatusBadge>;
}

/* ---------- 卡片 ---------- */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  icon: Icon,
  action,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-brand-600" />}
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------- 按钮 ---------- */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:opacity-50",
};

export function Button({
  children,
  variant = "primary",
  className,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ---------- 输入框 ---------- */

export function Input({
  label,
  className,
  ...props
}: {
  label?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <input
        className={cn(
          "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: {
  label?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <textarea
        className={cn(
          "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: {
  label?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <select
        className={cn(
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

/* ---------- 状态提示 ---------- */

export function LoadingSpinner({ label = "加载中..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-slate-400">{message}</div>
  );
}

/* ---------- 状态图标 ---------- */

export function StatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (["completed", "approved", "success"].includes(s)) {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  }
  if (["running", "queued", "pending", "processing"].includes(s)) {
    return <Clock className="h-4 w-4 text-amber-600" />;
  }
  if (["failed", "rejected", "error"].includes(s)) {
    return <XCircle className="h-4 w-4 text-red-600" />;
  }
  return null;
}
