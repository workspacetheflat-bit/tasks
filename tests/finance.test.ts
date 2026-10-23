import { describe, expect, it } from "vitest";
import { SEED_TASKS, TASK_KEYS } from "../src/lib/config";
import { dateKeyInZone, monthDateRange } from "../src/lib/date";
import {
  calculateDeduction,
  calculateMonthlySummary,
  canPerform,
  filterRecordsForMonth,
  isTaskRequiredOnDate,
  taskOccurrenceSnapshot,
} from "../src/lib/finance";
import { CourseBreak, Deduction, DailyTaskOccurrence } from "../src/models";

describe("financial calculations", () => {
  it("seeds daily task values totaling 284 EGP", () => {
    expect(SEED_TASKS.reduce((sum, task) => sum + task.dailyValue, 0)).toBe(284);
  });

  it("splits morning and evening adhkar into separate values and deductions without changing totals", () => {
    const splitTasks = SEED_TASKS.filter(
      (task) => task.key === TASK_KEYS.morningAdhkar || task.key === TASK_KEYS.eveningAdhkar,
    );
    expect(splitTasks.map((task) => [task.nameAr, task.dailyValue, calculateDeduction(task.dailyValue, task.deductionMultiplier)]))
      .toEqual([["أذكار الصباح", 15, 30], ["أذكار المساء", 15, 30]]);
    expect(splitTasks.reduce((sum, task) => sum + task.dailyValue, 0)).toBe(30);
    expect(splitTasks.reduce((sum, task) => sum + calculateDeduction(task.dailyValue, task.deductionMultiplier), 0)).toBe(60);
  });

  it("calculates each initial deduction as twice the task value", () => {
    expect(SEED_TASKS.map((task) => calculateDeduction(task.dailyValue, task.deductionMultiplier)))
      .toEqual([100, 30, 30, 80, 80, 80, 44, 44, 80]);
  });

  it("only approved deductions reduce net payable", () => {
    const summary = calculateMonthlySummary([
      { amount: 100, status: "approved" },
      { amount: 80, status: "pending" },
      { amount: 44, status: "rejected" },
    ]);
    expect(summary.netPayable).toBe(8420);
    expect(summary.pendingDeductions).toBe(80);
    expect(summary.rejectedDeductions).toBe(44);
  });

  it("preserves excess approved deductions while flooring payable at zero", () => {
    const summary = calculateMonthlySummary([{ amount: 9000, status: "approved" }]);
    expect(summary.netPayable).toBe(0);
    expect(summary.excessDeductions).toBe(480);
  });

  it("rejects non-integer money amounts", () => {
    expect(() => calculateDeduction(22.5, 2)).toThrow();
    expect(() => calculateMonthlySummary([{ amount: 0.25, status: "approved" }])).toThrow();
  });
});

describe("task and course-break rules", () => {
  it("uses the configured Cairo timezone when deriving a calendar day", () => {
    expect(dateKeyInZone(new Date("2026-10-22T21:00:00.000Z"))).toBe("2026-10-23");
  });

  it("exempts only the course task linked to the break date", () => {
    const exemptions = new Set(["nutrition-beauty-course:2026-10-23"]);
    expect(isTaskRequiredOnDate("nutrition-beauty-course", "2026-10-23", exemptions)).toBe(false);
    expect(isTaskRequiredOnDate("quran-course", "2026-10-23", exemptions)).toBe(true);
    expect(isTaskRequiredOnDate("surah-al-baqarah", "2026-10-23", exemptions)).toBe(true);
  });

  it("stores immutable-value snapshots independently from future task edits", () => {
    const task = { key: "example", nameAr: "مهمة", dailyValue: 40, deductionMultiplier: 2 };
    const snapshot = taskOccurrenceSnapshot(task);
    task.nameAr = "اسم جديد";
    task.dailyValue = 99;
    expect(snapshot).toEqual({
      taskKeySnapshot: "example",
      taskNameSnapshot: "مهمة",
      taskValueSnapshot: 40,
      deductionMultiplierSnapshot: 2,
    });
  });

  it("filters monthly records using date keys and respects month boundaries", () => {
    const records = [
      { dateKey: "2026-10-01", value: 1 },
      { dateKey: "2026-10-31", value: 2 },
      { dateKey: "2026-11-01", value: 3 },
    ];
    expect(filterRecordsForMonth(records, "2026-10").map((item) => item.value)).toEqual([1, 2]);
    expect(monthDateRange("2026-10")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });

});

describe("authorization and database uniqueness", () => {
  it("does not allow members to approve deductions or edit task settings", () => {
    expect(canPerform("member", "approve-deduction")).toBe(false);
    expect(canPerform("member", "edit-task-settings")).toBe(false);
    expect(canPerform("admin", "approve-deduction")).toBe(true);
    expect(canPerform("admin", "edit-task-settings")).toBe(true);
  });

  it("enforces one deduction and one occurrence per member/task/date in MongoDB indexes", () => {
    const deductionUniqueIndexes = Deduction.schema.indexes().filter(([, options]) => options.unique);
    const occurrenceUniqueIndexes = DailyTaskOccurrence.schema.indexes().filter(([, options]) => options.unique);
    expect(deductionUniqueIndexes.some(([keys]) => keys.occurrenceId === 1)).toBe(true);
    expect(occurrenceUniqueIndexes.some(([keys]) => keys.memberId === 1 && keys.taskId === 1 && keys.dateKey === 1)).toBe(true);
  });

  it("creates independent morning and evening occurrence identities and deduction amounts", () => {
    const morning = taskOccurrenceSnapshot(SEED_TASKS.find((task) => task.key === TASK_KEYS.morningAdhkar)!);
    const evening = taskOccurrenceSnapshot(SEED_TASKS.find((task) => task.key === TASK_KEYS.eveningAdhkar)!);
    expect(morning.taskKeySnapshot).not.toBe(evening.taskKeySnapshot);
    const occurrenceStatuses = new Map([
      [morning.taskKeySnapshot, "completed"],
      [evening.taskKeySnapshot, "incomplete"],
    ]);
    expect(occurrenceStatuses.get(morning.taskKeySnapshot)).toBe("completed");
    expect(occurrenceStatuses.get(evening.taskKeySnapshot)).toBe("incomplete");
    expect(calculateDeduction(15, 2)).toBe(30);
    expect(calculateDeduction(15, 2)).toBe(30);
    expect(calculateMonthlySummary([
      { amount: 30, status: "pending" },
      { amount: 30, status: "approved" },
    ])).toMatchObject({ approvedDeductions: 30, pendingDeductions: 30, netPayable: 8490 });
  });

  it("prevents overlapping breaks for one task/member/date", () => {
    const uniqueIndexes = CourseBreak.schema.indexes().filter(([, options]) => options.unique);
    expect(uniqueIndexes.some(([keys]) => keys.memberId === 1 && keys.courseTaskId === 1 && keys.dateKey === 1)).toBe(true);
  });
});
