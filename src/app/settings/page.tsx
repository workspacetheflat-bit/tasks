import { AppShell } from "@/components/app-shell";
import { EmptyState, Notice, PageHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { TaskDefinition } from "@/models";
import { updateTaskSettingsAction } from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireUser("admin");
  const params = await searchParams;
  await connectToDatabase();
  const tasks = await TaskDefinition.find().sort({ displayOrder: 1, key: -1 }).lean();
  return (
    <AppShell user={user}>
      <PageHeading eyebrow="إدارة المهام" title="إعدادات المهام" description="التعديلات تسري على السجلات الجديدة فقط؛ القيم المحفوظة تاريخياً لا تتغير." />
      <Notice code={params.error || params.saved} />
      <div className="notice info">تعطيل المهمة يمنع إنشاء مهام يومية جديدة لها، ولا يحذف أي سجل سابق.</div>
      <section className="settings-list">
        {tasks.map((task) => <article className="panel settings-card" key={String(task._id)}>
          <form action={updateTaskSettingsAction} className="form-grid">
            <input name="taskId" type="hidden" value={String(task._id)} />
            <label>اسم المهمة بالعربية<input name="nameAr" required minLength={2} maxLength={120} defaultValue={task.nameAr} /></label>
            <label>القيمة اليومية (جنيه)<input name="dailyValue" type="number" min={0} step={1} required defaultValue={task.dailyValue} /></label>
            <label>معامل الخصم<input name="deductionMultiplier" type="number" min={0} step={1} required defaultValue={task.deductionMultiplier} /></label>
            <label>المدة المتوقعة (دقيقة)<input name="durationMinutes" type="number" min={0} step={1} required defaultValue={task.durationMinutes} /></label>
            <label className="full-span">معيار الإنجاز<input name="completionCriteria" required minLength={3} maxLength={500} defaultValue={task.completionCriteria} /></label>
            <label>الحالة<select name="isActive" defaultValue={task.isActive ? "true" : "false"}><option value="true">نشطة</option><option value="false">متوقفة</option></select></label>
            <div className="settings-submit"><button className="button button-primary" type="submit">حفظ المهمة</button></div>
          </form>
        </article>)}
        {tasks.length === 0 && <EmptyState>لم يتم إعداد المهام. شغّل أمر seed:tasks أولاً.</EmptyState>}
      </section>
    </AppShell>
  );
}
