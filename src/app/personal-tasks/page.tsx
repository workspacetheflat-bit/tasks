import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Notice, PageHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateArabic, shiftDateKey } from "@/lib/date";
import { connectToDatabase } from "@/lib/db";
import {
  personalTodoDueState,
  selectedPersonalTodoDate,
  splitPersonalTodosByDate,
} from "@/lib/personal-todos";
import { PersonalTodo } from "@/models";
import { AlarmClock, CalendarDays, Check, CircleCheck, ListTodo, Plus, Sparkles } from "lucide-react";
import { CelebrationActionForm, TaskCelebrationProvider } from "@/components/personal-todo-celebration";
import {
  createPersonalTodoAction,
  deletePersonalTodoAction,
  togglePersonalTodoAction,
  updatePersonalTodoAction,
} from "@/server/actions";

export const dynamic = "force-dynamic";

type TodoView = {
  _id: unknown;
  title: string;
  description: string;
  dueDate?: string | null;
  isCompleted: boolean;
};

function TodoCard({ todo, selectedDate }: { todo: TodoView; selectedDate: string }) {
  const dueState = personalTodoDueState(todo.dueDate ?? null, selectedDate);
  return <article className={`personal-todo-card ${todo.isCompleted ? "personal-todo-done" : `todo-due-${dueState}`}`} key={String(todo._id)}>
    <div className={`personal-todo-check ${todo.isCompleted ? "todo-check-done" : ""}`} aria-hidden="true">
      {todo.isCompleted ? <Check aria-hidden="true" size={14} /> : <span />}
    </div>
    <div className="personal-todo-copy">
      <strong>{todo.title}</strong>
      {todo.description && <p>{todo.description}</p>}
      <small className={`todo-due-label due-label-${dueState}`}>
        <CalendarDays aria-hidden="true" size={13} />
        {todo.dueDate ? formatDateArabic(todo.dueDate) : "بدون تاريخ"}
      </small>
    </div>
    <div className="personal-todo-actions">
      <CelebrationActionForm action={togglePersonalTodoAction}>
        <>
          <input name="todoId" type="hidden" value={String(todo._id)} />
          <input name="returnDate" type="hidden" value={selectedDate} />
          <input name="intent" type="hidden" value={todo.isCompleted ? "reopen" : "complete"} />
          <button className={`button ${todo.isCompleted ? "button-secondary" : "button-primary"} button-small`} type="submit">
            {todo.isCompleted ? "إعادة فتح" : "إنجاز"}
          </button>
        </>
      </CelebrationActionForm>
      <form action={deletePersonalTodoAction}>
        <input name="todoId" type="hidden" value={String(todo._id)} />
        <input name="returnDate" type="hidden" value={selectedDate} />
        <button className="button button-quiet button-small" type="submit">حذف</button>
      </form>
      <details className="todo-edit-details">
        <summary>تعديل</summary>
        <form action={updatePersonalTodoAction} className="todo-edit-form">
          <input name="todoId" type="hidden" value={String(todo._id)} />
          <input name="returnDate" type="hidden" value={selectedDate} />
          <label>العنوان<input name="title" required maxLength={120} defaultValue={todo.title} /></label>
          <label>الوصف (اختياري)<textarea name="description" maxLength={1000} rows={2} defaultValue={todo.description} /></label>
          <label>تاريخ الاستحقاق<input name="dueDate" type="date" required={todo.dueDate != null} defaultValue={todo.dueDate ?? ""} /></label>
          {todo.dueDate == null && <small>اترك التاريخ فارغاً لإبقاء المهمة بدون تاريخ.</small>}
          <button className="button button-primary button-small" type="submit">حفظ التعديل</button>
        </form>
      </details>
    </div>
  </article>;
}

