import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { SEED_TASKS, TASK_KEYS } from "../src/lib/config";
import {
  assertMemberCanCompleteDirectly,
  assertMemberCanRequestReview,
  effectiveCompletionMode,
  resolveReviewDecision,
  TaskCompletionPolicyError,
} from "../src/lib/task-completion";
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
});
