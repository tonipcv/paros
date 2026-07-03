import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

async function main() {
  const email = "demo@nebula.ai";
  const password = process.env.DEMO_USER_PASSWORD || "ChangeMePlease123!";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists:", email);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      name: "Demo User",
      password: hashPassword(password),
      workspace: { create: { name: "Demo Workspace", plan: "FREE", credits: 500 } },
    },
  });
  console.log(`Seeded demo user: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
