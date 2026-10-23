import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/dashboard" : "/my-tasks");
  const { error } = await searchParams;
  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <div className="login-mark">ي</div>
        <p className="eyebrow">أهلاً بك</p>
        <h1>تسجيل الدخول</h1>
        <p className="muted">سجّل الدخول لمتابعة المهام اليومية والمكافأة الشهرية.</p>
        {error && <div className="notice error" role="alert">
          {error === "credentials" ? "اسم المستخدم أو كلمة المرور غير صحيحة." : error === "configuration" ? "تعذر الاتصال أو إعداد الخدمة. يرجى مراجعة إعدادات الخادم." : "يرجى إدخال اسم المستخدم وكلمة المرور."}
        </div>}
        <form action={loginAction} className="form-stack">
          <label>اسم المستخدم<input autoComplete="username" name="username" required /></label>
          <label>كلمة المرور<input autoComplete="current-password" name="password" required type="password" /></label>
          <button className="button button-primary button-wide" type="submit">دخول آمن</button>
        </form>
        <p className="login-footnote">هذا النظام خاص، ولا يتوفر إنشاء حساب ذاتي.</p>
      </section>
    </main>
  );
}
