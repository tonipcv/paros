import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, scryptSync } from "node:crypto";
import { findPlan } from "../src/lib/models";
import { syncBundledCatalog } from "../src/lib/catalog-sync";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const freeCredits = findPlan("FREE")?.credits ?? 10;

function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

async function main() {
  const email = "demo@krx.ai";
  const password = process.env.DEMO_USER_PASSWORD || "ChangeMePlease123!";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists:", email);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "Demo User",
        password: hashPassword(password),
        workspace: { create: { name: "Demo Workspace", plan: "FREE", credits: freeCredits } },
      },
    });
    console.log(`Seeded demo user: ${email} / ${password}`);
  }
  const catalog = await syncBundledCatalog();
  console.log("Seeded bundled model catalog:", catalog);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
