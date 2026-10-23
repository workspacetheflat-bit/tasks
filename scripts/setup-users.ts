import "dotenv/config";
import { hash } from "bcryptjs";
import { connectToDatabase } from "../src/lib/db";
import { requiredEnv } from "../src/lib/config";
import { User } from "../src/models";

type BootstrapUser = { displayName: string; username: string; password: string; role: "admin" | "member" };

async function upsertBootstrapUser(user: BootstrapUser): Promise<void> {
  if (user.password.length < 12) {
    throw new Error(`كلمة مرور ${user.role} يجب أن تتكون من 12 حرفاً على الأقل.`);
  }
  const existing = await User.findOne({ username: user.username.toLowerCase() });
  if (existing) {
    console.info(`الحساب ${user.username} موجود مسبقاً؛ لم يتم تغيير بياناته.`);
    return;
  }
  await User.create({
    displayName: user.displayName,
    username: user.username,
    passwordHash: await hash(user.password, 12),
    role: user.role,
    isActive: true,
  });
  console.info(`تم إنشاء حساب ${user.role}: ${user.username}`);
}

async function main(): Promise<void> {
  const admin: BootstrapUser = {
    displayName: requiredEnv("BOOTSTRAP_ADMIN_NAME"),
    username: requiredEnv("BOOTSTRAP_ADMIN_USERNAME"),
    password: requiredEnv("BOOTSTRAP_ADMIN_PASSWORD"),
    role: "admin",
  };
  const member: BootstrapUser = {
    displayName: requiredEnv("BOOTSTRAP_MEMBER_NAME"),
    username: requiredEnv("BOOTSTRAP_MEMBER_USERNAME"),
    password: requiredEnv("BOOTSTRAP_MEMBER_PASSWORD"),
    role: "member",
  };
  await connectToDatabase();
  await upsertBootstrapUser(admin);
  await upsertBootstrapUser(member);
  await User.db?.close();
}

main().catch((error: unknown) => {
  console.error("فشل إنشاء الحسابات الأولية:", error);
  process.exitCode = 1;
});
