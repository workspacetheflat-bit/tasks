import "dotenv/config";
import { connectToDatabase } from "../src/lib/db";
import { TASK_KEYS } from "../src/lib/config";
import { DailyTaskOccurrence, Deduction, TaskDefinition } from "../src/models";

const morningTask = {
  key: TASK_KEYS.morningAdhkar,
  nameAr: "أذكار الصباح",
  dailyValue: 15,
  deductionMultiplier: 2,
  durationMinutes: 15,
  completionCriteria: "إتمام أذكار الصباح",
  displayOrder: 2,
  isActive: true,
};

const eveningTaskUpdate = {
  key: TASK_KEYS.eveningAdhkar,
  nameAr: "أذكار المساء",
  dailyValue: 15,
  deductionMultiplier: 2,
  durationMinutes: 15,
  completionCriteria: "إتمام أذكار المساء",
};

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("يُرفض تشغيل ترحيل الأذكار في بيئة الإنتاج.");
  }
  if (!process.argv.includes("--confirm-non-production")) {
    throw new Error("أضف --confirm-non-production لتأكيد أن قاعدة البيانات غير إنتاجية.");
  }

  await connectToDatabase();
  const [oldTask, existingEvening, existingMorning] = await Promise.all([
    TaskDefinition.findOne({ key: TASK_KEYS.legacyAdhkar }).lean(),
    TaskDefinition.findOne({ key: TASK_KEYS.eveningAdhkar }).lean(),
    TaskDefinition.findOne({ key: TASK_KEYS.morningAdhkar }).lean(),
  ]);

  if (oldTask && existingEvening && String(oldTask._id) !== String(existingEvening._id)) {
    throw new Error("يوجد تعريفان منفصلان للأذكار القديمة والمسائية. لم تُجرَ أي تغييرات؛ راجع قاعدة التطوير يدوياً.");
  }

  const eveningDocument = oldTask ?? existingEvening;
  if (!eveningDocument) {
    throw new Error("لم يتم العثور على تعريف أذكار قديم أو مسائي. لا توجد تغييرات؛ استخدم seed:tasks لقاعدة جديدة.");
  }

  const occurrenceCount = await DailyTaskOccurrence.countDocuments({ taskId: eveningDocument._id });
  const deductionTotals = await Deduction.aggregate([
    { $match: { taskId: eveningDocument._id } },
    { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
  ]);
  const needsEveningUpdate = Boolean(oldTask);
  const needsMorningInsert = !existingMorning;
  const needsMorningUpdate = Boolean(oldTask && existingMorning);
  console.info(JSON.stringify({
    mode: process.argv.includes("--apply") ? "apply" : "dry-run",
    taskDefinitions: [oldTask, existingEvening, existingMorning].filter(Boolean).map((task) => ({
      id: String(task._id),
      key: task.key,
      nameAr: task.nameAr,
      dailyValue: task.dailyValue,
      deductionMultiplier: task.deductionMultiplier,
      isActive: task.isActive,
    })),
    historicalOccurrenceCount: occurrenceCount,
    historicalDeductionsByStatus: deductionTotals,
    plannedChanges: {
      updateExistingEveningDocumentInPlace: needsEveningUpdate,
      addMorningTask: needsMorningInsert,
      normalizeExistingMorningTask: needsMorningUpdate,
      historicalOccurrencesAndDeductionsChanged: false,
    },
  }, null, 2));

  if (!process.argv.includes("--apply")) {
    console.info("Dry run only. No database changes were made.");
    await TaskDefinition.db?.close();
    return;
  }

  if (needsEveningUpdate) {
    await TaskDefinition.updateOne({ _id: eveningDocument._id }, { $set: eveningTaskUpdate });
  }
  if (needsMorningInsert) {
    await TaskDefinition.updateOne(
      { key: TASK_KEYS.morningAdhkar },
      { $setOnInsert: morningTask },
      { upsert: true },
    );
  } else if (needsMorningUpdate && existingMorning) {
    await TaskDefinition.updateOne({ _id: existingMorning._id }, { $set: morningTask });
  }
  console.info("تم تحديث تعريف المساء الموجود وإضافة تعريف الصباح عند الحاجة. لم يتم تعديل سجلات الوقائع أو الخصومات.");
  await TaskDefinition.db?.close();
}

main().catch(async (error: unknown) => {
  console.error("فشل ترحيل الأذكار:", error);
  try {
    await TaskDefinition.db?.close();
  } catch (closeError) {
    console.error("تعذر إغلاق اتصال قاعدة البيانات بعد فشل الترحيل:", closeError);
  }
  process.exitCode = 1;
});
