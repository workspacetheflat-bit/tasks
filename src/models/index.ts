import mongoose, { Schema, Types } from "mongoose";

const userSchema = new Schema(
  {
    displayName: { type: String, required: true, trim: true },
    username: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "member"], required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

const personalTodoSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },
    dueDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    isCompleted: { type: Boolean, default: false, required: true },
  },
  { timestamps: true },
);
personalTodoSchema.index({ memberId: 1, isCompleted: 1, dueDate: 1 });

const taskSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    nameAr: { type: String, required: true, trim: true },
    completionMode: { type: String, enum: ["self", "review"], default: "self", required: true },
    dailyValue: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    deductionMultiplier: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    durationMinutes: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    completionCriteria: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  },
  { timestamps: true },
);

const occurrenceSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "TaskDefinition", required: true },
    taskKeySnapshot: { type: String, required: true },
    taskNameSnapshot: { type: String, required: true },
    taskValueSnapshot: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    deductionMultiplierSnapshot: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    completionModeSnapshot: { type: String, enum: ["self", "review"], default: "self", required: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ["incomplete", "completed", "needs_review"], default: "incomplete", required: true },
    memberNote: { type: String, default: "" },
    reviewNote: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
occurrenceSchema.index({ memberId: 1, taskId: 1, dateKey: 1 }, { unique: true });
occurrenceSchema.index({ memberId: 1, dateKey: 1 });

const deductionSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "TaskDefinition", required: true },
    occurrenceId: { type: Schema.Types.ObjectId, ref: "DailyTaskOccurrence", required: true, unique: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    taskNameSnapshot: { type: String, required: true },
    amount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    relatedAuditEventIds: [{ type: Schema.Types.ObjectId, ref: "AuditEvent" }],
  },
  { timestamps: true },
);
deductionSchema.index({ memberId: 1, dateKey: 1, status: 1 });
deductionSchema.index({ taskId: 1, dateKey: 1 });

const courseCompletionSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseTaskId: { type: Schema.Types.ObjectId, ref: "TaskDefinition", required: true },
    courseName: { type: String, required: true, trim: true },
    completionDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
courseCompletionSchema.index({ memberId: 1, courseTaskId: 1, completionDate: -1 });

const courseBreakSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseTaskId: { type: Schema.Types.ObjectId, ref: "TaskDefinition", required: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["scheduled", "cancelled"], default: "scheduled", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
courseBreakSchema.index({ memberId: 1, courseTaskId: 1, dateKey: 1 }, { unique: true });
courseBreakSchema.index({ memberId: 1, dateKey: 1 });

const auditEventSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    reason: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditEventSchema.index({ createdAt: -1 });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const PersonalTodo = mongoose.models.PersonalTodo || mongoose.model("PersonalTodo", personalTodoSchema);
export const TaskDefinition = mongoose.models.TaskDefinition || mongoose.model("TaskDefinition", taskSchema);
export const DailyTaskOccurrence = mongoose.models.DailyTaskOccurrence || mongoose.model("DailyTaskOccurrence", occurrenceSchema);
export const Deduction = mongoose.models.Deduction || mongoose.model("Deduction", deductionSchema);
export const CourseCompletion = mongoose.models.CourseCompletion || mongoose.model("CourseCompletion", courseCompletionSchema);
export const CourseBreak = mongoose.models.CourseBreak || mongoose.model("CourseBreak", courseBreakSchema);
export const AuditEvent = mongoose.models.AuditEvent || mongoose.model("AuditEvent", auditEventSchema);

export function toObjectId(value: string): Types.ObjectId {
  if (!mongoose.isValidObjectId(value)) throw new Error("المعرّف المحدد غير صالح.");
  return new Types.ObjectId(value);
}
