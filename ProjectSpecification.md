# Project Specification: Daily Tasks & Monthly Compensation Dashboard

Act as a senior full-stack engineer. **Build and implement the complete working application directly in the current workspace. Do not stop at planning, explanations, mockups, or pseudocode.** Make reasonable decisions independently, implement the requirements, run the checks, and fix errors before finishing.

## 1. Project Overview

Build a private Arabic RTL web application for managing daily tasks, tracking completion, reviewing deductions, and calculating monthly compensation for one family member.

There are two roles:
- **Admin:** manages tasks, reviews completion, records and approves deductions, and views monthly financial reports.
- **Member:** sees daily tasks, checks completed tasks, views progress, and can see deduction records and their reasons.

The application is intentionally small. Avoid unnecessary abstractions, excessive CRUD screens, microservices, and overengineering.

## 2. Technology Stack

- Next.js using the latest stable version available at implementation time.
- TypeScript with strict mode.
- App Router.
- Create the project using the CLI:
  `npx create-next-app@latest`
- Choose TypeScript, ESLint, Tailwind CSS, App Router, and the `src/` directory.
- Use MongoDB with Mongoose.
- Use a clean, responsive UI with Tailwind CSS and Lucide icons.
- Use Arabic as the default language and RTL throughout the application.
- Use a chart library only if it materially improves the dashboard; do not add unnecessary dependencies.
- Use npm unless the existing workspace clearly specifies another package manager.
- Use environment variables for secrets and connection strings.
- Do not use mock data as the production data source.

If the current directory is empty, scaffold the application there. If a project already exists, inspect it first and preserve useful existing configuration. Do not create a nested Next.js project unnecessarily.

## 3. Business Rules and Financial Configuration

The agreed monthly compensation is **8,520 EGP**, based on 30 calendar days.

Daily task values:

| Task | Daily value | Deduction if missed |
|---|---:|---:|
| Surah Al-Baqarah | 50 EGP | 100 EGP |
| Morning adhkar | 15 EGP | 30 EGP |
| Evening adhkar | 15 EGP | 30 EGP |
| Nutrition book writing | 40 EGP | 80 EGP |
| Nutrition or beauty course | 40 EGP | 80 EGP |
| Quran course | 40 EGP | 80 EGP |
| Nutrition page post #1 | 22 EGP | 44 EGP |
| Nutrition page post #2 | 22 EGP | 44 EGP |
| Scrolling-limit compliance | 40 EGP | 80 EGP |
| **Total** | **284 EGP/day** | **568 EGP if every task is missed** |

Calculation:
- Daily total: 284 EGP.
- 30-day task-value total: 8,520 EGP.
- Monthly base compensation: 8,520 EGP.
- Missed task deduction: twice the task's configured value.
- The actual payable amount is calculated from the agreed base compensation minus approved deductions. Do not subtract missed-task values a second time from the base amount.

Keep task values configurable in the database, but seed the initial tasks with the exact values above.

### Important compensation rules

- Each deduction must be a separate record linked to the task and its occurrence date.
- Each deduction must include the amount, reason, status, creation timestamp, and reviewer information where applicable.
- Deduction statuses: `pending`, `approved`, `rejected`.
- Only approved deductions affect the official monthly payable amount.
- Pending deductions must appear separately and must not reduce the official payable amount until approved.
- Prevent duplicate deductions for the same task occurrence unless an explicit admin override is provided and audited.
- Never create a deduction automatically merely because a checkbox is unchecked.
- Missing or incomplete task completion requires admin review and a recorded reason before a deduction can be approved.
- Keep an audit trail for deduction approval, rejection, and relevant edits.

Monthly summary:
- Base compensation: 8,520 EGP.
- Approved deductions: sum of approved deduction records for that month.
- Net payable: `max(0, baseCompensation - approvedDeductions)`.
- Show pending deductions separately.
- If deductions exceed the base compensation, show the excess clearly rather than silently hiding it. Preserve the full deduction ledger even if the displayed net payable is zero.

Do not use floating-point arithmetic for money. Store EGP amounts as integers.

## 4. Daily Tasks

Seed these nine active daily tasks:

1. Surah Al-Baqarah — 50 EGP — expected duration: 60 minutes.
2. Morning adhkar — 15 EGP — expected duration: 15 minutes.
3. Evening adhkar — 15 EGP — expected duration: 15 minutes.
4. Nutrition book writing — 40 EGP — expected duration: 60 minutes.
5. Nutrition or beauty course — 40 EGP — expected duration: 60 minutes.
6. Quran course — 40 EGP — expected duration: 60 minutes.
7. Nutrition page post #1 — 22 EGP — one completed, publish-ready or scheduled post.
8. Nutrition page post #2 — 22 EGP — one completed, publish-ready or scheduled post.
9. Scrolling-limit compliance — 40 EGP — maximum one hour of scrolling per day.

