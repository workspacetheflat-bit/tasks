import { z } from "zod";
import { dateKeyInZone, isValidDateKey } from "@/lib/date";
import { Types } from "mongoose";

export const personalTodoInputSchema = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب.").max(120, "العنوان يجب ألا يتجاوز 120 حرفاً."),
  description: z.string().trim().max(1000, "الوصف يجب ألا يتجاوز 1000 حرف.").optional(),
  dueDate: z.string().min(1, "تاريخ الاستحقاق مطلوب.").refine(isValidDateKey, "تاريخ الاستحقاق غير صالح."),
});

export const personalTodoUpdateInputSchema = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب.").max(120, "العنوان يجب ألا يتجاوز 120 حرفاً."),
  description: z.string().trim().max(1000, "الوصف يجب ألا يتجاوز 1000 حرف.").optional(),
  dueDate: z.string().optional()
    .transform((value) => value?.trim() || null)
    .refine((value) => value === null || isValidDateKey(value), "تاريخ الاستحقاق غير صالح."),
});

export type PersonalTodoInput = z.infer<typeof personalTodoInputSchema>;
export type PersonalTodoUpdateInput = z.infer<typeof personalTodoUpdateInputSchema>;

export function selectedPersonalTodoDate(requestedDate: string | undefined, now = new Date()): string {
  return requestedDate && isValidDateKey(requestedDate) ? requestedDate : dateKeyInZone(now);
}

export function splitPersonalTodosByDate<T extends { dueDate?: string | null }>(
  todos: T[],
  selectedDate: string,
): { selected: T[]; undated: T[] } {
  return {
    selected: todos.filter((todo) => todo.dueDate === selectedDate),
    undated: todos.filter((todo) => todo.dueDate == null),
  };
}

export function createPersonalTodoRecord(memberId: string, input: PersonalTodoInput) {
  if (!Types.ObjectId.isValid(memberId)) throw new Error("معرّف العضو غير صالح.");
  return {
    memberId: new Types.ObjectId(memberId),
    ...personalTodoFields(input),
    isCompleted: false,
  };
}

export function personalTodoFields(input: PersonalTodoInput) {
  return {
    title: input.title,
    description: input.description ?? "",
    dueDate: input.dueDate,
  };
}

export function updatePersonalTodoFields<T extends { title: string; description: string; dueDate: string | null }>(
  todo: T,
  input: PersonalTodoUpdateInput,
): T {
  return Object.assign(todo, {
    title: input.title,
    description: input.description ?? "",
    dueDate: input.dueDate,
  });
}

export function personalTodoDueState(dueDate: string | null, today: string): "overdue" | "today" | "upcoming" | "undated" {
  if (!dueDate) return "undated";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

export function togglePersonalTodo<T extends { isCompleted: boolean }>(todo: T): T {
  todo.isCompleted = !todo.isCompleted;
  return todo;
}

export function personalTodoOwnerFilter(memberId: string, todoId: string) {
  if (!Types.ObjectId.isValid(memberId) || !Types.ObjectId.isValid(todoId)) {
    throw new Error("المعرّف المحدد غير صالح.");
  }
  return { _id: new Types.ObjectId(todoId), memberId: new Types.ObjectId(memberId) };
}
