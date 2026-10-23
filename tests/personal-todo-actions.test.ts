import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUserMock,
  connectToDatabaseMock,
  updateTodoMock,
  existsTodoMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  updateTodoMock: vi.fn(),
  existsTodoMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
  requireUser: requireUserMock,
}));
vi.mock("@/lib/db", () => ({ connectToDatabase: connectToDatabaseMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));
vi.mock("@/models", () => ({
  AuditEvent: { create: vi.fn() },
  CourseBreak: {},
  CourseCompletion: {},
  DailyTaskOccurrence: {},
  Deduction: {},
  PersonalTodo: {
    findOneAndUpdate: updateTodoMock,
    exists: existsTodoMock,
  },
  TaskDefinition: {},
  User: {},
  toObjectId: (value: string) => value,
}));

import { togglePersonalTodoAction } from "../src/server/actions";

function completionForm(intent = "complete"): FormData {
  const formData = new FormData();
  formData.set("todoId", "64b000000000000000000010");
  formData.set("intent", intent);
  return formData;
}

describe("personal todo completion action results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "64b000000000000000000001", role: "member" });
    connectToDatabaseMock.mockResolvedValue(undefined);
    existsTodoMock.mockResolvedValue(true);
  });

  it("confirms a successful member-owned completion exactly once", async () => {
    updateTodoMock.mockResolvedValue({ isCompleted: false });
    await expect(togglePersonalTodoAction(completionForm()))
      .resolves.toEqual({ ok: true, completed: true, changed: true });
    expect(updateTodoMock.mock.calls[0][0]).toMatchObject({
      isCompleted: false,
    });
    expect(String(updateTodoMock.mock.calls[0][0].memberId)).toBe("64b000000000000000000001");
    expect(revalidatePathMock).toHaveBeenCalledWith("/personal-tasks");
  });

  it("does not report a duplicate completion as a new change", async () => {
    updateTodoMock.mockResolvedValue(null);
    await expect(togglePersonalTodoAction(completionForm()))
      .resolves.toEqual({ ok: true, completed: true, changed: false });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("does not celebrate a failed update or reopening", async () => {
    updateTodoMock.mockRejectedValueOnce(new Error("database failure"));
    await expect(togglePersonalTodoAction(completionForm()))
      .resolves.toMatchObject({ ok: false, completed: false, changed: false });

    updateTodoMock.mockResolvedValue({ isCompleted: true });
    await expect(togglePersonalTodoAction(completionForm("reopen")))
      .resolves.toEqual({ ok: true, completed: false, changed: true });
  });
});
