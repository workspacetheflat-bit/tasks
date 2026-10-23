"use server";

import { compare } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { calculateDeduction } from "@/lib/finance";
import { isValidDateKey } from "@/lib/date";
import { AuditEvent, CourseBreak, CourseCompletion, DailyTaskOccurrence, Deduction, PersonalTodo, TaskDefinition, User, toObjectId } from "@/models";
import {
  createPersonalTodoRecord,
  personalTodoInputSchema,
  personalTodoOwnerFilter,
  togglePersonalTodo,
  updatePersonalTodoFields,
} from "@/lib/personal-todos";
import {
  assertMemberCanCompleteDirectly,
  assertMemberCanRequestReview,
  effectiveCompletionMode,
  resolveReviewDecision,
  TaskCompletionPolicyError,
} from "@/lib/task-completion";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(200),
});

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function reportMutationError(error: unknown, action: string): Promise<void> {
  console.error(`[${action}]`, error);
}

async function writeAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: { before?: unknown; after?: unknown; reason?: string } = {},
): Promise<void> {
  await AuditEvent.create({
    actorId: toObjectId(actorId),
    action,
    entityType,
    entityId: toObjectId(entityId),
    before: details.before ?? null,
    after: details.after ?? null,
    reason: details.reason ?? "",
  });
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse({
    username: field(formData, "username"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid");

  let destination: "/dashboard" | "/my-tasks";
  try {
    await connectToDatabase();
    const user = await User.findOne({ username: parsed.data.username.toLowerCase(), isActive: true })
      .select("+passwordHash displayName username role")
      .lean();
    const validPassword = user ? await compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !validPassword) redirect("/login?error=credentials");
    await createSession(String(user._id));
    destination = user.role === "admin" ? "/dashboard" : "/my-tasks";
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
    await reportMutationError(error, "login");
    redirect("/login?error=configuration");
  }
  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function updateCompletionAction(formData: FormData): Promise<void> {
  const user = await requireUser("member");
  const schema = z.object({
    occurrenceId: z.string().min(1),
    status: z.enum(["incomplete", "completed"]),
    note: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse({
    occurrenceId: field(formData, "occurrenceId"),
    status: field(formData, "status"),
    note: field(formData, "note"),
  });
  if (!parsed.success) redirect("/my-tasks?error=invalid");

  let dateKey = "";
  try {
    await connectToDatabase();
    const occurrence = await DailyTaskOccurrence.findOne({
      _id: toObjectId(parsed.data.occurrenceId),
      memberId: toObjectId(user.id),
    });
    if (!occurrence) throw new Error("سجل المهمة غير موجود.");
    assertMemberCanCompleteDirectly(occurrence.completionModeSnapshot);
    const before = { status: occurrence.status, memberNote: occurrence.memberNote };
    const updated = await DailyTaskOccurrence.findOneAndUpdate(
      {
        _id: occurrence._id,
        memberId: toObjectId(user.id),
        status: occurrence.status,
        $or: [{ completionModeSnapshot: "self" }, { completionModeSnapshot: { $exists: false } }],
      },
      {
        $set: {
          status: parsed.data.status,
          memberNote: parsed.data.note ?? "",
          completedAt: parsed.data.status === "completed" ? new Date() : null,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) throw new TaskCompletionPolicyError("تم تحديث المهمة في طلب آخر؛ أعد تحميل الصفحة.");
    await writeAudit(user.id, "completion.updated", "occurrence", String(occurrence._id), {
      before,
      after: { status: updated.status, memberNote: updated.memberNote },
    });
    dateKey = occurrence.dateKey;
  } catch (error) {
    await reportMutationError(error, "update-completion");
    if (error instanceof TaskCompletionPolicyError) redirect("/my-tasks?error=review-required");
    redirect("/my-tasks?error=save");
  }
  revalidatePath("/my-tasks");
  redirect(`/my-tasks?date=${dateKey}&saved=1`);
}

export async function submitTaskReviewAction(formData: FormData): Promise<void> {
  const user = await requireUser("member");
  const parsed = z.object({
    occurrenceId: z.string().min(1),
    note: z.string().max(500).optional(),
  }).safeParse({
    occurrenceId: field(formData, "occurrenceId"),
    note: field(formData, "note"),
  });
  if (!parsed.success) redirect("/my-tasks?error=invalid");

  let dateKey = "";
  try {
    await connectToDatabase();
    const occurrence = await DailyTaskOccurrence.findOne({
      _id: toObjectId(parsed.data.occurrenceId),
      memberId: toObjectId(user.id),
    });
    if (!occurrence) throw new Error("سجل المهمة غير موجود.");
    assertMemberCanRequestReview(occurrence.completionModeSnapshot, occurrence.status);
    const updated = await DailyTaskOccurrence.findOneAndUpdate(
      {
        _id: occurrence._id,
        memberId: toObjectId(user.id),
        status: "incomplete",
        completionModeSnapshot: "review",
      },
      {
        $set: {
          status: "needs_review",
          memberNote: parsed.data.note ?? "",
          reviewNote: "",
          completedAt: null,
          reviewedAt: null,
          reviewedBy: null,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) throw new TaskCompletionPolicyError("تم إرسال المهمة أو تحديثها في طلب آخر.");
    await writeAudit(user.id, "completion.review_requested", "occurrence", String(updated._id), {
      before: { status: occurrence.status },
      after: { status: updated.status, memberNote: updated.memberNote },
    });
    dateKey = occurrence.dateKey;
  } catch (error) {
    await reportMutationError(error, "submit-task-review");
    redirect(`/my-tasks?error=${error instanceof TaskCompletionPolicyError ? "review-required" : "save"}`);
  }
  revalidatePath("/my-tasks");
  revalidatePath("/daily-review");
  redirect(`/my-tasks?date=${dateKey}&saved=1`);
}

export async function createPersonalTodoAction(formData: FormData): Promise<void> {
  const user = await requireUser("member");
  const parsed = personalTodoInputSchema.safeParse({
    title: field(formData, "title"),
    description: field(formData, "description"),
    dueDate: field(formData, "dueDate"),
  });
  if (!parsed.success) redirect("/personal-tasks?error=todo-invalid");

  try {
    await connectToDatabase();
    await PersonalTodo.create(createPersonalTodoRecord(user.id, parsed.data));
  } catch (error) {
    await reportMutationError(error, "create-personal-todo");
    redirect("/personal-tasks?error=todo-save");
  }
  revalidatePath("/personal-tasks");
  redirect("/personal-tasks?todo=saved");
}

export async function updatePersonalTodoAction(formData: FormData): Promise<void> {
  const user = await requireUser("member");
  const todoId = field(formData, "todoId");
  const parsed = personalTodoInputSchema.safeParse({
    title: field(formData, "title"),
    description: field(formData, "description"),
    dueDate: field(formData, "dueDate"),
  });
  if (!parsed.success) redirect("/personal-tasks?error=todo-invalid");

  try {
    await connectToDatabase();
    const todo = await PersonalTodo.findOne(personalTodoOwnerFilter(user.id, todoId));
    if (!todo) throw new Error("المهمة الشخصية غير موجودة.");
    updatePersonalTodoFields(todo, parsed.data);
    await todo.save();
  } catch (error) {
    await reportMutationError(error, "update-personal-todo");
    redirect("/personal-tasks?error=todo-save");
  }
  revalidatePath("/personal-tasks");
  redirect("/personal-tasks?todo=saved");
}

export async function togglePersonalTodoAction(formData: FormData): Promise<void> {
  const user = await requireUser("member");
  const todoId = field(formData, "todoId");
  try {
    await connectToDatabase();
    const todo = await PersonalTodo.findOne(personalTodoOwnerFilter(user.id, todoId));
    if (!todo) throw new Error("المهمة الشخصية غير موجودة.");
    togglePersonalTodo(todo);
    await todo.save();
  } catch (error) {
    await reportMutationError(error, "toggle-personal-todo");
    redirect("/personal-tasks?error=todo-save");
  }
  revalidatePath("/personal-tasks");
  redirect("/personal-tasks?todo=saved");
}

export async function deletePersonalTodoAction(formData: FormData): Promise<void> {
  const user = await requireUser("member");
  const todoId = field(formData, "todoId");
  try {
    await connectToDatabase();
    const deleted = await PersonalTodo.findOneAndDelete(personalTodoOwnerFilter(user.id, todoId));
    if (!deleted) throw new Error("المهمة الشخصية غير موجودة.");
  } catch (error) {
    await reportMutationError(error, "delete-personal-todo");
    redirect("/personal-tasks?error=todo-save");
  }
  revalidatePath("/personal-tasks");
  redirect("/personal-tasks?todo=saved");
}

export async function reviewCompletionAction(formData: FormData): Promise<void> {
  const user = await requireUser("admin");
  const schema = z.object({
    occurrenceId: z.string().min(1),
    status: z.enum(["incomplete", "completed", "needs_review"]),
    reason: z.string().trim().min(3).max(500),
  });
  const parsed = schema.safeParse({
    occurrenceId: field(formData, "occurrenceId"),
    status: field(formData, "status"),
    reason: field(formData, "reason"),
  });
  if (!parsed.success) redirect("/daily-review?error=invalid");

  let dateKey = "";
  try {
    await connectToDatabase();
    const occurrence = await DailyTaskOccurrence.findById(toObjectId(parsed.data.occurrenceId));
    if (!occurrence) throw new Error("سجل المهمة غير موجود.");
    if (effectiveCompletionMode(occurrence.completionModeSnapshot) !== "self") {
      throw new TaskCompletionPolicyError("طلبات المهام التي تتطلب مراجعة تُعتمد من قسم طلبات المراجعة.");
    }
    const before = { status: occurrence.status, reviewNote: occurrence.reviewNote };
    const updated = await DailyTaskOccurrence.findOneAndUpdate(
      {
        _id: occurrence._id,
        status: occurrence.status,
        $or: [{ completionModeSnapshot: "self" }, { completionModeSnapshot: { $exists: false } }],
      },
      {
        $set: {
          status: parsed.data.status,
          reviewNote: parsed.data.reason,
          reviewedAt: new Date(),
          reviewedBy: toObjectId(user.id),
          completedAt: parsed.data.status === "completed" ? new Date() : null,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) throw new TaskCompletionPolicyError("تم تحديث المهمة في طلب آخر.");
    await writeAudit(user.id, "completion.reviewed", "occurrence", String(occurrence._id), {
      before,
      after: { status: updated.status, reviewNote: updated.reviewNote },
      reason: parsed.data.reason,
    });
    dateKey = occurrence.dateKey;
  } catch (error) {
    await reportMutationError(error, "review-completion");
    if (error instanceof TaskCompletionPolicyError) redirect("/daily-review?error=review-required");
    redirect("/daily-review?error=save");
  }
  revalidatePath("/daily-review");
  revalidatePath("/my-tasks");
  redirect(`/daily-review?date=${dateKey}&saved=1`);
}

export async function reviewTaskSubmissionAction(formData: FormData): Promise<void> {
  const user = await requireUser("admin");
  const parsed = z.object({
    occurrenceId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(500).optional(),
  }).safeParse({
    occurrenceId: field(formData, "occurrenceId"),
    decision: field(formData, "decision"),
    note: field(formData, "note"),
  });
  if (!parsed.success) redirect("/daily-review?error=invalid");

  let dateKey = "";
  try {
    await connectToDatabase();
    const occurrence = await DailyTaskOccurrence.findById(toObjectId(parsed.data.occurrenceId));
    if (!occurrence) throw new Error("سجل المهمة غير موجود.");
    const nextStatus = resolveReviewDecision(
      user.role,
      occurrence.completionModeSnapshot,
      occurrence.status,
      parsed.data.decision,
    );
    const now = new Date();
    const updated = await DailyTaskOccurrence.findOneAndUpdate(
      { _id: occurrence._id, status: "needs_review", completionModeSnapshot: "review" },
      {
        $set: {
          status: nextStatus,
          reviewNote: parsed.data.note ?? "",
          reviewedAt: now,
          reviewedBy: toObjectId(user.id),
          completedAt: nextStatus === "completed" ? now : null,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) throw new TaskCompletionPolicyError("تمت مراجعة هذا الطلب أو تغييره مسبقاً.");
    await writeAudit(user.id, `completion.${parsed.data.decision}`, "occurrence", String(updated._id), {
      before: { status: occurrence.status, memberNote: occurrence.memberNote },
      after: { status: updated.status, reviewNote: updated.reviewNote },
      reason: parsed.data.note,
    });
    dateKey = updated.dateKey;
  } catch (error) {
    await reportMutationError(error, "review-task-submission");
    redirect(`/daily-review?error=${error instanceof TaskCompletionPolicyError ? "review-required" : "save"}`);
  }
  revalidatePath("/daily-review");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/daily-review?date=${dateKey}&saved=1`);
}

export async function createDeductionAction(formData: FormData): Promise<void> {
  const user = await requireUser("admin");
  const schema = z.object({
    occurrenceId: z.string().min(1),
    reason: z.string().trim().min(3).max(1000),
  });
  const parsed = schema.safeParse({
    occurrenceId: field(formData, "occurrenceId"),
    reason: field(formData, "reason"),
  });
  if (!parsed.success) redirect("/daily-review?error=invalid");

  let dateKey = "";
  try {
    await connectToDatabase();
    const occurrence = await DailyTaskOccurrence.findById(toObjectId(parsed.data.occurrenceId));
    if (!occurrence) throw new Error("سجل المهمة غير موجود.");
    if (occurrence.status === "completed") throw new Error("لا يمكن اقتراح خصم لمهمة مكتملة.");
    if (occurrence.status === "needs_review") throw new Error("لا يمكن اقتراح خصم أثناء انتظار مراجعة إكمال المهمة.");
    const scheduledBreak = await CourseBreak.exists({
      memberId: occurrence.memberId,
      courseTaskId: occurrence.taskId,
      dateKey: occurrence.dateKey,
      status: "scheduled",
    });
    if (scheduledBreak) throw new Error("هذه المهمة معفاة في يوم الاستراحة المحدد.");
    const duplicate = await Deduction.exists({ occurrenceId: occurrence._id });
    if (duplicate) throw new Error("يوجد خصم مسجل بالفعل لهذه المهمة في هذا اليوم.");
    const amount = calculateDeduction(occurrence.taskValueSnapshot, occurrence.deductionMultiplierSnapshot);
    const deduction = await Deduction.create({
      memberId: occurrence.memberId,
      taskId: occurrence.taskId,
      occurrenceId: occurrence._id,
      dateKey: occurrence.dateKey,
      taskNameSnapshot: occurrence.taskNameSnapshot,
      amount,
      reason: parsed.data.reason,
      status: "pending",
      createdBy: toObjectId(user.id),
    });
    await writeAudit(user.id, "deduction.proposed", "deduction", String(deduction._id), {
      after: { amount, status: "pending", occurrenceId: String(occurrence._id) },
      reason: parsed.data.reason,
    });
    dateKey = occurrence.dateKey;
  } catch (error) {
    await reportMutationError(error, "create-deduction");
    const isDuplicate = error instanceof Error && error.message.includes("duplicate");
    redirect(`/daily-review?error=${isDuplicate ? "duplicate" : "save"}`);
  }
  revalidatePath("/daily-review");
  revalidatePath("/deductions");
  revalidatePath("/dashboard");
  redirect(`/daily-review?date=${dateKey}&saved=1`);
}

export async function reviewDeductionAction(formData: FormData): Promise<void> {
  const user = await requireUser("admin");
  const schema = z.object({
    deductionId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(1000).optional(),
  }).refine((data) => data.decision !== "rejected" || Boolean(data.reason && data.reason.length >= 3));
  const parsed = schema.safeParse({
    deductionId: field(formData, "deductionId"),
    decision: field(formData, "decision"),
    reason: field(formData, "reason"),
  });
  if (!parsed.success) redirect("/deductions?error=invalid");

  try {
    await connectToDatabase();
    const now = new Date();
    const deduction = await Deduction.findOneAndUpdate(
      { _id: toObjectId(parsed.data.deductionId), status: "pending" },
      {
        $set: {
          status: parsed.data.decision,
          reviewedBy: toObjectId(user.id),
          reviewedAt: now,
          rejectionReason: parsed.data.decision === "rejected" ? parsed.data.reason ?? "" : "",
        },
      },
      { new: true, runValidators: true },
    );
    if (!deduction) throw new Error("سجل الخصم غير موجود أو تمت مراجعته مسبقاً.");
    const audit = await AuditEvent.create({
      actorId: toObjectId(user.id),
      action: `deduction.${parsed.data.decision}`,
      entityType: "deduction",
      entityId: deduction._id,
      before: { status: "pending", reviewedBy: null },
      after: { status: deduction.status, reviewedBy: user.id },
      reason: parsed.data.reason ?? "",
    });
    deduction.relatedAuditEventIds.push(audit._id);
    await deduction.save();
  } catch (error) {
    await reportMutationError(error, "review-deduction");
    redirect("/deductions?error=save");
  }
  revalidatePath("/deductions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/my-tasks");
  redirect("/deductions?saved=1");
}

function nextDay(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function recordCourseCompletionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const schema = z.object({
    taskKey: z.enum(["nutrition-beauty-course", "quran-course"]),
    courseName: z.string().trim().min(2).max(160),
    completionDate: z.string().refine(isValidDateKey),
    notes: z.string().max(500).optional(),
    breakReason: z.string().trim().max(500).optional(),
  }).refine((data) => !data.breakReason || data.breakReason.length >= 3);
  const parsed = schema.safeParse({
    taskKey: field(formData, "taskKey"),
    courseName: field(formData, "courseName"),
    completionDate: field(formData, "completionDate"),
    notes: field(formData, "notes"),
    breakReason: field(formData, "breakReason"),
  });
  if (!parsed.success) redirect(user.role === "admin" ? "/daily-review?error=invalid" : "/my-tasks?error=invalid");

  const path = user.role === "admin" ? "/daily-review" : "/my-tasks";
  try {
    await connectToDatabase();
    const task = await TaskDefinition.findOne({ key: parsed.data.taskKey, isActive: true });
    if (!task) throw new Error("المسار التدريبي المحدد غير متاح.");
    const member = user.role === "member" ? user.id : String((await User.findOne({ role: "member", isActive: true }).select("_id").lean())?._id ?? "");
    if (!member) throw new Error("لم يتم إعداد حساب العضو بعد.");
    const breakDate = nextDay(parsed.data.completionDate);
    if (parsed.data.breakReason && await CourseBreak.exists({
      memberId: toObjectId(member),
      courseTaskId: task._id,
      dateKey: breakDate,
    })) {
      throw new Error("يوجد يوم فاصل مسجل مسبقاً لهذا المسار والتاريخ.");
    }
    const completion = await CourseCompletion.create({
      memberId: toObjectId(member),
      courseTaskId: task._id,
      courseName: parsed.data.courseName,
      completionDate: parsed.data.completionDate,
      notes: parsed.data.notes ?? "",
      createdBy: toObjectId(user.id),
    });
    await writeAudit(user.id, "course.completed", "courseCompletion", String(completion._id), {
      after: { courseName: completion.courseName, completionDate: completion.completionDate },
    });
    if (parsed.data.breakReason) {
      const courseBreak = await CourseBreak.create({
        memberId: toObjectId(member),
        courseTaskId: task._id,
        dateKey: breakDate,
        reason: parsed.data.breakReason,
        status: "scheduled",
        createdBy: toObjectId(user.id),
      });
      await writeAudit(user.id, "course.break_scheduled", "courseBreak", String(courseBreak._id), {
        after: { dateKey: breakDate, courseTaskId: String(task._id) },
        reason: parsed.data.breakReason,
      });
    }
  } catch (error) {
    await reportMutationError(error, "course-completion");
    const duplicate = error instanceof Error && error.message.includes("duplicate");
    redirect(`${path}?error=${duplicate ? "duplicate" : "save"}`);
  }
  revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  redirect(`${path}?saved=1`);
}

export async function createTaskDefinitionAction(formData: FormData): Promise<void> {
  const user = await requireUser("admin");
  const schema = z.object({
    key: z.string().trim().toLowerCase().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nameAr: z.string().trim().min(2).max(120),
    dailyValue: z.coerce.number().int().min(0).max(100000),
    deductionMultiplier: z.coerce.number().int().min(0).max(100),
    durationMinutes: z.coerce.number().int().min(0).max(1440),
    completionMode: z.enum(["self", "review"]),
    completionCriteria: z.string().trim().min(3).max(500),
    displayOrder: z.coerce.number().int().min(0).max(10000),
  });
  const parsed = schema.safeParse({
    key: field(formData, "key"),
    nameAr: field(formData, "nameAr"),
    dailyValue: field(formData, "dailyValue"),
    deductionMultiplier: field(formData, "deductionMultiplier"),
    durationMinutes: field(formData, "durationMinutes"),
    completionMode: field(formData, "completionMode"),
    completionCriteria: field(formData, "completionCriteria"),
    displayOrder: field(formData, "displayOrder"),
  });
  if (!parsed.success) redirect("/settings?error=invalid");

  try {
    await connectToDatabase();
    const task = await TaskDefinition.create({ ...parsed.data, isActive: true });
    await writeAudit(user.id, "task.created", "task", String(task._id), {
      after: parsed.data,
    });
  } catch (error) {
    await reportMutationError(error, "create-task-definition");
    redirect(`/settings?error=${error instanceof Error && error.message.includes("duplicate") ? "duplicate" : "save"}`);
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  redirect("/settings?saved=1");
}

export async function updateTaskSettingsAction(formData: FormData): Promise<void> {
  const user = await requireUser("admin");
  const schema = z.object({
    taskId: z.string().min(1),
    nameAr: z.string().trim().min(2).max(120),
    dailyValue: z.coerce.number().int().min(0).max(100000),
    deductionMultiplier: z.coerce.number().int().min(0).max(100),
    durationMinutes: z.coerce.number().int().min(0).max(1440),
    completionMode: z.enum(["self", "review"]),
    completionCriteria: z.string().trim().min(3).max(500),
    isActive: z.enum(["true", "false"]),
  });
  const parsed = schema.safeParse({
    taskId: field(formData, "taskId"),
    nameAr: field(formData, "nameAr"),
    dailyValue: field(formData, "dailyValue"),
    deductionMultiplier: field(formData, "deductionMultiplier"),
    durationMinutes: field(formData, "durationMinutes"),
    completionMode: field(formData, "completionMode"),
    completionCriteria: field(formData, "completionCriteria"),
    isActive: field(formData, "isActive"),
  });
  if (!parsed.success) redirect("/settings?error=invalid");
  try {
    await connectToDatabase();
    const task = await TaskDefinition.findById(toObjectId(parsed.data.taskId));
    if (!task) throw new Error("المهمة غير موجودة.");
    const before = {
      nameAr: task.nameAr,
      dailyValue: task.dailyValue,
      deductionMultiplier: task.deductionMultiplier,
      durationMinutes: task.durationMinutes,
      completionMode: task.completionMode,
      completionCriteria: task.completionCriteria,
      isActive: task.isActive,
    };
    task.nameAr = parsed.data.nameAr;
    task.dailyValue = parsed.data.dailyValue;
    task.deductionMultiplier = parsed.data.deductionMultiplier;
    task.durationMinutes = parsed.data.durationMinutes;
    task.completionMode = parsed.data.completionMode;
    task.completionCriteria = parsed.data.completionCriteria;
    task.isActive = parsed.data.isActive === "true";
    await task.save();
    await writeAudit(user.id, "task.updated", "task", String(task._id), {
      before,
      after: {
        nameAr: task.nameAr,
        dailyValue: task.dailyValue,
        deductionMultiplier: task.deductionMultiplier,
        durationMinutes: task.durationMinutes,
        completionMode: task.completionMode,
        completionCriteria: task.completionCriteria,
        isActive: task.isActive,
      },
    });
  } catch (error) {
    await reportMutationError(error, "task-settings");
    redirect("/settings?error=save");
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  redirect("/settings?saved=1");
}
