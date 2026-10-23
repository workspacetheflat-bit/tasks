import Link from "next/link";
import { ChartNoAxesCombined, ClipboardCheck, LayoutDashboard, LogOut, ReceiptText, Settings2, ListChecks, ClipboardList } from "lucide-react";
import { logoutAction } from "@/server/actions";
import type { AuthenticatedUser } from "@/lib/auth";

const adminLinks = [
  { href: "/dashboard", label: "لوحة المتابعة", Icon: LayoutDashboard },
  { href: "/daily-review", label: "مراجعة اليوم", Icon: ClipboardCheck },
  { href: "/deductions", label: "سجل الخصومات", Icon: ReceiptText },
  { href: "/reports", label: "التقارير الشهرية", Icon: ChartNoAxesCombined },
  { href: "/settings", label: "إعدادات المهام", Icon: Settings2 },
];

const memberLinks = [
  { href: "/my-tasks", label: "مهامي اليومية", Icon: ListChecks },
  { href: "/personal-tasks", label: "مهامي الشخصية", Icon: ClipboardList },
  { href: "/deductions", label: "سجل الخصومات", Icon: ReceiptText },
];

export function AppShell({ user, children }: { user: AuthenticatedUser; children: React.ReactNode }) {
  const links = user.role === "admin" ? adminLinks : memberLinks;
  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href={user.role === "admin" ? "/dashboard" : "/my-tasks"}>
            <span className="brand-mark">ي</span>
            <span><strong>يومي</strong><small>متابعة المهام والمكافأة</small></span>
          </Link>
          <nav aria-label="التنقل الرئيسي" className="main-nav">
            {links.map(({ href, label, Icon }) => <Link href={href} key={href}><Icon aria-hidden="true" size={15} strokeWidth={1.8} />{label}</Link>)}
          </nav>
          <div className="user-area">
            <span className="user-name">{user.displayName}</span>
            <form action={logoutAction}><button className="button button-quiet button-small" type="submit"><LogOut aria-hidden="true" size={14} />تسجيل الخروج</button></form>
          </div>
        </div>
      </header>
      <main className="page-container">{children}</main>
      <footer className="footer">متابعة يومية واضحة، ومكافأة محسوبة بعدل.</footer>
    </div>
  );
}
