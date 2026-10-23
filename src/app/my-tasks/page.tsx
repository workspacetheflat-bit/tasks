import { AppShell } from "@/components/app-shell";
import { EmptyState, Money, Notice, PageHeading, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dateKeyInZone, formatDateArabic, isValidDateKey } from "@/lib/date";
import { connectToDatabase } from "@/lib/db";
import { CourseCompletion, Deduction } from "@/models";
import { ensureDailyOccurrences, getBreaks, getCurrentTaskCompletionModes } from "@/server/queries";
import { occurrenceCompletionMode } from "@/lib/task-completion";
import {
  recordCourseCompletionAction,
  submitTaskReviewAction,
  updateCompletionAction,
} from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function MemberTasksPage({ searchParams }: { searchParams: Promise<{ date?: string; saved?: string; error?: string }> }) {
  const user = await requireUser("member");
  const params = await searchParams;
  const dateKey = params.date && isValidDateKey(params.date) ? params.date : dateKeyInZone();
  const { occurrences } = await ensureDailyOccurrences(user.id, dateKey);
  const completionModes = await getCurrentTaskCompletionModes(occurrences.map((item) => item.taskId));
  const breaks = await getBreaks(user.id, dateKey);
  const breakTaskKeys = new Set(breaks.map((item) => (item.courseTaskId as unknown as { key: string }).key));
  const required = occurrences.filter((item) => !breakTaskKeys.has(item.taskKeySnapshot));
  const completeCount = required.filter((item) => item.status === "completed").length;
  await connectToDatabase();
  const deductions = await Deduction.find({ memberId: user.id }).sort({ dateKey: -1, createdAt: -1 }).limit(10).lean();
  const completions = await CourseCompletion.find({ memberId: user.id }).sort({ completionDate: -1 }).limit(4).populate("courseTaskId", "nameAr").lean();

  return (
    <AppShell user={user}>
      <PageHeading eyebrow="مساحتي اليومية" title="مهامي اليومية" description={formatDateArabic(dateKey)} />
      <Notice code={params.error || params.saved} />
      <section className="toolbar-card">
        <div><span className="eyebrow">إنجاز اليوم</span><strong>{completeCount} من {required.length} مهام مكتملة</strong></div>
        <form action="/my-tasks" className="inline-form"><label htmlFor="date">اختر يوماً</label><input id="date" name="date" type="date" defaultValue={dateKey} /><button className="button button-secondary" type="submit">عرض</button></form>
      </section>
      <div className="progress-track" aria-label={`إنجاز ${completeCount} من ${required.length}`}><span style={{ width: `${required.length ? Math.round(completeCount / required.length * 100) : 0}%` }} /></div>
      <section className="task-list">
        {occurrences.map((item) => {
          const exempt = breakTaskKeys.has(item.taskKeySnapshot);
          const taskId = String(item.taskId);
          const completionMode = completionModes.has(taskId)
            ? occurrenceCompletionMode(
              item.status,
              completionModes.get(taskId) ?? null,
              item.completionModeSnapshot,
            )
            : null;
          const requiresReview = completionMode === "review";
          return <article className={`task-card ${item.status === "completed" ? "task-done" : ""}`} key={String(item._id)}>
            <div className="task-card-main">
              <div className="task-title-row"><h2>{item.taskNameSnapshot}</h2>{exempt ? <StatusBadge status="scheduled" /> : <StatusBadge status={item.status} />}</div>
              <p className="task-criteria">{exempt ? breaks.find((entry) => (entry.courseTaskId as unknown as { key: string }).key === item.taskKeySnapshot)?.reason : item.reviewNote && item.status === "incomplete" ? `ملاحظة المراجعة: ${item.reviewNote}` : item.memberNote || "أنجزي المهمة حسب معيارها اليومي."}</p>
              <div className="task-meta"><span><Money amount={item.taskValueSnapshot} /></span><span>{exempt ? "معفاة لهذا اليوم فقط" : "قيمة المهمة اليومية"}</span></div>
            </div>
            {!exempt && completionMode === "self" && <form action={updateCompletionAction} className="task-action-form">
              <input name="occurrenceId" type="hidden" value={String(item._id)} />
              <label className="note-label">ملاحظة (اختياري)<input name="note" maxLength={500} defaultValue={item.memberNote} placeholder="أضيفي ملاحظة" /></label>
              <button className={`button ${item.status === "completed" ? "button-secondary" : "button-primary"}`} name="status" type="submit" value={item.status === "completed" ? "incomplete" : "completed"}>
                {item.status === "completed" ? "إلغاء الإكمال" : "تمت المهمة"}
              </button>
            </form>}
            {!exempt && requiresReview && item.status === "incomplete" && <form action={submitTaskReviewAction} className="task-action-form">
              <input name="occurrenceId" type="hidden" value={String(item._id)} />
              <label className="note-label">ملاحظة للمسؤول (اختياري)<input name="note" maxLength={500} defaultValue={item.memberNote} placeholder="أضيفي تفاصيل الإتمام" /></label>
              <button className="button button-primary" type="submit">طلب مراجعة</button>
            </form>}
            {!exempt && requiresReview && item.status === "needs_review" && <p className="muted">تم إرسال المهمة، وهي بانتظار مراجعة المسؤول.</p>}
            {!exempt && completionMode === null && item.status !== "completed" && <p className="notice error">تعذر التحقق من إعداد المهمة. تواصل مع المسؤول.</p>}
          </article>;
        })}
        {occurrences.length === 0 && <EmptyState>لا توجد مهام نشطة لهذا اليوم.</EmptyState>}
      </section>

      <section className="panel section-gap">
        <div className="panel-heading"><div><p className="eyebrow">المسارات التعليمية</p><h2>تسجيل إتمام دورة</h2></div></div>
        <p className="muted">يمكن جدولة يوم راحة واحد بعد تاريخ الإتمام. الإعفاء يخص مسار الدورة المختار فقط.</p>
        <form action={recordCourseCompletionAction} className="form-grid">
          <label>المسار<select name="taskKey" required><option value="nutrition-beauty-course">دورة التغذية أو التجميل</option><option value="quran-course">دورة القرآن</option></select></label>
          <label>اسم الدورة<input name="courseName" maxLength={160} required /></label>
          <label>تاريخ الإتمام<input name="completionDate" type="date" defaultValue={dateKey} required /></label>
          <label>سبب يوم الراحة (اختياري)<input name="breakReason" maxLength={500} placeholder="مثال: استراحة بعد إتمام الدورة" /></label>
          <label className="full-span">ملاحظات<input name="notes" maxLength={500} /></label>
          <button className="button button-primary" type="submit">حفظ إتمام الدورة</button>
        </form>
      </section>
      <section className="content-grid section-gap">
        <article className="panel"><div className="panel-heading"><div><p className="eyebrow">السجل المالي</p><h2>أحدث الخصومات</h2></div></div>
          {deductions.length === 0 && <EmptyState>لا توجد خصومات مسجلة.</EmptyState>}
          {deductions.map((item) => <div className="list-row" key={String(item._id)}><div><strong>{item.taskNameSnapshot}</strong><small>{formatDateArabic(item.dateKey)} · {item.reason}</small></div><div className="row-end"><Money amount={item.amount} /><StatusBadge status={item.status} /></div></div>)}
        </article>
        <article className="panel"><div className="panel-heading"><div><p className="eyebrow">سجل الدورات</p><h2>آخر ما أُنجز</h2></div></div>
          {completions.length === 0 && <EmptyState>لم تُسجل دورات مكتملة بعد.</EmptyState>}
          {completions.map((item) => <div className="list-row" key={String(item._id)}><div><strong>{item.courseName}</strong><small>{(item.courseTaskId as unknown as { nameAr: string }).nameAr} · {formatDateArabic(item.completionDate)}</small></div></div>)}
        </article>
      </section>
    </AppShell>
  );
}
