import { AppShell } from "@/components/app-shell";
import { EmptyState, Notice, PageHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dateKeyInZone, formatDateArabic } from "@/lib/date";
import { connectToDatabase } from "@/lib/db";
import { personalTodoDueState } from "@/lib/personal-todos";
import { PersonalTodo } from "@/models";
import { AlarmClock, CalendarDays, Check, CircleCheck, ListTodo, Plus, Sparkles } from "lucide-react";
import {
  createPersonalTodoAction,
  deletePersonalTodoAction,
  togglePersonalTodoAction,
  updatePersonalTodoAction,
} from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function PersonalTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; todo?: string }>;
}) {
  const user = await requireUser("member");
  const params = await searchParams;
  await connectToDatabase();
  const personalTodos = await PersonalTodo.find({ memberId: user.id })
    .sort({ isCompleted: 1, dueDate: 1, createdAt: -1 })
    .lean();
  const openTodos = personalTodos.filter((todo) => !todo.isCompleted);
  const completedTodos = personalTodos.filter((todo) => todo.isCompleted);
  const today = dateKeyInZone();
  const overdueTodos = openTodos.filter((todo) => personalTodoDueState(todo.dueDate, today) === "overdue");
  const todayTodos = openTodos.filter((todo) => personalTodoDueState(todo.dueDate, today) === "today");
  const completedPercent = personalTodos.length ? Math.round(completedTodos.length / personalTodos.length * 100) : 0;

  return (
    <AppShell user={user}>
      <PageHeading eyebrow="مساحتك للإنجاز" title="مهامي الشخصية" description="خطط ليومك، تابع ما يستحق الاهتمام، واحتفل بكل خطوة صغيرة." />
      <Notice code={params.error || params.saved || (params.todo === "saved" ? "todo=saved" : undefined)} />
      <section className="personal-todo-overview">
        <div className="personal-todo-hero">
          <div className="personal-todo-hero-copy">
            <span className="personal-todo-hero-icon"><Sparkles aria-hidden="true" size={20} /></span>
            <p className="eyebrow">مساحة خاصة بك</p>
            <h2>كل إنجاز يبدأ بخطوة</h2>
            <p>رتّب أولوياتك وحدد موعداً واضحاً لكل مهمة. هذه القائمة لك وحدك ولا تؤثر على مهامك اليومية المطلوبة.</p>
          </div>
          <div className="personal-todo-progress-card">
            <div className="personal-todo-progress-title"><CircleCheck aria-hidden="true" size={18} /><span>إنجازك الكلي</span></div>
            <strong>{completedPercent}<small>٪</small></strong>
            <div className="personal-todo-progress-track" role="progressbar" aria-label="نسبة إنجاز المهام الشخصية" aria-valuenow={completedPercent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${completedPercent}%` }} />
            </div>
            <small>{completedTodos.length} من {personalTodos.length} مهام مكتملة</small>
          </div>
        </div>
        <div className="personal-todo-stats">
          <article className="personal-todo-stat"><span className="todo-stat-icon stat-open"><ListTodo aria-hidden="true" size={18} /></span><div><small>مهام مفتوحة</small><strong>{openTodos.length}</strong></div></article>
          <article className={`personal-todo-stat ${overdueTodos.length ? "todo-stat-alert" : ""}`}><span className="todo-stat-icon stat-overdue"><AlarmClock aria-hidden="true" size={18} /></span><div><small>متأخرة</small><strong>{overdueTodos.length}</strong></div></article>
          <article className="personal-todo-stat"><span className="todo-stat-icon stat-today"><CalendarDays aria-hidden="true" size={18} /></span><div><small>موعدها اليوم</small><strong>{todayTodos.length}</strong></div></article>
          <article className="personal-todo-stat"><span className="todo-stat-icon stat-done"><Check aria-hidden="true" size={18} /></span><div><small>مكتملة</small><strong>{completedTodos.length}</strong></div></article>
        </div>
      </section>

      <section className="personal-todo-create-panel">
        <div className="personal-todo-create-heading">
          <span className="personal-todo-add-icon"><Plus aria-hidden="true" size={20} /></span>
          <div><p className="eyebrow">فكرة جديدة؟</p><h2>أضف مهمة إلى قائمتك</h2></div>
        </div>
        <form action={createPersonalTodoAction} className="personal-todo-create">
          <label className="todo-title-field">عنوان المهمة<input name="title" required maxLength={120} placeholder="مثال: إنهاء فصل من الكتاب" /></label>
          <label className="todo-date-field">تاريخ الاستحقاق<input name="dueDate" type="date" required defaultValue={today} /><small>حدد موعداً — يبدأ افتراضياً من اليوم</small></label>
          <label className="todo-description-field">الوصف <span>اختياري</span><textarea name="description" maxLength={1000} rows={2} placeholder="أضف تفاصيل تساعدك على البدء..." /></label>
          <button className="button button-primary todo-add-button" type="submit"><Plus aria-hidden="true" size={16} />إضافة للقائمة</button>
        </form>
      </section>

      <section className="personal-todo-list-panel">
        <div className="personal-todo-list-heading">
          <div><p className="eyebrow">خطتك ومتابعتك</p><h2>قائمة مهامي</h2></div>
          <span className="personal-todo-total">{personalTodos.length} {personalTodos.length === 1 ? "مهمة" : "مهام"}</span>
        </div>
        <div className="personal-todo-sections">
          <div>
            <h3>المهام المفتوحة <span className="todo-count">{openTodos.length}</span></h3>
            {openTodos.length === 0 && <EmptyState>لا توجد مهام مفتوحة.</EmptyState>}
            {openTodos.map((todo) => {
              const dueState = personalTodoDueState(todo.dueDate, today);
              return <article className={`personal-todo-card todo-due-${dueState}`} key={String(todo._id)}>
                <div className="personal-todo-check" aria-hidden="true"><span /></div>
                <div className="personal-todo-copy">
                  <strong>{todo.title}</strong>
                  {todo.description && <p>{todo.description}</p>}
                  <small className={`todo-due-label due-label-${dueState}`}>
                    <CalendarDays aria-hidden="true" size={13} />
                    {todo.dueDate ? `${dueState === "overdue" ? "متأخرة · " : dueState === "today" ? "تستحق اليوم · " : ""}${formatDateArabic(todo.dueDate)}` : "موعد قديم غير محدد"}
                  </small>
                </div>
              <div className="personal-todo-actions">
                <form action={togglePersonalTodoAction}>
                  <input name="todoId" type="hidden" value={String(todo._id)} />
                  <button className="button button-primary button-small" type="submit"><Check aria-hidden="true" size={14} />إنجاز</button>
                </form>
                <form action={deletePersonalTodoAction}>
                  <input name="todoId" type="hidden" value={String(todo._id)} />
                  <button className="button button-quiet button-small" type="submit">حذف</button>
                </form>
                <details className="todo-edit-details">
                  <summary>تعديل</summary>
                  <form action={updatePersonalTodoAction} className="todo-edit-form">
                    <input name="todoId" type="hidden" value={String(todo._id)} />
                    <label>العنوان<input name="title" required maxLength={120} defaultValue={todo.title} /></label>
                    <label>الوصف (اختياري)<textarea name="description" maxLength={1000} rows={2} defaultValue={todo.description} /></label>
                    <label>تاريخ الاستحقاق<input name="dueDate" type="date" required defaultValue={todo.dueDate ?? today} /></label>
                    <button className="button button-primary button-small" type="submit">حفظ التعديل</button>
                  </form>
                </details>
              </div>
              </article>;
            })}
          </div>
          <div>
            <h3>المهام المكتملة <span className="todo-count">{completedTodos.length}</span></h3>
            {completedTodos.length === 0 && <EmptyState>لم تكتمل مهام شخصية بعد.</EmptyState>}
            {completedTodos.map((todo) => <article className="personal-todo-card personal-todo-done" key={String(todo._id)}>
              <div className="personal-todo-check todo-check-done"><Check aria-hidden="true" size={14} /></div>
              <div className="personal-todo-copy">
                <strong>{todo.title}</strong>
                {todo.description && <p>{todo.description}</p>}
                <small className="todo-due-label"><CalendarDays aria-hidden="true" size={13} />{todo.dueDate ? formatDateArabic(todo.dueDate) : "موعد قديم غير محدد"}</small>
              </div>
              <div className="personal-todo-actions">
                <form action={togglePersonalTodoAction}>
                  <input name="todoId" type="hidden" value={String(todo._id)} />
                  <button className="button button-secondary button-small" type="submit">إعادة فتح</button>
                </form>
                <form action={deletePersonalTodoAction}>
                  <input name="todoId" type="hidden" value={String(todo._id)} />
                  <button className="button button-quiet button-small" type="submit">حذف</button>
                </form>
                <details className="todo-edit-details">
                  <summary>تعديل</summary>
                  <form action={updatePersonalTodoAction} className="todo-edit-form">
                    <input name="todoId" type="hidden" value={String(todo._id)} />
                    <label>العنوان<input name="title" required maxLength={120} defaultValue={todo.title} /></label>
                    <label>الوصف (اختياري)<textarea name="description" maxLength={1000} rows={2} defaultValue={todo.description} /></label>
                    <label>تاريخ الاستحقاق<input name="dueDate" type="date" required defaultValue={todo.dueDate ?? today} /></label>
                    <button className="button button-primary button-small" type="submit">حفظ التعديل</button>
                  </form>
                </details>
              </div>
            </article>)}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
