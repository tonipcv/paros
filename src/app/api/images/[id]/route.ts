import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, handleRouteError, json } from "@/lib/http";

export const runtime = "nodejs";

async function ownedImage(id: string, userId: string) {
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return null;
  return prisma.generatedImage.findFirst({ where: { id, workspaceId: workspace.id } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = (await params).id;
    const image = await ownedImage(id, user.id);
    if (!image) return error("Image not found", 404);
    const body = await request.json().catch(() => ({}));
    if (typeof body.favorite !== "boolean") return error("favorite must be a boolean");
    return json({ image: await prisma.generatedImage.update({ where: { id }, data: { favorite: body.favorite } }) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = (await params).id;
    const image = await ownedImage(id, user.id);
    if (!image) return error("Image not found", 404);
    await prisma.generatedImage.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
