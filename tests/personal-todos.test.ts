import { describe, expect, it } from "vitest";
import {
  createPersonalTodoRecord,
  personalTodoFields,
  personalTodoDueState,
  personalTodoInputSchema,
  personalTodoOwnerFilter,
  personalTodoUpdateInputSchema,
  selectedPersonalTodoDate,
  splitPersonalTodosByDate,
  togglePersonalTodo,
  updatePersonalTodoFields,
} from "../src/lib/personal-todos";
import { PersonalTodo } from "../src/models";
import { shiftDateKey } from "../src/lib/date";
import {
  CELEBRATION_SOUND_SRC,
  personalTodoCelebrationAnimation,
  shouldCelebrateCompletion,
  shouldPlayCelebrationSound,
  shouldPlayPersonalTodoSound,
} from "../src/lib/personal-todo-celebration";

const memberOne = "64b000000000000000000001";
const memberTwo = "64b000000000000000000002";
const todoId = "64b000000000000000000010";

describe("personal todo operations", () => {
  it("celebrates only a newly successful completion, never a failure, reopening, or no-op", () => {
    expect(shouldCelebrateCompletion({ ok: true, completed: true, changed: true })).toBe(true);
    expect(shouldCelebrateCompletion({ ok: false, completed: true, changed: true })).toBe(false);
    expect(shouldCelebrateCompletion({ ok: true, completed: false, changed: true })).toBe(false);
    expect(shouldCelebrateCompletion({ ok: true, completed: true, changed: false })).toBe(false);
  });

  it("respects the mute preference and reduced-motion presentation", () => {
    expect(shouldPlayPersonalTodoSound(false)).toBe(true);
    expect(shouldPlayPersonalTodoSound(true)).toBe(false);
    expect(shouldPlayCelebrationSound({ ok: true, completed: true, changed: true }, false)).toBe(true);
    expect(shouldPlayCelebrationSound({ ok: true, completed: true, changed: true }, true)).toBe(false);
    expect(shouldPlayCelebrationSound({ ok: false, completed: true, changed: true }, false)).toBe(false);
    expect(personalTodoCelebrationAnimation(false)).toBe("confetti");
    expect(personalTodoCelebrationAnimation(true)).toBe("calm");
    expect(CELEBRATION_SOUND_SRC).toBe("/audio/party-celebration.mp3");
  });

  it("defaults the planner to Cairo today and accepts a selected date", () => {
    const nearCairoMidnight = new Date("2026-10-22T21:00:00.000Z");
    expect(selectedPersonalTodoDate(undefined, nearCairoMidnight)).toBe("2026-10-23");
    expect(selectedPersonalTodoDate("2026-10-24", nearCairoMidnight)).toBe("2026-10-24");
    expect(selectedPersonalTodoDate("invalid", nearCairoMidnight)).toBe("2026-10-23");
  });

  it("navigates calendar dates without UTC day shifts", () => {
    expect(shiftDateKey("2026-10-23", -1)).toBe("2026-10-22");
    expect(shiftDateKey("2026-10-23", 1)).toBe("2026-10-24");
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => shiftDateKey("invalid", 1)).toThrow();
  });

  it("scopes completed and open todos to their selected due date, separating undated records", () => {
    const todos = [
      { title: "اليوم مكتملة", dueDate: "2026-10-23", isCompleted: true },
      { title: "اليوم مفتوحة", dueDate: "2026-10-23", isCompleted: false },
      { title: "غداً مكتملة", dueDate: "2026-10-24", isCompleted: true },
      { title: "بدون تاريخ", dueDate: null, isCompleted: false },
      { title: "حقل تاريخ قديم مفقود", isCompleted: true },
    ];
    const today = splitPersonalTodosByDate(todos, "2026-10-23");
    expect(today.selected.map((todo) => todo.title)).toEqual(["اليوم مكتملة", "اليوم مفتوحة"]);
    expect(today.selected.filter((todo) => todo.isCompleted)).toHaveLength(1);
    expect(today.undated.map((todo) => todo.title)).toEqual(["بدون تاريخ", "حقل تاريخ قديم مفقود"]);
    expect(splitPersonalTodosByDate(todos, "2026-10-24").selected.map((todo) => todo.title))
      .toEqual(["غداً مكتملة"]);
  });

  it("creates an open todo with a required title and due date plus an optional description", () => {
    const input = personalTodoInputSchema.parse({ title: "  قراءة كتاب  ", description: "", dueDate: "2026-10-23" });
    expect(String(createPersonalTodoRecord(memberOne, input).memberId)).toBe(memberOne);
    expect(createPersonalTodoRecord(memberOne, input)).toMatchObject({
      title: "قراءة كتاب",
      description: "",
      dueDate: "2026-10-23",
      isCompleted: false,
    });
    expect(personalTodoFields(input)).toEqual({ title: "قراءة كتاب", description: "", dueDate: "2026-10-23" });
    expect(() => personalTodoInputSchema.parse({ title: " " })).toThrow();
    expect(() => personalTodoInputSchema.parse({ title: "مهمة", dueDate: "" })).toThrow();
  });

  it("validates title, description, and actual calendar due date", () => {
    expect(() => personalTodoInputSchema.parse({
      title: "مهمة",
      description: "x".repeat(1001),
    })).toThrow();
    expect(() => personalTodoInputSchema.parse({
      title: "مهمة",
      dueDate: "2026-02-30",
    })).toThrow();
  });

  it("classifies todo due dates for useful prioritization", () => {
    expect(personalTodoDueState("2026-10-22", "2026-10-23")).toBe("overdue");
    expect(personalTodoDueState("2026-10-23", "2026-10-23")).toBe("today");
    expect(personalTodoDueState("2026-10-24", "2026-10-23")).toBe("upcoming");
    expect(personalTodoDueState(null, "2026-10-23")).toBe("undated");
  });

  it("completes and reopens a personal todo without changing its content", () => {
    const todo = { title: "مهمة", description: "", dueDate: null as string | null, isCompleted: false };
    togglePersonalTodo(todo);
    expect(todo.isCompleted).toBe(true);
    togglePersonalTodo(todo);
    expect(todo.isCompleted).toBe(false);
    expect(todo.title).toBe("مهمة");
  });

  it("edits only personal todo fields and leaves completion state unchanged", () => {
    const todo = { title: "قديم", description: "", dueDate: null as string | null, isCompleted: true };
    updatePersonalTodoFields(todo, personalTodoInputSchema.parse({
      title: "جديد",
      description: "تفاصيل",
      dueDate: "2026-11-02",
    }));
    expect(todo).toEqual({
      title: "جديد",
      description: "تفاصيل",
      dueDate: "2026-11-02",
      isCompleted: true,
    });
    expect(() => personalTodoInputSchema.parse({ title: "عنوان بلا موعد" })).toThrow();
  });

  it("preserves legacy undated todos when edited without assigning a date", () => {
    const todo = { title: "قديم", description: "", dueDate: null as string | null, isCompleted: false };
    const input = personalTodoUpdateInputSchema.parse({ title: "بعد التعديل", dueDate: "" });
    updatePersonalTodoFields(todo, input);
    expect(todo).toEqual({
      title: "بعد التعديل",
      description: "",
      dueDate: null,
      isCompleted: false,
    });
    expect(personalTodoUpdateInputSchema.parse({ title: "مهمة", dueDate: "2026-10-23" }).dueDate)
      .toBe("2026-10-23");
    expect(() => personalTodoUpdateInputSchema.parse({ title: "مهمة", dueDate: "2026-02-30" })).toThrow();
  });

  it("scopes update and delete lookups to the authenticated member", () => {
    expect(personalTodoOwnerFilter(memberOne, todoId)).toEqual({
      _id: expect.objectContaining({ _bsontype: "ObjectId" }),
      memberId: expect.objectContaining({ _bsontype: "ObjectId" }),
    });
    expect(String(personalTodoOwnerFilter(memberOne, todoId).memberId)).toBe(memberOne);
    expect(String(personalTodoOwnerFilter(memberTwo, todoId).memberId)).toBe(memberTwo);
    expect(() => personalTodoOwnerFilter(memberOne, "not-an-id")).toThrow();

    const records = [
      { _id: todoId, memberId: memberOne },
      { _id: todoId, memberId: memberTwo },
    ];
    const deleteFilter = personalTodoOwnerFilter(memberOne, todoId);
    const remaining = records.filter((record) =>
      String(record._id) !== String(deleteFilter._id) || record.memberId !== String(deleteFilter.memberId),
    );
    expect(remaining).toEqual([{ _id: todoId, memberId: memberTwo }]);
  });

  it("stores personal todos separately from daily task occurrences", () => {
    expect(PersonalTodo.modelName).toBe("PersonalTodo");
    expect(PersonalTodo.collection.name).not.toBe("dailytaskoccurrences");
    expect(PersonalTodo.schema.indexes().some(([keys]) => keys.memberId === 1 && keys.isCompleted === 1)).toBe(true);
  });
});
