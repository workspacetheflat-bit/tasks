export type CompletionMode = "self" | "review";
export type CompletionStatus = "incomplete" | "completed" | "needs_review";
export type ReviewDecision = "approved" | "rejected";

export class TaskCompletionPolicyError extends Error {}

export function effectiveCompletionMode(mode: string | null | undefined): CompletionMode {
  return mode === "review" ? "review" : "self";
}

export function assertMemberCanCompleteDirectly(mode: string | null | undefined): void {
  if (effectiveCompletionMode(mode) !== "self") {
    throw new TaskCompletionPolicyError("هذه المهمة تتطلب مراجعة المسؤول.");
  }
}

export function assertMemberCanRequestReview(
  mode: string | null | undefined,
  status: CompletionStatus,
): void {
  if (effectiveCompletionMode(mode) !== "review" || status !== "incomplete") {
    throw new TaskCompletionPolicyError("لا يمكن إرسال هذه المهمة للمراجعة حالياً.");
  }
}

export function resolveReviewDecision(
  actorRole: "admin" | "member",
  mode: string | null | undefined,
  status: CompletionStatus,
  decision: ReviewDecision,
): "completed" | "incomplete" {
  if (actorRole !== "admin") throw new TaskCompletionPolicyError("اعتماد مراجعة المهام متاح للمسؤول فقط.");
  if (effectiveCompletionMode(mode) !== "review" || status !== "needs_review") {
    throw new TaskCompletionPolicyError("طلب المراجعة غير موجود أو تمت مراجعته مسبقاً.");
  }
  return decision === "approved" ? "completed" : "incomplete";
}
