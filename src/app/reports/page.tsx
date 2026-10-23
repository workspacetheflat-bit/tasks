import { AppShell } from "@/components/app-shell";
import { EmptyState, MetricCard, Money, PageHeading, PrintButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { currentMonthInZone, formatMonthArabic, isValidMonth } from "@/lib/date";
import { connectToDatabase } from "@/lib/db";
import { MONTHLY_BASE_COMPENSATION } from "@/lib/config";
import { calculateMonthlySummary } from "@/lib/finance";
import { DailyTaskOccurrence, Deduction, User } from "@/models";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser("admin");
  const params = await searchParams;
  const month = params.month && isValidMonth(params.month) ? params.month : currentMonthInZone();
  await connectToDatabase();
  const member = await User.findOne({ role: "member", isActive: true }).select("_id displayName").lean();
  const deductions = member ? await Deduction.find({ memberId: member._id, dateKey: { $regex: `^${month}` } }).sort({ dateKey: 1 }).lean() : [];
  const occurrences = member ? await DailyTaskOccurrence.find({ memberId: member._id, dateKey: { $regex: `^${month}` } }).sort({ dateKey: 1 }).lean() : [];
  const summary = calculateMonthlySummary(deductions.map((item) => ({ amount: item.amount, status: item.status })));
  const groups = new Map<string, { completed: number; incomplete: number; needsReview: number; name: string }>();
  for (const occurrence of occurrences) {
    const group = groups.get(occurrence.taskKeySnapshot) ?? { completed: 0, incomplete: 0, needsReview: 0, name: occurrence.taskNameSnapshot };
    if (occurrence.status === "completed") group.completed += 1;
    if (occurrence.status === "incomplete") group.incomplete += 1;
    if (occurrence.status === "needs_review") group.needsReview += 1;
    groups.set(occurrence.taskKeySnapshot, group);
  }

  return (
    <AppShell user={user}>
      <div className="print-report">
        <PageHeading eyebrow="الملخص المالي" title="التقرير الشهري" description={`${formatMonthArabic(month)}${member ? ` · ${member.displayName}` : ""}`} action={<PrintButton />} />
        <form action="/reports" className="filter-bar no-print"><label>اختر الشهر<input type="month" name="month" defaultValue={month} /></label><button className="button button-secondary" type="submit">عرض التقرير</button></form>
        <section className="metrics-grid report-metrics">
          <MetricCard label="الراتب الأساسي" value={<Money amount={MONTHLY_BASE_COMPENSATION} />} />
          <MetricCard label="خصومات معتمدة" value={<Money amount={summary.approvedDeductions} />} tone="red" />
          <MetricCard label="خصومات معلّقة" value={<Money amount={summary.pendingDeductions} />} detail="تُعرض منفصلة ولا تخصم" tone="gold" />
          <MetricCard label="خصومات مرفوضة" value={<Money amount={summary.rejectedDeductions} />} />
        </section>
        <section className="net-card"><div><span className="eyebrow">صافي المستحق بعد الاعتمادات</span><strong><Money amount={summary.netPayable} /></strong><small>الراتب الأساسي − الخصومات المعتمدة فقط</small></div></section>
        {summary.excessDeductions > 0 && <div className="notice error">تجاوزت الخصومات المعتمدة الراتب الأساسي بمقدار <Money amount={summary.excessDeductions} />. تم الحفاظ على كامل سجل الخصومات.</div>}

        <section className="panel section-gap">
          <div className="panel-heading"><div><p className="eyebrow">الإنجاز اليومي</p><h2>إحصاءات المهام</h2></div><span className="muted">{occurrences.length} سجل محفوظ</span></div>
          {groups.size === 0 ? <EmptyState>لا توجد سجلات مهام لهذا الشهر.</EmptyState> :
            <div className="table-scroll"><table><thead><tr><th>المهمة</th><th>مكتملة</th><th>غير مكتملة</th><th>تحتاج مراجعة</th><th>المجموع</th></tr></thead><tbody>
              {[...groups.values()].map((group) => <tr key={group.name}><td>{group.name}</td><td>{group.completed}</td><td>{group.incomplete}</td><td>{group.needsReview}</td><td>{group.completed + group.incomplete + group.needsReview}</td></tr>)}
            </tbody></table></div>}
        </section>
        <section className="panel section-gap">
          <div className="panel-heading"><div><p className="eyebrow">تفاصيل السجل</p><h2>الخصومات المسجلة</h2></div></div>
          {deductions.length === 0 ? <EmptyState>لا توجد خصومات خلال هذا الشهر.</EmptyState> :
            <div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>المهمة</th><th>السبب</th><th>الحالة</th><th>المبلغ</th></tr></thead><tbody>
              {deductions.map((item) => <tr key={String(item._id)}><td>{item.dateKey}</td><td>{item.taskNameSnapshot}</td><td>{item.reason}</td><td>{item.status === "approved" ? "معتمدة" : item.status === "rejected" ? "مرفوضة" : "قيد المراجعة"}</td><td><Money amount={item.amount} /></td></tr>)}
            </tbody></table></div>}
        </section>
        <p className="report-footnote">الحساب مبني على سجلات قاعدة البيانات للشهر المحدد. الخصومات المعلّقة والمرفوضة لا تُنقص صافي المستحق.</p>
      </div>
    </AppShell>
  );
}
