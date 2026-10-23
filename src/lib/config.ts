export const MONTHLY_BASE_COMPENSATION = 8520;
export const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Cairo";

export const TASK_KEYS = {
  baqarah: "surah-al-baqarah",
  legacyAdhkar: "morning-evening-adhkar",
  morningAdhkar: "morning-adhkar",
  eveningAdhkar: "evening-adhkar",
  book: "nutrition-book-writing",
  nutritionCourse: "nutrition-beauty-course",
  quranCourse: "quran-course",
  postOne: "nutrition-page-post-1",
  postTwo: "nutrition-page-post-2",
  scrolling: "scrolling-limit",
} as const;

export const SEED_TASKS = [
  { key: TASK_KEYS.baqarah, nameAr: "سورة البقرة", dailyValue: 50, deductionMultiplier: 2, durationMinutes: 60, completionCriteria: "قراءة سورة البقرة كاملة", displayOrder: 1, completionMode: "self" },
  { key: TASK_KEYS.morningAdhkar, nameAr: "أذكار الصباح", dailyValue: 15, deductionMultiplier: 2, durationMinutes: 15, completionCriteria: "إتمام أذكار الصباح", displayOrder: 2, completionMode: "self" },
  { key: TASK_KEYS.eveningAdhkar, nameAr: "أذكار المساء", dailyValue: 15, deductionMultiplier: 2, durationMinutes: 15, completionCriteria: "إتمام أذكار المساء", displayOrder: 2, completionMode: "self" },
  { key: TASK_KEYS.book, nameAr: "كتابة كتاب التغذية", dailyValue: 40, deductionMultiplier: 2, durationMinutes: 60, completionCriteria: "إنجاز جلسة كتابة يومية", displayOrder: 3, completionMode: "self" },
  { key: TASK_KEYS.nutritionCourse, nameAr: "دورة التغذية أو التجميل", dailyValue: 40, deductionMultiplier: 2, durationMinutes: 60, completionCriteria: "إنجاز درس أو جلسة من الدورة الحالية", displayOrder: 4, completionMode: "self" },
  { key: TASK_KEYS.quranCourse, nameAr: "دورة القرآن", dailyValue: 40, deductionMultiplier: 2, durationMinutes: 60, completionCriteria: "إنجاز درس أو جلسة من دورة القرآن", displayOrder: 5, completionMode: "self" },
  { key: TASK_KEYS.postOne, nameAr: "منشور صفحة التغذية الأول", dailyValue: 22, deductionMultiplier: 2, durationMinutes: 0, completionCriteria: "منشور مكتمل وجاهز للنشر أو مجدول", displayOrder: 6, completionMode: "self" },
  { key: TASK_KEYS.postTwo, nameAr: "منشور صفحة التغذية الثاني", dailyValue: 22, deductionMultiplier: 2, durationMinutes: 0, completionCriteria: "منشور مكتمل وجاهز للنشر أو مجدول", displayOrder: 7, completionMode: "self" },
  { key: TASK_KEYS.scrolling, nameAr: "الالتزام بحد التصفح", dailyValue: 40, deductionMultiplier: 2, durationMinutes: 60, completionCriteria: "الحد الأقصى للتصفح ساعة واحدة يومياً", displayOrder: 8, completionMode: "review" },
] as const;

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`إعداد الخادم ناقص: يرجى ضبط ${name} في ملف البيئة.`);
  return value;
}
