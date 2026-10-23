import "dotenv/config";
import { connectToDatabase } from "../src/lib/db";
import { SEED_TASKS } from "../src/lib/config";
import { TaskDefinition } from "../src/models";

async function main(): Promise<void> {
  await connectToDatabase();
  for (const task of SEED_TASKS) {
    await TaskDefinition.updateOne(
      { key: task.key },
      { $setOnInsert: { ...task, isActive: true } },
      { upsert: true },
    );
  }
  console.info(`تم التأكد من وجود ${SEED_TASKS.length} مهام أساسية.`);
  await TaskDefinition.db?.close();
}

main().catch((error: unknown) => {
  console.error("فشل إعداد المهام الأساسية:", error);
  process.exitCode = 1;
});
