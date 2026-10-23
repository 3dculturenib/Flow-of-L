import { prisma } from "@/lib/prisma";

/** Local, single-user MVP identity. Authentication is intentionally not implemented yet. */
export async function getCurrentUser() {
  return prisma.user.upsert({
    where: { id: "seed-user" },
    update: {},
    create: { id: "seed-user", name: "Me", currency: "ETB" },
  });
}
