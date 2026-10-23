import { describe, expect, it } from "vitest";
import {
  createPersonalTodoRecord,
  personalTodoFields,
  personalTodoDueState,
  personalTodoInputSchema,
  personalTodoOwnerFilter,
  togglePersonalTodo,
  updatePersonalTodoFields,
} from "../src/lib/personal-todos";
import { PersonalTodo } from "../src/models";

const memberOne = "64b000000000000000000001";
const memberTwo = "64b000000000000000000002";
const todoId = "64b000000000000000000010";

describe("personal todo operations", () => {
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
