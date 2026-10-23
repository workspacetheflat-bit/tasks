"use client";

import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted heading-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ code }: { code?: string | string[] }) {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  if (value === "saved" || value === "1") {
    return <div className="notice success" role="status">تم حفظ التغييرات بنجاح.</div>;
  }
  const text = value === "duplicate"
    ? "يوجد سجل سابق لهذه المهمة أو اليوم؛ لا يمكن تكرار العملية."
    : value === "invalid"
      ? "يرجى مراجعة البيانات المدخلة والمحاولة مرة أخرى."
      : value === "configuration"
        ? "تعذر تسجيل الدخول بسبب إعداد غير مكتمل. يرجى مراجعة إعدادات الخادم."
        : "تعذر حفظ التغييرات. تحقق من البيانات والاتصال ثم أعد المحاولة.";
  return <div className="notice error" role="alert">{text}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    completed: "مكتملة",
    incomplete: "غير مكتملة",
    needs_review: "تحتاج مراجعة",
    pending: "قيد المراجعة",
    approved: "معتمدة",
    rejected: "مرفوضة",
    scheduled: "يوم فاصل",
    cancelled: "ملغى",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

export function MetricCard({ label, value, detail, tone }: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: "green" | "gold" | "red";
}) {
  return (
    <article className={`metric-card ${tone ? `metric-${tone}` : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Money({ amount }: { amount: number }) {
  return <>{new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(amount)} جنيه</>;
}

export function PrintButton() {
  return <button className="button button-secondary no-print" onClick={() => window.print()} type="button">طباعة التقرير</button>;
}