For each task, store:
- Name in Arabic.
- Stable task key.
- Daily value in EGP.
- Deduction multiplier (initially 2).
- Expected duration or completion criteria.
- Whether it is active.
- Display order.

Task completion records must be stored per member, task, and calendar date. Use a unique database index to prevent duplicate records for the same task and member on the same date.

Completion status:
- `incomplete`
- `completed`
- `needs_review`

The Member can mark a task completed or submit it for review. The Admin can review and correct completion records, with appropriate audit information.

Store timestamps consistently and use the configured application timezone for day boundaries. Default timezone: `Africa/Cairo`.

## 5. Course Completion and Break Day

The member studies two course tracks:
- Nutrition or beauty course.
- Quran course.

When a course is completed:
- The Admin or Member can record the course completion date and course name.
- A one-day break may be scheduled between the completed course and the next course.
- The break applies **only to the relevant course task**.
- All other daily tasks remain required on the break day.
- The break day must not be treated as a missed course task and must not generate a deduction for that course.
- The other course track remains unaffected.
- Record the reason and the course to which the break applies.
- Display the break clearly on both dashboards.

Implement this as a course-break record linked to the relevant course task and date, not as a global day off.

Do not allow multiple overlapping break records for the same course task and date.

## 6. Authentication and Authorization

This is a private application, not a public multi-tenant product.

Implement secure authentication with two roles:
- `admin`
- `member`

Requirements:
- Login and logout.
- Passwords hashed with a suitable password-hashing library.
- Secure session handling using HttpOnly cookies.
- Protect all dashboard pages and API/server actions.
- Enforce role checks on the server, not only in the UI.
- Member users may update their own daily completion records, but cannot approve deductions or change task values.
- Admin users may manage tasks, review completion records, and approve or reject deductions.
- Do not expose secrets or password hashes to the client.
- Provide a safe way to create the initial admin and member accounts through environment variables or a one-time setup script.
- Never ship default production credentials or hardcoded passwords.
- Do not add public self-registration.

## 7. Required Pages

### A. Login
- Arabic RTL login form.
- Email/username and password.
- Clear validation and error states.

### B. Admin Dashboard
Display:
- Selected month and date.
- Daily completion progress.
- Completed, incomplete, and awaiting-review task counts.
- Pending deduction count and total.
- Approved deductions for the selected month.
- Base compensation: 8,520 EGP.
- Net payable after approved deductions.
- Recent activity.
- Quick links to daily review and monthly reports.

### C. Daily Task Review — Admin
- Select a date using a date picker.
- Display all nine tasks and their configured values.
- Show the member's submitted completion status.
- Allow the Admin to correct completion status with a reason.
- Identify tasks that were required on that date.
- Show course-break exemptions for the relevant course only.
- Allow the Admin to create a deduction proposal for a missed required task.
- Require a reason for every deduction.
- Show duplicate warnings before creating a deduction.
- Do not auto-approve a deduction merely because a task is incomplete.

### D. Member Daily Tasks
- Mobile-first interface.
- Show the current date and daily progress.
- List all required tasks with Arabic names and clear checkboxes/buttons.
- Show the value of each task.
- Allow the member to mark a task completed or submit it for review.
- Display task criteria and course-break information.
- Preserve completion state across reloads.
- Show a clear success state after saving.
- Show deduction records and their current statuses in a separate section.

### E. Deductions Ledger
- List deductions with date, task, amount, reason, status, and reviewer.
- Filter by month, task, and status.
- Admin can approve or reject pending deductions.
- Require a rejection reason when rejecting.
- Require a reason for manual adjustments.
- Record who made each decision and when.
- Show the history of status changes.
- Avoid destructive deletion of approved financial records; use reversal or adjustment entries instead.

### F. Monthly Financial Report
- Select a month.
- Show base compensation: 8,520 EGP.
- Show approved deductions.
- Show pending deductions separately.
- Show rejected deductions separately.
- Show net payable after approved deductions.
- Show all task completion statistics.
- Export a printable report or PDF.
- Ensure that the report is calculated from stored records and not hardcoded values.

### G. Minimal Task Settings
- Admin can edit task names, daily values, multipliers, and completion criteria.
- Admin can activate or deactivate tasks.
- Preserve historical task values on past occurrences and deduction records.
- No need for a complicated task CRUD interface. A compact settings page or modal is enough.

## 8. UI and UX

Design requirements:
- Arabic-first UI with `lang="ar"` and `dir="rtl"`.
- Professional, modern visual style: navy, white, muted gold accents, and restrained green/red status colors.
- Responsive on desktop and mobile.
- Use clear typography, spacing, cards, and tables.
- Display currency consistently as EGP/جنيه.
- Use readable status labels in Arabic:
  - مكتملة
  - غير مكتملة
  - تحتاج مراجعة
  - قيد المراجعة
  - معتمدة
  - مرفوضة
  - يوم فاصل
- Use confirmation dialogs for approval/rejection and financial adjustments.
- Include loading, empty, error, and success states.
- Ensure accessible controls and visible focus states.
- Do not overdecorate the UI or introduce unnecessary animations.

