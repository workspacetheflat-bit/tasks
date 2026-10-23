import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { SEED_TASKS, TASK_KEYS } from "../src/lib/config";
import {
  assertMemberCanCompleteDirectly,
  assertMemberCanRequestReview,
  currentTaskCompletionMode,
  effectiveCompletionMode,
  isPendingReviewRequest,
  occurrenceCompletionMode,
  resolveReviewDecision,
  TaskCompletionPolicyError,
} from "../src/lib/task-completion";
import { taskOccurrenceSnapshot } from "../src/lib/finance";
import { DailyTaskOccurrence, TaskDefinition } from "../src/models";

describe("required task completion modes", () => {
  it("preserves direct completion for self-mode tasks and safely defaults existing records", () => {
    expect(effectiveCompletionMode(undefined)).toBe("self");
    expect(() => assertMemberCanCompleteDirectly("self")).not.toThrow();
    expect(() => assertMemberCanRequestReview("self", "incomplete")).toThrow(TaskCompletionPolicyError);
  });

  it("prevents members from directly completing review-mode tasks", () => {
    expect(() => assertMemberCanCompleteDirectly("review")).toThrow(TaskCompletionPolicyError);
    expect(() => assertMemberCanRequestReview("review", "incomplete")).not.toThrow();
    expect(() => assertMemberCanRequestReview("review", "needs_review")).toThrow(TaskCompletionPolicyError);
  });

  it("uses current task mode for open occurrences when settings change either direction", () => {
    expect(occurrenceCompletionMode("incomplete", "review", "self")).toBe("review");
    expect(occurrenceCompletionMode("needs_review", "self", "review")).toBe("self");
    expect(() => assertMemberCanCompleteDirectly(occurrenceCompletionMode("incomplete", "review", "self")!))
      .toThrow(TaskCompletionPolicyError);
    expect(() => assertMemberCanCompleteDirectly(occurrenceCompletionMode("incomplete", "self", "review")!))
      .not.toThrow();
  });

  it("preserves completed occurrence mode history when task settings change", () => {
    const occurrence = {
      status: "completed" as const,
      completionModeSnapshot: "self",
      completedAt: new Date("2026-10-23T12:00:00.000Z"),
      reviewedAt: null,
      reviewedBy: null,
      taskValueSnapshot: 40,
    };
    const before = { ...occurrence };
    expect(occurrenceCompletionMode(occurrence.status, "review", occurrence.completionModeSnapshot)).toBe("self");
    expect(occurrence).toEqual(before);
  });

  it("lists pending admin reviews according to the current task mode, not the old snapshot", () => {
    expect(isPendingReviewRequest("needs_review", currentTaskCompletionMode({ completionMode: "review" }))).toBe(true);
    expect(isPendingReviewRequest("needs_review", currentTaskCompletionMode({ completionMode: "self" }))).toBe(false);
    expect(isPendingReviewRequest("incomplete", currentTaskCompletionMode({ completionMode: "review" }))).toBe(false);
    expect(currentTaskCompletionMode(null)).toBeNull();
  });

  it("allows only an admin to decide a pending review-mode submission", () => {
    expect(() => resolveReviewDecision("member", "review", "needs_review", "approved"))
      .toThrow(TaskCompletionPolicyError);
    expect(resolveReviewDecision("admin", "review", "needs_review", "approved")).toBe("completed");
    expect(resolveReviewDecision("admin", "review", "needs_review", "rejected")).toBe("incomplete");
    expect(() => resolveReviewDecision("admin", "review", "completed", "approved"))
      .toThrow(TaskCompletionPolicyError);
    expect(() => resolveReviewDecision("admin", "self", "needs_review", "approved"))
      .toThrow(TaskCompletionPolicyError);
  });

  it("seeds scrolling as review-based while keeping every other task direct by default", () => {
    const scrolling = SEED_TASKS.find((task) => task.key === TASK_KEYS.scrolling);
    expect(scrolling?.completionMode).toBe("review");
    expect(SEED_TASKS.filter((task) => task.key !== TASK_KEYS.scrolling)
      .every((task) => task.completionMode === "self")).toBe(true);
  });

  it("defaults legacy task definitions and occurrences to direct completion without rewriting records", () => {
    const task = new TaskDefinition({
      key: "legacy-task",
      nameAr: "مهمة قديمة",
      dailyValue: 10,
      deductionMultiplier: 2,
      durationMinutes: 10,
      completionCriteria: "معيار الإنجاز",
      displayOrder: 1,
    });
    const occurrence = new DailyTaskOccurrence({
      memberId: new mongoose.Types.ObjectId(),
      taskId: new mongoose.Types.ObjectId(),
      taskKeySnapshot: "legacy-task",
      taskNameSnapshot: "مهمة قديمة",
      taskValueSnapshot: 10,
      deductionMultiplierSnapshot: 2,
      dateKey: "2026-10-23",
    });
    expect(task.completionMode).toBe("self");
    expect(occurrence.completionModeSnapshot).toBe("self");
  });

  it("snapshots the currently configured mode for future occurrences", () => {
    expect(taskOccurrenceSnapshot({
      key: TASK_KEYS.scrolling,
      nameAr: "الالتزام بالسكروولينج",
      dailyValue: 40,
      deductionMultiplier: 2,
      completionMode: "review",
    }).completionModeSnapshot).toBe("review");
  });
});