export default async function PersonalTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; saved?: string; error?: string; todo?: string }>;
}) {
  const user = await requireUser("member");
  const params = await searchParams;
  const selectedDate = selectedPersonalTodoDate(params.date);
  const today = selectedPersonalTodoDate(undefined);
  await connectToDatabase();
  const [openRecords, completedRecords] = await Promise.all([
    PersonalTodo.find({
      memberId: user.id,
      isCompleted: false,
      dueDate: { $in: [selectedDate, null] },
    }).sort({ dueDate: 1, createdAt: -1 }).lean(),
    PersonalTodo.find({
      memberId: user.id,
      isCompleted: true,
      dueDate: { $in: [selectedDate, null] },
    }).sort({ dueDate: 1, createdAt: -1 }).lean(),
  ]);
  const personalTodos = [...openRecords, ...completedRecords];
  const { selected, undated } = splitPersonalTodosByDate(personalTodos, selectedDate);
  const openTodos = selected.filter((todo) => !todo.isCompleted);
  const completedTodos = selected.filter((todo) => todo.isCompleted);
  const undatedOpenTodos = undated.filter((todo) => !todo.isCompleted);
  const undatedCompletedTodos = undated.filter((todo) => todo.isCompleted);
  const completedPercent = selected.length ? Math.round(completedTodos.length / selected.length * 100) : 0;
  const previousDate = shiftDateKey(selectedDate, -1);
  const nextDate = shiftDateKey(selectedDate, 1);

  return (
    <AppShell user={user}>
      <TaskCelebrationProvider>
      <PageHeading eyebrow="مساحتك للإنجاز" title="مهامي الشخصية" description="خطط ليومك، تابع ما يستحق الاهتمام، واحتفل بكل خطوة صغيرة." />
      <Notice code={params.error || params.saved || (params.todo === "saved" ? "todo=saved" : undefined)} />
      <section className="personal-todo-overview">
        <div className="personal-todo-hero">
          <div className="personal-todo-hero-copy">
            <span className="personal-todo-hero-icon"><Sparkles aria-hidden="true" size={20} /></span>
            <p className="eyebrow">خطة اليوم</p>
            <h2>أهلاً {user.displayName}، يومك مليء بالإنجاز</h2>
            <p className="personal-todo-selected-date">{formatDateArabic(selectedDate)}</p>
            <p>تابع مهام هذا اليوم فقط. هذه القائمة لك وحدك ولا تؤثر على مهامك اليومية المطلوبة.</p>
          </div>
          <div className="personal-todo-progress-card">
            <div className="personal-todo-progress-title"><CircleCheck aria-hidden="true" size={18} /><span>إنجاز اليوم</span></div>
            <strong>{completedPercent}<small>٪</small></strong>
            <div className="personal-todo-progress-track" role="progressbar" aria-label="نسبة إنجاز مهام اليوم" aria-valuenow={completedPercent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${completedPercent}%` }} />
            </div>
            <small>{completedTodos.length} من {selected.length} مهام مكتملة</small>
          </div>
        </div>
        <div className="personal-todo-stats">
          <article className="personal-todo-stat"><span className="todo-stat-icon stat-open"><ListTodo aria-hidden="true" size={18} /></span><div><small>مهام اليوم</small><strong>{selected.length}</strong></div></article>
          <article className="personal-todo-stat"><span className="todo-stat-icon stat-today"><AlarmClock aria-hidden="true" size={18} /></span><div><small>مفتوحة</small><strong>{openTodos.length}</strong></div></article>
          <article className="personal-todo-stat"><span className="todo-stat-icon stat-done"><Check aria-hidden="true" size={18} /></span><div><small>مكتملة</small><strong>{completedTodos.length}</strong></div></article>
          <article className="personal-todo-stat"><span className="todo-stat-icon stat-overdue"><CalendarDays aria-hidden="true" size={18} /></span><div><small>التاريخ المحدد</small><strong>{selectedDate === today ? "اليوم" : "يوم آخر"}</strong></div></article>
        </div>
      </section>

      <section className="personal-todo-day-picker" aria-label="اختيار يوم التخطيط">
        <Link className="button button-secondary button-small" href={`/personal-tasks?date=${previousDate}`} aria-label="اليوم السابق">اليوم السابق</Link>
        <form action="/personal-tasks" method="get" className="personal-todo-date-form">
          <label htmlFor="planner-date">التاريخ</label>
          <input id="planner-date" name="date" type="date" value={selectedDate} max="9999-12-31" />
          <button className="button button-primary button-small" type="submit">عرض اليوم</button>
        </form>
        <Link className="button button-secondary button-small" href={`/personal-tasks?date=${nextDate}`} aria-label="اليوم التالي">اليوم التالي</Link>
        <Link className="button button-quiet button-small" href="/personal-tasks">اليوم</Link>
      </section>

      <section className="personal-todo-create-panel">
        <div className="personal-todo-create-heading">
          <span className="personal-todo-add-icon"><Plus aria-hidden="true" size={20} /></span>
          <div><p className="eyebrow">فكرة جديدة؟</p><h2>أضف مهمة إلى قائمتك</h2></div>
        </div>
        <form action={createPersonalTodoAction} className="personal-todo-create">
          <input name="returnDate" type="hidden" value={selectedDate} />
          <label className="todo-title-field">عنوان المهمة<input name="title" required maxLength={120} placeholder="مثال: إنهاء فصل من الكتاب" /></label>
          <label className="todo-date-field">تاريخ الاستحقاق<input name="dueDate" type="date" required defaultValue={selectedDate} /><small>محدد بتاريخ {formatDateArabic(selectedDate)}</small></label>
          <label className="todo-description-field">الوصف <span>اختياري</span><textarea name="description" maxLength={1000} rows={2} placeholder="أضف تفاصيل تساعدك على البدء..." /></label>
          <button className="button button-primary todo-add-button" type="submit"><Plus aria-hidden="true" size={16} />إضافة للقائمة</button>
        </form>
      </section>

      <section className="personal-todo-list-panel">
        <div className="personal-todo-list-heading">
          <div><p className="eyebrow">خطة اليوم</p><h2>مهام {selectedDate === today ? "اليوم" : formatDateArabic(selectedDate)}</h2></div>
          <span className="personal-todo-total">{selected.length} مهام</span>
        </div>
        <div className="personal-todo-sections">
          <div>
            <h3>مهام اليوم المفتوحة <span className="todo-count">{openTodos.length}</span></h3>
            {openTodos.length === 0 && <EmptyState>لا توجد مهام مفتوحة لهذا اليوم.</EmptyState>}
            {openTodos.map((todo) => <TodoCard key={String(todo._id)} todo={todo} selectedDate={selectedDate} />)}
          </div>
          <div>
            <h3>مهام اليوم المكتملة <span className="todo-count">{completedTodos.length}</span></h3>
            {completedTodos.length === 0 && <EmptyState>لا توجد مهام مكتملة لهذا اليوم.</EmptyState>}
            {completedTodos.map((todo) => <TodoCard key={String(todo._id)} todo={todo} selectedDate={selectedDate} />)}
          </div>
        </div>
      </section>

      <details className="personal-todo-undated">
        <summary>بدون تاريخ <span className="todo-count">{undated.length}</span></summary>
        {undated.length === 0 ? <EmptyState>لا توجد مهام بدون تاريخ.</EmptyState> : <div className="personal-todo-sections">
          <div>
            <h3>مفتوحة <span className="todo-count">{undatedOpenTodos.length}</span></h3>
            {undatedOpenTodos.map((todo) => <TodoCard key={String(todo._id)} todo={todo} selectedDate={selectedDate} />)}
          </div>
          <div>
            <h3>مكتملة <span className="todo-count">{undatedCompletedTodos.length}</span></h3>
            {undatedCompletedTodos.map((todo) => <TodoCard key={String(todo._id)} todo={todo} selectedDate={selectedDate} />)}
          </div>
        </div>}
      </details>
      </TaskCelebrationProvider>
    </AppShell>
  );
}
