import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { connectToDatabase } from "@/lib/db";
import { requiredEnv } from "@/lib/config";
import { User } from "@/models";
import { canPerform } from "@/lib/finance";

const cookieName = "task-dashboard-session";

function secretKey(): Uint8Array {
  const secret = requiredEnv("AUTH_SECRET");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SECRET يجب أن يتكون من 32 حرفاً على الأقل.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(cookieName);
}

export type AuthenticatedUser = { id: string; displayName: string; username: string; role: "admin" | "member" };

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const key = secretKey();
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    userId = payload.sub;
  } catch {
    return null;
  }
  await connectToDatabase();
  const user = await User.findOne({ _id: userId, isActive: true })
    .select("displayName username role")
    .lean();
  if (!user || (user.role !== "admin" && user.role !== "member")) return null;
  return { id: String(user._id), displayName: user.displayName, username: user.username, role: user.role };
}

export async function requireUser(role?: "admin" | "member"): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role === "admin" && !canPerform(user.role, "approve-deduction")) {
    redirect("/my-tasks");
  }
  if (role === "member" && user.role !== "member") {
    redirect(user.role === "admin" ? "/dashboard" : "/my-tasks");
  }
  return user;
}
