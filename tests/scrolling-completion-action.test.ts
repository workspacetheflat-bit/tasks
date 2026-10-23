import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUserMock,
  connectToDatabaseMock,
  redirectMock,
  findOccurrenceMock,
  updateOccurrenceMock,
  createAuditMock,
  findTaskMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  redirectMock: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
  findOccurrenceMock: vi.fn(),
  updateOccurrenceMock: vi.fn(),
  createAuditMock: vi.fn(),
  findTaskMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
  requireUser: requireUserMock,
}));
vi.mock("@/lib/db", () => ({ connectToDatabase: connectToDatabaseMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/models", () => ({
  AuditEvent: { create: createAuditMock },
  CourseBreak: {},
  CourseCompletion: {},
  DailyTaskOccurrence: {
    findOne: findOccurrenceMock,
    findById: findOccurrenceMock,
    findOneAndUpdate: updateOccurrenceMock,
  },
  Deduction: {},
  PersonalTodo: {},
  TaskDefinition: { findById: findTaskMock },
  User: {},
  toObjectId: (value: string) => value,
}));

import { reviewTaskSubmissionAction, updateCompletionAction } from "../src/server/actions";
import { TASK_KEYS } from "../src/lib/config";

const occurrenceId = "64b000000000000000000010";

function scrollingOccurrence(completionModeSnapshot?: string) {
  return {
    _id: occurrenceId,
    memberId: "64b000000000000000000001",
    taskKeySnapshot: TASK_KEYS.scrolling,
    taskNameSnapshot: "الالتزام بالسكروولينج",
    status: "incomplete",
    memberNote: "",
    dateKey: "2026-10-23",
    ...(completionModeSnapshot ? { completionModeSnapshot } : {}),
  };
}

function formData(): FormData {
  const data = new FormData();
  data.set("occurrenceId", occurrenceId);
  data.set("status", "completed");
  return data;
}

function reviewFormData(): FormData {
  const data = new FormData();
  data.set("occurrenceId", occurrenceId);
  data.set("decision", "approved");
  return data;
}

describe("scrolling completion server-action enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "64b000000000000000000001", role: "member" });
    connectToDatabaseMock.mockResolvedValue(undefined);
    createAuditMock.mockResolvedValue(undefined);
    findTaskMock.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ completionMode: "review" }),
      }),
    });
  });

  it.each([
    ["missing", undefined],
    ["self", "self"],
  ])("rejects direct completion when the task is review-mode and the snapshot is %s", async (_label, snapshot) => {
    findOccurrenceMock.mockResolvedValue(scrollingOccurrence(snapshot));

    await expect(updateCompletionAction(formData()))
      .resolves.toMatchObject({ ok: false, completed: false, changed: false, error: "review-required" });

    expect(updateOccurrenceMock).not.toHaveBeenCalled();
    expect(createAuditMock).not.toHaveBeenCalled();
  });

  it("allows direct completion when a stale review snapshot belongs to a task now in self mode", async () => {
    findTaskMock.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ completionMode: "self" }),
      }),
    });
    findOccurrenceMock.mockResolvedValue({
      ...scrollingOccurrence("review"),
    });
    updateOccurrenceMock.mockResolvedValue({
      status: "completed",
      memberNote: "",
    });

    await expect(updateCompletionAction(formData()))
      .resolves.toEqual({ ok: true, completed: true, changed: true });

    expect(updateOccurrenceMock).toHaveBeenCalledOnce();
    expect(createAuditMock).toHaveBeenCalledOnce();
  });

  it("fails closed when the occurrence task definition no longer exists", async () => {
    findOccurrenceMock.mockResolvedValue(scrollingOccurrence("self"));
    findTaskMock.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve(null),
      }),
    });

    await expect(updateCompletionAction(formData()))
      .resolves.toMatchObject({ ok: false, completed: false, changed: false, error: "review-required" });
    expect(updateOccurrenceMock).not.toHaveBeenCalled();
  });

  it("lets an admin approve a pending request using the current review mode", async () => {
    requireUserMock.mockResolvedValue({ id: "64b000000000000000000002", role: "admin" });
    findOccurrenceMock.mockResolvedValue({
      ...scrollingOccurrence("self"),
      status: "needs_review",
      reviewNote: "",
      memberNote: "تم الإرسال",
    });
    updateOccurrenceMock.mockResolvedValue({
      _id: occurrenceId,
      status: "completed",
      dateKey: "2026-10-23",
      memberNote: "تم الإرسال",
      reviewNote: "",
    });

    await expect(reviewTaskSubmissionAction(reviewFormData()))
      .resolves.toEqual({ ok: true, completed: true, changed: true });

    expect(updateOccurrenceMock).toHaveBeenCalledOnce();
    expect(updateOccurrenceMock.mock.calls[0][0]).toMatchObject({ status: "needs_review" });
    expect(updateOccurrenceMock.mock.calls[0][1].$set).toMatchObject({
      status: "completed",
      reviewedBy: "64b000000000000000000002",
    });
  });

  it("does not report a completion when a direct daily-task update fails", async () => {
    findOccurrenceMock.mockResolvedValue(scrollingOccurrence("self"));
    findTaskMock.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ completionMode: "self" }) }),
    });
    updateOccurrenceMock.mockResolvedValue(null);

    await expect(updateCompletionAction(formData()))
      .resolves.toMatchObject({ ok: false, completed: false, changed: false });
  });

  it("does not report completion from a review request submission", async () => {
    const { submitTaskReviewAction } = await import("../src/server/actions");
    const submission = new FormData();
    submission.set("occurrenceId", occurrenceId);
    findOccurrenceMock.mockResolvedValue(scrollingOccurrence("review"));
    updateOccurrenceMock.mockResolvedValue({
      _id: occurrenceId,
      status: "needs_review",
      dateKey: "2026-10-23",
      memberNote: "",
    });

    await expect(submitTaskReviewAction(submission))
      .rejects.toThrow("REDIRECT:/my-tasks?date=2026-10-23&saved=1");
    expect(updateOccurrenceMock.mock.calls[0][1].$set.status).toBe("needs_review");
  });

  it("reports an admin rejection as not completed", async () => {
    requireUserMock.mockResolvedValue({ id: "64b000000000000000000002", role: "admin" });
    const rejection = reviewFormData();
    rejection.set("decision", "rejected");
    findOccurrenceMock.mockResolvedValue({
      ...scrollingOccurrence("review"),
      status: "needs_review",
    });
    updateOccurrenceMock.mockResolvedValue({
      _id: occurrenceId,
      status: "incomplete",
      dateKey: "2026-10-23",
    });

    await expect(reviewTaskSubmissionAction(rejection))
      .resolves.toEqual({ ok: true, completed: false, changed: true });
  });
});
