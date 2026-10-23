import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Money, Notice, PageHeading, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { currentMonthInZone, dateKeyInZone, formatDateArabic, formatMonthArabic, isValidMonth } from "@/lib/date";
import { calculateMonthlySummary } from "@/lib/finance";
import { MONTHLY_BASE_COMPENSATION } from "@/lib/config";
import { AuditEvent, CourseBreak, Deduction, User } from "@/models";
import { ensureDailyOccurrences } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ month?: string; date?: string; saved?: string; error?: string }> }) {
  const user = await requireUser("admin");
  const params = await searchParams;
  const today = dateKeyInZone();
  const dateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const month = params.month && isValidMonth(params.month) ? params.month : currentMonthInZone();
  await connectToDatabase();
  const member = await User.findOne({ role: "member", isActive: true }).select("_id displayName").lean();
  const dayData = member ? await ensureDailyOccurrences(String(member._id), dateKey) : { tasks: [], occurrences: [] };
  const breaks = member ? await CourseBreak.find({ memberId: member._id, dateKey, status: "scheduled" }).populate("courseTaskId", "key").lean() : [];
  const breakTaskIds = new Set(breaks.map((item) => String(item.courseTaskId?._id ?? item.courseTaskId)));
  const requiredOccurrences = dayData.occurrences.filter((item) => !breakTaskIds.has(String(item.taskId)));
  const completed = requiredOccurrences.filter((item) => item.status === "completed").length;
  const incomplete = requiredOccurrences.filter((item) => item.status === "incomplete").length;
  const awaiting = requiredOccurrences.filter((item) => item.status === "needs_review").length;
  const deductions = member
    ? await Deduction.find({ memberId: member._id, dateKey: { $regex: `^${month}` } }).select("amount status").lean()
    : [];
  const summary = calculateMonthlySummary(deductions.map((item) => ({ amount: item.amount, status: item.status })));
  const pendingCount = deductions.filter((item) => item.status === "pending").length;
  const recentActivity = await AuditEvent.find().sort({ createdAt: -1 }).limit(6).populate("actorId", "displayName").lean();

  return (
    <AppShell user={user}>
      <PageHeading eyebrow="نظرة عامة" title="لوحة المتابعة" description={`مرحباً ${user.displayName}، إليك ملخص اليوم والشهر.`} />
      <Notice code={params.error || params.saved} />
      <section className="toolbar-card">
        <div><span className="eyebrow">اليوم المحدد</span><strong>{formatDateArabic(dateKey)}</strong></div>
        <form className="inline-form" action="/dashboard">
          <label htmlFor="month">الشهر</label><input id="month" name="month" type="month" defaultValue={month} />
          <label htmlFor="date">التاريخ</label><input id="date" name="date" type="date" defaultValue={dateKey} />
          <button className="button button-secondary" type="submit">عرض</button>
        </form>
      </section>
      {!member && <div className="notice error">لم يتم إنشاء حساب العضو بعد. شغّل أمر إعداد المستخدمين من دليل الإعداد.</div>}
      {member && <p className="muted member-caption">ملخص المهام لـ {member.displayName}</p>}

      <section className="metrics-grid">
        <MetricCard label="المهام المكتملة" value={`${completed} / ${requiredOccurrences.length}`} detail="للمهام المطلوبة في اليوم المحدد" tone="green" />
        <MetricCard label="غير مكتملة" value={String(incomplete)} detail="تحتاج إلى متابعة المسؤول" tone={incomplete ? "red" : undefined} />
        <MetricCard label="بانتظار المراجعة" value={String(awaiting)} tone="gold" />
        <MetricCard label="خصومات معلّقة" value={String(pendingCount)} detail={new Intl.NumberFormat("ar-EG").format(deductions.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0)) + " جنيه"} tone="gold" />
      </section>

      <section className="metrics-grid finance-grid">
        <MetricCard label="الراتب الأساسي" value={<Money amount={MONTHLY_BASE_COMPENSATION} />} detail={formatMonthArabic(month)} />
        <MetricCard label="الخصومات المعتمدة" value={<Money amount={summary.approvedDeductions} />} tone="red" />
        <MetricCard label="صافي المستحق" value={<Money amount={summary.netPayable} />} tone="green" />
        <MetricCard label="الخصومات المعلّقة" value={<Money amount={summary.pendingDeductions} />} detail="لا تخصم قبل الاعتماد" tone="gold" />
      </section>
      {summary.excessDeductions > 0 && <div className="notice error">تجاوزت الخصومات المعتمدة الراتب الأساسي بمقدار <Money amount={summary.excessDeductions} />. صافي المستحق صفر مع الاحتفاظ بكامل السجل.</div>}

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">متابعة يومية</p><h2>حالة المهام</h2></div><Link className="text-link" href={`/daily-review?date=${dateKey}`}>مراجعة اليوم ←</Link></div>
          {dayData.occurrences.map((item) => {
            const exempt = breakTaskIds.has(String(item.taskId));
            return <div className="list-row" key={String(item._id)}>
              <span>{item.taskNameSnapshot}{exempt && <small className="break-label"> · يوم فاصل</small>}</span>
              <StatusBadge status={exempt ? "scheduled" : item.status} />
            </div>;
          })}
          {dayData.occurrences.length === 0 && <p className="muted">لا توجد مهام مفعّلة حتى الآن.</p>}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">آخر التغييرات</p><h2>النشاط الأخير</h2></div><Link className="text-link" href="/reports">التقارير ←</Link></div>
          {recentActivity.length === 0 && <p className="muted">لا يوجد نشاط مسجل بعد.</p>}
          {recentActivity.map((event) => <div className="activity-row" key={String(event._id)}>
            <span className="activity-dot" />
            <div><strong>{event.action.replaceAll(".", " · ")}</strong><small>{(event.actorId as { displayName?: string } | null)?.displayName ?? "النظام"} · {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(event.createdAt)}</small></div>
          </div>)}
        </article>
      </section>
    </AppShell>
  );
}
