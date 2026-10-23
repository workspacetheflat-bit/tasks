import { AppShell } from "@/components/app-shell";
import { EmptyState, Money, Notice, PageHeading, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { DeductionDecision } from "@/components/deduction-decision";
import { currentMonthInZone, formatDateArabic, isValidMonth } from "@/lib/date";
import { connectToDatabase } from "@/lib/db";
import { Deduction, TaskDefinition, User, AuditEvent } from "@/models";

export const dynamic = "force-dynamic";

export default async function DeductionsPage({ searchParams }: { searchParams: Promise<{ month?: string; status?: string; task?: string; saved?: string; error?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const month = params.month && isValidMonth(params.month) ? params.month : currentMonthInZone();
  await connectToDatabase();
  const member = user.role === "member" ? user.id : String((await User.findOne({ role: "member", isActive: true }).select("_id").lean())?._id ?? "");
  const status = ["pending", "approved", "rejected"].includes(params.status ?? "") ? params.status : "";
  const tasks = await TaskDefinition.find().sort({ displayOrder: 1 }).select("key nameAr").lean();
  const query: Record<string, unknown> = { memberId: member, dateKey: { $regex: `^${month}` } };
  if (status) query.status = status;
  if (params.task && tasks.some((task) => task.key === params.task)) {
    const chosen = tasks.find((task) => task.key === params.task);
    if (chosen) query.taskId = chosen._id;
  }
  const deductions = member
    ? await Deduction.find(query).sort({ dateKey: -1, createdAt: -1 }).populate("createdBy", "displayName").populate("reviewedBy", "displayName").lean()
    : [];
  const deductionIds = deductions.map((item) => item._id);
  const auditEvents = deductionIds.length
    ? await AuditEvent.find({ entityType: "deduction", entityId: { $in: deductionIds } }).sort({ createdAt: -1 }).limit(40).populate("actorId", "displayName").lean()
    : [];

  return (
    <AppShell user={user}>
      <PageHeading eyebrow="الشفافية المالية" title="سجل الخصومات" description="كل خصم مرتبط بمهمة وتاريخ وسبب، ولا يؤثر المعلّق على المستحق." />
      <Notice code={params.error || params.saved} />
      <form action="/deductions" className="filter-bar">
        <label>الشهر<input type="month" name="month" defaultValue={month} /></label>
        <label>المهمة<select name="task" defaultValue={params.task ?? ""}><option value="">كل المهام</option>{tasks.map((task) => <option key={String(task._id)} value={task.key}>{task.nameAr}</option>)}</select></label>
        <label>الحالة<select name="status" defaultValue={status}><option value="">كل الحالات</option><option value="pending">قيد المراجعة</option><option value="approved">معتمدة</option><option value="rejected">مرفوضة</option></select></label>
        <button className="button button-secondary" type="submit">تصفية</button>
      </form>
      <section className="panel table-panel">
        <div className="panel-heading"><div><p className="eyebrow">السجل المحفوظ</p><h2>{deductions.length} سجل</h2></div></div>
        {deductions.length === 0 ? <EmptyState>لا توجد خصومات تطابق عوامل التصفية.</EmptyState> :
          <div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>المهمة</th><th>المبلغ</th><th>السبب</th><th>الحالة</th><th>المراجع</th><th>الإجراء</th></tr></thead>
            <tbody>{deductions.map((item) => <tr key={String(item._id)}>
              <td>{formatDateArabic(item.dateKey)}</td><td>{item.taskNameSnapshot}</td><td><strong><Money amount={item.amount} /></strong></td><td>{item.reason}{item.rejectionReason && <small className="table-subtext">سبب الرفض: {item.rejectionReason}</small>}</td>
              <td><StatusBadge status={item.status} /></td><td>{(item.reviewedBy as { displayName?: string } | null)?.displayName ?? "—"}</td>
              <td>{user.role === "admin" && item.status === "pending" && <DeductionDecision deductionId={String(item._id)} />}{item.status !== "pending" && <span className="muted">{item.reviewedAt ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(item.reviewedAt) : "—"}</span>}</td>
            </tr>)}</tbody></table></div>}
      </section>
      <section className="panel section-gap">
        <div className="panel-heading"><div><p className="eyebrow">سجل التدقيق</p><h2>قرارات المراجعة</h2></div></div>
        {auditEvents.length === 0 && <EmptyState>لا توجد قرارات مسجلة لهذا العرض.</EmptyState>}
        {auditEvents.map((event) => <div className="list-row" key={String(event._id)}>
          <div><strong>{event.action === "deduction.approved" ? "اعتماد خصم" : event.action === "deduction.rejected" ? "رفض خصم" : "اقتراح خصم"}</strong><small>{event.reason || "—"}</small></div>
          <small>{(event.actorId as { displayName?: string } | null)?.displayName ?? "—"} · {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(event.createdAt)}</small>
        </div>)}
      </section>
    </AppShell>
  );
}
