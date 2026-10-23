export type CompletionMode = "self" | "review";
export type CompletionStatus = "incomplete" | "completed" | "needs_review";
export type ReviewDecision = "approved" | "rejected";

export class TaskCompletionPolicyError extends Error {}

export function effectiveCompletionMode(mode: string | null | undefined): CompletionMode {
  return mode === "review" ? "review" : "self";
}

export function currentTaskCompletionMode(
  taskDefinition: { completionMode?: string | null } | null | undefined,
): CompletionMode | null {
  if (!taskDefinition) return null;
  return effectiveCompletionMode(taskDefinition.completionMode);
}

export function occurrenceCompletionMode(
  status: CompletionStatus,
  currentMode: CompletionMode | null,
  snapshot: string | null | undefined,
): CompletionMode | null {
  return status === "completed" ? effectiveCompletionMode(snapshot) : currentMode;
}

export function taskRequiresReview(mode: string | null | undefined): boolean {
  return effectiveCompletionMode(mode) === "review";
}

export function isPendingReviewRequest(status: string, currentMode: CompletionMode | null): boolean {
  return status === "needs_review" && currentMode === "review";
}

export function assertMemberCanCompleteDirectly(mode: string | null | undefined): void {
  if (taskRequiresReview(mode)) {
    throw new TaskCompletionPolicyError("هذه المهمة تتطلب مراجعة المسؤول.");
  }
}

export function assertMemberCanRequestReview(
  mode: string | null | undefined,
  status: CompletionStatus,
): void {
  if (!taskRequiresReview(mode) || status !== "incomplete") {
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
  if (!taskRequiresReview(mode) || status !== "needs_review") {
    throw new TaskCompletionPolicyError("طلب المراجعة غير موجود أو تمت مراجعته مسبقاً.");
  }
  return decision === "approved" ? "completed" : "incomplete";
}