## 9. MongoDB Data Models

Use Mongoose schemas and appropriate indexes for at least:

### User
- displayName
- username/email
- passwordHash
- role
- isActive
- createdAt / updatedAt

### TaskDefinition
- key
- nameAr
- dailyValue
- deductionMultiplier
- durationMinutes
- completionCriteria
- isActive
- displayOrder
- createdAt / updatedAt

### DailyTaskOccurrence
- memberId
- taskId
- taskNameSnapshot
- taskValueSnapshot
- deductionMultiplierSnapshot
- dateKey (`YYYY-MM-DD` in Africa/Cairo)
- status
- memberNote
- reviewNote
- completedAt
- reviewedAt
- reviewedBy
- createdAt / updatedAt

Unique index: `{ memberId, taskId, dateKey }`.

Snapshots ensure historical records do not change if task settings are edited later.

### Deduction
- memberId
- taskId
- occurrenceId
- dateKey
- taskNameSnapshot
- amount
- reason
- status
- createdBy
- reviewedBy
- reviewedAt
- rejectionReason
- relatedAuditEventIds
- createdAt / updatedAt

Add indexes for month/date, member, task, and status. Add appropriate uniqueness protection for duplicate task-occurrence deductions.

### CourseCompletion
- memberId
- courseTaskId
- courseName
- completionDate
- notes
- createdBy
- createdAt

### CourseBreak
- memberId
- courseTaskId
- dateKey
- reason
- status
- createdBy
- createdAt

Unique index: `{ memberId, courseTaskId, dateKey }`.

### AuditEvent
- actorId
- action
- entityType
- entityId
- before
- after
- reason
- createdAt

Use schema validation and indexes appropriate to the queries.

## 10. Server and Application Architecture

Use Next.js App Router and keep the implementation straightforward.

Suggested structure:
- `src/app/(auth)/login`
- `src/app/(admin)/dashboard`
- `src/app/(admin)/daily-review`
- `src/app/(admin)/deductions`
- `src/app/(admin)/reports`
- `src/app/(admin)/settings`
- `src/app/(member)/my-tasks`
- `src/app/(member)/deductions`
- `src/components`
- `src/lib/auth`
- `src/lib/db`
- `src/lib/validation`
- `src/lib/finance`
- `src/models`
- `src/server/actions` or `src/server/services`

Use Server Components by default. Use Client Components only for interactive elements.

Use Server Actions or Route Handlers consistently. Validate every mutation on the server using Zod or an equivalent validation library. Never rely on client-supplied task values, deduction amounts, role, or approval status.

The server must calculate deduction amounts from trusted task snapshots and configured multipliers.

Implement a single shared financial calculation module used by the dashboard and monthly reports.

## 11. Environment and Setup

Create:
- `.env.example`
- MongoDB connection helper with connection reuse.
- Initial task seed script.
- Secure initial-user setup script.
- README with exact local setup instructions.
- Production deployment instructions suitable for Vercel and MongoDB Atlas.

Environment variables should include:
- `MONGODB_URI`
- `AUTH_SECRET` or the required session secret
- `APP_TIMEZONE= Africa/Cairo` (without spaces around the value)
- Secure bootstrap variables for initial user creation, if needed.

Never commit `.env` or actual secrets.

Add a clear first-run setup flow. The app should fail with a helpful server-side message if required environment variables are missing.

## 12. Testing

Implement tests for financial logic and the highest-risk business rules.

At minimum, test:
1. Daily task values total 284 EGP.
2. Deduction values equal twice the task value.
3. Only approved deductions affect the official net payable.
4. Pending and rejected deductions do not affect net payable.
5. Duplicate deductions for one task occurrence are prevented.
6. A course-break day exempts only the relevant course task.
7. All other daily tasks remain required on a course-break day.
8. Course-break records cannot overlap for the same task/date.
9. Members cannot approve deductions or edit task values.
10. Monthly reports use stored records and the correct month boundaries.
11. Money is calculated with integer arithmetic.
12. Task settings changes do not alter historical snapshots.

## 13. Implementation Workflow

1. Inspect the workspace and existing project files.
2. Scaffold with `npx create-next-app@latest` if needed.
3. Install only required dependencies.
4. Implement MongoDB connection, schemas, indexes, and seed/setup scripts.
5. Implement secure authentication and role protection.
6. Implement task completion and course-break logic.
7. Implement deduction ledger, approval flow, and audit events.
8. Implement dashboards and monthly report.
9. Add validation, error states, and responsive Arabic RTL styling.
10. Add tests and run lint, typecheck, tests, and production build.
11. Fix any failures caused by the implementation.
12. Update README and `.env.example`.
13. Finish with a concise summary of implemented features, commands run, test results, and any remaining limitations.

Do not claim a feature is complete unless it is implemented and verified.

Start implementing now. Do not ask me to approve the plan first.
