import "dotenv/config";
import { connectToDatabase } from "../src/lib/db";
import { TASK_KEYS } from "../src/lib/config";
import { TaskDefinition } from "../src/models";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("يُرفض تشغيل ترحيل أوضاع الإكمال في بيئة الإنتاج.");
  }
  if (!process.argv.includes("--confirm-non-production")) {
    throw new Error("أضف --confirm-non-production لتأكيد أن قاعدة البيانات غير إنتاجية.");
  }

  await connectToDatabase();
  const scrollingTask = await TaskDefinition.findOne({ key: TASK_KEYS.scrolling }).select("_id completionMode").lean();
  if (!scrollingTask) throw new Error("لم يتم العثور على تعريف مهمة التصفح.");
  const needsUpdate = scrollingTask.completionMode == null;
  console.info(JSON.stringify({
    mode: process.argv.includes("--apply") ? "apply" : "dry-run",
    taskId: String(scrollingTask._id),
    currentMode: scrollingTask.completionMode ?? "self (safe default)",
    plannedChange: needsUpdate ? "set completionMode to review" : "no change",
    historicalOccurrencesAndDeductionsChanged: false,
  }, null, 2));
  if (process.argv.includes("--apply") && needsUpdate) {
    await TaskDefinition.updateOne(
      { _id: scrollingTask._id, completionMode: null },
      { $set: { completionMode: "review" } },
    );
  }
  if (!process.argv.includes("--apply")) console.info("Dry run only. No database changes were made.");
  await TaskDefinition.db?.close();
}

main().catch(async (error: unknown) => {
  console.error("فشل تحديث أوضاع إكمال المهام:", error);
  try {
    await TaskDefinition.db?.close();
  } catch (closeError) {
    console.error("تعذر إغلاق اتصال قاعدة البيانات بعد فشل الترحيل:", closeError);
  }
  process.exitCode = 1;
});
