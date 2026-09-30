import { z } from "zod";

export const setupRequest = z.object({
  domain: z.string().min(1),
  asset: z.object({
    assetId: z.string().min(1),
    title: z.string().min(1),
    source: z.string().url(),
  }),
  processingJob: z.object({
    jobId: z.string().min(1),
    state: z.enum(["queued", "processing", "ready"]),
  }),
  delivery: z.object({ creatorEmail: z.string().email() }),
  mx: z.array(z.object({
    exchange: z.string().min(1),
    priority: z.number().int().min(0).max(65535),
  })).min(1),
});

export type SetupRequest = z.infer<typeof setupRequest>;

export function buildMediaMailPlan(input: SetupRequest) {
  const mx = [...input.mx].sort((a, b) => a.priority - b.priority);
  return {
    assetId: input.asset.assetId,
    jobId: input.processingJob.jobId,
    deliveryState: input.processingJob.state === "ready" ? "creator_delivery_ready" : "awaiting_processing",
    creatorEmail: input.delivery.creatorEmail,
    mx,
  } as const;
}
