import "server-only";
import { connectToDatabase } from "@/lib/db";
import { TaskDefinition, DailyTaskOccurrence, User, CourseBreak } from "@/models";
import { taskOccurrenceSnapshot } from "@/lib/finance";
import { TASK_KEYS } from "@/lib/config";
import { dateKeyInZone } from "@/lib/date";
import { currentTaskCompletionMode, type CompletionMode } from "@/lib/task-completion";

export async function findMemberId(): Promise<string | null> {
  await connectToDatabase();
  const member = await User.findOne({ role: "member", isActive: true }).select("_id").lean();
  return member ? String(member._id) : null;
}

export async function getCurrentTaskCompletionModes(taskIds: unknown[]): Promise<Map<string, CompletionMode | null>> {
  const uniqueIds = [...new Set(taskIds.map(String))];
  if (!uniqueIds.length) return new Map();
  const definitions = await TaskDefinition.find({ _id: { $in: uniqueIds } })
    .select("_id completionMode")
    .lean();
  return new Map(
    definitions.map((task) => [
      String(task._id),
      currentTaskCompletionMode(task),
    ]),
  );
}

export async function ensureDailyOccurrences(memberId: string, dateKey: string) {
  await connectToDatabase();
  const tasks = await TaskDefinition.find({ isActive: true })
    .sort({ displayOrder: 1, key: -1 })
    .lean();
  if (!tasks.length) return { tasks, occurrences: [] };
  const morningTask = tasks.find((task) => task.key === TASK_KEYS.morningAdhkar);
  const adhkarEffectiveDate = morningTask ? dateKeyInZone(morningTask.createdAt) : dateKey;
  const tasksForDate = tasks.filter((task) => {
    return (task.key !== TASK_KEYS.morningAdhkar && task.key !== TASK_KEYS.eveningAdhkar) || dateKey >= adhkarEffectiveDate;
  });
  await DailyTaskOccurrence.bulkWrite(
    tasksForDate.map((task) => ({
      updateOne: {
        filter: { memberId, taskId: task._id, dateKey },
        update: {
          $setOnInsert: {
            memberId,
            taskId: task._id,
            ...taskOccurrenceSnapshot(task),
            dateKey,
            status: "incomplete",
            memberNote: "",
            reviewNote: "",
            completedAt: null,
            reviewedAt: null,
            reviewedBy: null,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  const occurrences = await DailyTaskOccurrence.find({ memberId, dateKey }).sort({ taskKeySnapshot: 1 }).lean();
  return { tasks, occurrences };
}

export async function getBreaks(memberId: string, dateKey: string) {
  await connectToDatabase();
  return CourseBreak.find({ memberId, dateKey, status: "scheduled" }).populate("courseTaskId", "key nameAr").lean();
}
