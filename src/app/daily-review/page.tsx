import { AppShell } from "@/components/app-shell";
import { EmptyState, Money, Notice, PageHeading, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isValidDateKey, dateKeyInZone, formatDateArabic } from "@/lib/date";
import { connectToDatabase } from "@/lib/db";
import { CourseBreak, DailyTaskOccurrence, Deduction, User } from "@/models";
import { createDeductionAction, recordCourseCompletionAction, reviewCompletionAction, reviewTaskSubmissionAction } from "@/server/actions";
import { ensureDailyOccurrences } from "@/server/queries";
import { effectiveCompletionMode } from "@/lib/task-completion";

export const dynamic = "force-dynamic";

export default async function DailyReviewPage({ searchParams }: { searchParams: Promise<{ date?: string; saved?: string; error?: string }> }) {
  const user = await requireUser("admin");
  const params = await searchParams;
  const dateKey = params.date && isValidDateKey(params.date) ? params.date : dateKeyInZone();
  await connectToDatabase();
  const member = await User.findOne({ role: "member", isActive: true }).select("_id displayName").lean();
  const { occurrences } = member ? await ensureDailyOccurrences(String(member._id), dateKey) : { occurrences: [] };
  const reviewRequests = member
    ? await DailyTaskOccurrence.find({ memberId: member._id, status: "needs_review", completionModeSnapshot: "review" })
      .sort({ dateKey: 1, createdAt: 1 })
      .lean()
    : [];
  const reviewRequestIds = new Set(reviewRequests.map((item) => String(item._id)));
  const regularOccurrences = occurrences.filter((item) => !reviewRequestIds.has(String(item._id)));
  const breaks = member ? await CourseBreak.find({ memberId: member._id, dateKey, status: "scheduled" }).populate("courseTaskId", "key nameAr").lean() : [];
  const breakTaskIds = new Set(breaks.map((item) => String(item.courseTaskId?._id ?? item.courseTaskId)));
  const existingDeductions = member ? await Deduction.find({ memberId: member._id, dateKey }).select("occurrenceId").lean() : [];
  const deductionOccurrenceIds = new Set(existingDeductions.map((item) => String(item.occurrenceId)));

  return (
    <AppShell user={user}>
      <PageHeading eyebrow="إدارة اليوم" title="مراجعة المهام" description="راجع حالة العضو، وسجّل سبباً قبل اقتراح أي خصم." />
      <Notice code={params.error || params.saved} />
      {!member && <div className="notice error">لا يوجد حساب عضو نشط. أنشئ الحساب الأولي قبل مراجعة المهام.</div>}
      <section className="toolbar-card">
        <div><span className="eyebrow">التاريخ المحدد</span><strong>{formatDateArabic(dateKey)}</strong></div>
        <form action="/daily-review" className="inline-form"><label htmlFor="date">التاريخ</label><input id="date" name="date" type="date" defaultValue={dateKey} /><button className="button button-secondary" type="submit">عرض</button></form>
      </section>
      {breaks.length > 0 && <section className="notice info"><strong>يوم فاصل لمسار محدد:</strong> {breaks.map((item) => <span key={String(item._id)}>{(item.courseTaskId as unknown as { nameAr: string }).nameAr}: {item.reason} </span>)}المهام الأخرى تظل مطلوبة.</section>}
      <section className="panel section-gap">
        <div className="panel-heading"><div><p className="eyebrow">طلبات الأعضاء</p><h2>طلبات مراجعة الإكمال</h2></div><strong>{reviewRequests.length} طلب</strong></div>
        {reviewRequests.length === 0 && <EmptyState>لا توجد طلبات إكمال بانتظار المراجعة لهذا اليوم.</EmptyState>}
        <div className="task-list">
          {reviewRequests.map((item) => <article className="panel review-card" key={String(item._id)}>
            <div className="panel-heading">
              <div><h3>{item.taskNameSnapshot}</h3><p className="muted">{member?.displayName ?? "العضو"} · {formatDateArabic(item.dateKey)}</p></div>
              <StatusBadge status={item.status} />
            </div>
            <p>{item.memberNote || "لم يضف العضو ملاحظة."}</p>
            <form action={reviewTaskSubmissionAction} className="review-form">
              <input name="occurrenceId" type="hidden" value={String(item._id)} />
              <label className="full-span">ملاحظة المراجعة (اختياري)<textarea name="note" maxLength={500} rows={2} defaultValue={item.reviewNote} /></label>
              <div className="review-decision-actions">
                <button className="button button-primary" name="decision" type="submit" value="approved">موافقة</button>
                <button className="button button-danger" name="decision" type="submit" value="rejected">رفض</button>
              </div>
            </form>
          </article>)}
        </div>
      </section>
      <section className="task-list">
        {regularOccurrences.map((item) => {
          const exempt = breakTaskIds.has(String(item.taskId));
          const hasDeduction = deductionOccurrenceIds.has(String(item._id));
          const reviewMode = effectiveCompletionMode(item.completionModeSnapshot) === "review";
          return <article className="panel review-card" key={String(item._id)}>
            <div className="panel-heading">
              <div><h2>{item.taskNameSnapshot}</h2><p className="muted">قيمة المهمة <Money amount={item.taskValueSnapshot} /> · الخصم المقترح <Money amount={item.taskValueSnapshot * item.deductionMultiplierSnapshot} /></p></div>
              {exempt ? <StatusBadge status="scheduled" /> : <StatusBadge status={item.status} />}
            </div>
            {exempt && <p className="break-label">معفاة في هذا اليوم فقط؛ لن ينشأ عنها خصم.</p>}
            {!exempt && <div className="review-actions">
              {!reviewMode && <form action={reviewCompletionAction} className="review-form">
                <input name="occurrenceId" type="hidden" value={String(item._id)} />
                <label>تحديث الحالة<select name="status" defaultValue={item.status}><option value="incomplete">غير مكتملة</option><option value="completed">مكتملة</option><option value="needs_review">تحتاج مراجعة</option></select></label>
                <label className="reason-field">سبب المراجعة (مطلوب)<input name="reason" required minLength={3} maxLength={500} placeholder="وضح سبب تأكيد أو تصحيح الحالة" /></label>
                <button className="button button-secondary" type="submit">حفظ المراجعة</button>
              </form>}
              {item.status !== "completed" && <form action={createDeductionAction} className="deduction-proposal">
                <input name="occurrenceId" type="hidden" value={String(item._id)} />
                <label>سبب اقتراح الخصم (مطلوب)<textarea name="reason" required minLength={3} maxLength={1000} rows={2} placeholder="سجّل سبباً واضحاً للمراجعة قبل الاعتماد" /></label>
                <button className="button button-danger" disabled={hasDeduction} type="submit">{hasDeduction ? "يوجد خصم لهذه المهمة" : "اقتراح خصم قيد المراجعة"}</button>
                <small className="muted">الاقتراح لا يخصم من المستحق حتى اعتماده من مسؤول.</small>
              </form>}
            </div>}
          </article>;
        })}
        {occurrences.length === 0 && <EmptyState>لا توجد مهام نشطة. أضف المهام من الإعدادات أولاً.</EmptyState>}
      </section>
      <section className="panel section-gap">
        <div className="panel-heading"><div><p className="eyebrow">المسارات التعليمية</p><h2>تسجيل إتمام دورة</h2></div></div>
        <p className="muted">يُسجل يوم الراحة تلقائياً في اليوم التالي لتاريخ الإتمام، ويخص مساراً تعليمياً واحداً فقط.</p>
        <form action={recordCourseCompletionAction} className="form-grid">
          <label>المسار<select name="taskKey" required><option value="nutrition-beauty-course">دورة التغذية أو التجميل</option><option value="quran-course">دورة القرآن</option></select></label>
          <label>اسم الدورة<input name="courseName" maxLength={160} required /></label>
          <label>تاريخ الإتمام<input name="completionDate" type="date" defaultValue={dateKey} required /></label>
          <label>سبب يوم الراحة (اختياري)<input name="breakReason" maxLength={500} placeholder="مثال: استراحة بعد إتمام الدورة" /></label>
          <label className="full-span">ملاحظات<input name="notes" maxLength={500} /></label>
          <button className="button button-primary" type="submit">حفظ إتمام الدورة</button>
        </form>
      </section>
    </AppShell>
  );
}
