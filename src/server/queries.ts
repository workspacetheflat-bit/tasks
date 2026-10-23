import "server-only";
import { connectToDatabase } from "@/lib/db";
import { TaskDefinition, DailyTaskOccurrence, User, CourseBreak } from "@/models";
import { taskOccurrenceSnapshot } from "@/lib/finance";

export async function findMemberId(): Promise<string | null> {
  await connectToDatabase();
  const member = await User.findOne({ role: "member", isActive: true }).select("_id").lean();
  return member ? String(member._id) : null;
}

export async function ensureDailyOccurrences(memberId: string, dateKey: string) {
  await connectToDatabase();
  const tasks = await TaskDefinition.find({ isActive: true }).sort({ displayOrder: 1 }).lean();
  if (!tasks.length) return { tasks, occurrences: [] };
  await DailyTaskOccurrence.bulkWrite(
    tasks.map((task) => ({
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
