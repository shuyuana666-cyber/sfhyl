import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { seedBrands } from "./brand-defaults";

if (!process.env.DATABASE_URL) config({ path: resolve(process.cwd(), "../../.env") });

const prisma = new PrismaClient();
async function run(): Promise<void> {
  try {
    await seedBrands(prisma);
    console.log("Default brand catalogue synchronized.");
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
