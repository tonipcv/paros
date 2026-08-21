import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { hasR2, uploadArtifactBytes } from "./storage";

const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;
const TRUSTED_PROVIDER_HOSTS = ["fal.media", "replicate.delivery"];

function trustedProviderUrl(raw: string) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !TRUSTED_PROVIDER_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) throw new Error("Untrusted provider artifact URL");
  return url;
}

export async function persistArtifact(artifactId: string) {
  if (!hasR2()) throw new Error("R2 artifact storage is not configured");
  const artifact = await prisma.generatedArtifact.findUnique({ where: { id: artifactId } });
  if (!artifact || !artifact.expiresAt) return artifact;
  const url = trustedProviderUrl(artifact.url);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`Artifact download failed (${response.status})`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_ARTIFACT_BYTES) throw new Error("Artifact exceeds the 100 MB serverless persistence limit");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("Artifact exceeds the 100 MB serverless persistence limit");
  const contentType = response.headers.get("content-type") || artifact.contentType;
  const persistentUrl = await uploadArtifactBytes(bytes, contentType, `${artifact.kind.toLowerCase()}s`);
  const oldMetadata = artifact.metadata && typeof artifact.metadata === "object" && !Array.isArray(artifact.metadata) ? artifact.metadata as Prisma.JsonObject : {};
  const updated = await prisma.generatedArtifact.update({
    where: { id: artifact.id },
    data: { url: persistentUrl, contentType, sizeBytes: BigInt(bytes.byteLength), expiresAt: null, metadata: { ...oldMetadata, persistence: "r2", providerUrl: artifact.url } },
  });
  const pending = await prisma.generatedArtifact.count({ where: { jobId: artifact.jobId, expiresAt: { not: null } } });
  if (pending === 0) await prisma.generationJob.update({ where: { id: artifact.jobId }, data: { status: "SUCCEEDED", error: null } });
  return updated;
}

export async function persistPendingArtifacts(limit = 10) {
  if (!hasR2()) return { processed: 0, persisted: 0, failed: 0, skipped: "R2 not configured" };
  const artifacts = await prisma.generatedArtifact.findMany({ where: { expiresAt: { not: null } }, orderBy: { createdAt: "asc" }, take: Math.max(1, Math.min(25, limit)) });
  let persisted = 0;
  let failed = 0;
  for (const artifact of artifacts) {
    try { await persistArtifact(artifact.id); persisted++; }
    catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`artifact persistence failed (${artifact.id}):`, message);
      await prisma.generationJob.update({ where: { id: artifact.jobId }, data: { status: "RECONCILIATION_REQUIRED", error: `Artifact persistence: ${message}`.slice(0, 2000) } }).catch(() => undefined);
    }
  }
  return { processed: artifacts.length, persisted, failed };
}
