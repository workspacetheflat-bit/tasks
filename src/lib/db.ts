import mongoose from "mongoose";
import { requiredEnv } from "@/lib/config";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };
const cache = globalWithMongoose.mongooseCache ?? { connection: null, promise: null };
globalWithMongoose.mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.connection) return cache.connection;
  if (!cache.promise) {
    const uri = requiredEnv("MONGODB_URI");
    cache.promise = mongoose.connect(uri).catch((error: unknown) => {
      cache.promise = null;
      throw new Error("تعذر الاتصال بقاعدة البيانات. تحقق من MONGODB_URI وإمكانية الوصول إلى MongoDB.", { cause: error });
    });
  }
  cache.connection = await cache.promise;
  return cache.connection;
}
