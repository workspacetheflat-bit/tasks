import { MONTHLY_BASE_COMPENSATION } from "@/lib/config";

export type DeductionStatus = "pending" | "approved" | "rejected";

export type MonthlySummary = {
  baseCompensation: number;
  approvedDeductions: number;
  pendingDeductions: number;
  rejectedDeductions: number;
  netPayable: number;
  excessDeductions: number;
};

export function taskOccurrenceSnapshot(task: {
  key: string;
  nameAr: string;
  dailyValue: number;
  deductionMultiplier: number;
}): { taskKeySnapshot: string; taskNameSnapshot: string; taskValueSnapshot: number; deductionMultiplierSnapshot: number } {
  return {
    taskKeySnapshot: task.key,
    taskNameSnapshot: task.nameAr,
    taskValueSnapshot: task.dailyValue,
    deductionMultiplierSnapshot: task.deductionMultiplier,
  };
}

export function canPerform(role: "admin" | "member", action: "approve-deduction" | "edit-task-settings"): boolean {
  return role === "admin" && (action === "approve-deduction" || action === "edit-task-settings");
}

export function filterRecordsForMonth<T extends { dateKey: string }>(records: T[], month: string): T[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("الشهر المحدد غير صالح.");
  return records.filter((record) => record.dateKey.startsWith(`${month}-`));
}

export function calculateDeduction(taskValue: number, multiplier: number): number {
  if (!Number.isSafeInteger(taskValue) || taskValue < 0 || !Number.isSafeInteger(multiplier) || multiplier < 0) {
    throw new Error("يجب أن تكون قيمة المهمة ومعامل الخصم أعداداً صحيحة غير سالبة.");
  }
  const amount = taskValue * multiplier;
  if (!Number.isSafeInteger(amount)) throw new Error("قيمة الخصم تتجاوز الحد المسموح.");
  return amount;
}

export function calculateMonthlySummary(
  deductions: Array<{ amount: number; status: DeductionStatus }>,
  baseCompensation = MONTHLY_BASE_COMPENSATION,
): MonthlySummary {
  if (!Number.isSafeInteger(baseCompensation) || baseCompensation < 0) {
    throw new Error("يجب أن يكون الراتب الأساسي عدداً صحيحاً غير سالب.");
  }
  const totals = deductions.reduce(
    (sum, deduction) => {
      if (!Number.isSafeInteger(deduction.amount) || deduction.amount < 0) {
        throw new Error("يجب أن تكون مبالغ الخصومات أعداداً صحيحة غير سالبة.");
      }
      if (deduction.status === "approved") sum.approvedDeductions += deduction.amount;
      if (deduction.status === "pending") sum.pendingDeductions += deduction.amount;
      if (deduction.status === "rejected") sum.rejectedDeductions += deduction.amount;
      return sum;
    },
    { approvedDeductions: 0, pendingDeductions: 0, rejectedDeductions: 0 },
  );
  return {
    baseCompensation,
    ...totals,
    netPayable: Math.max(0, baseCompensation - totals.approvedDeductions),
    excessDeductions: Math.max(0, totals.approvedDeductions - baseCompensation),
  };
}

export function isTaskRequiredOnDate(taskKey: string, dateKey: string, breakKeys: Set<string>): boolean {
  return !breakKeys.has(`${taskKey}:${dateKey}`);
}
