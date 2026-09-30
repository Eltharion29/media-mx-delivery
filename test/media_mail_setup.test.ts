import assert from "node:assert/strict";
import test from "node:test";
import { buildMediaMailPlan, type SetupRequest } from "../src/media_delivery_plan.js";

test("orders MX exchanges and holds creator delivery until processing is ready", () => {
  const input: SetupRequest = {
    domain: "media.example.com",
    asset: { assetId: "asset-42", title: "Launch cut", source: "https://media.example.com/launch.mp4" },
    processingJob: { jobId: "job-9", state: "processing" },
    delivery: { creatorEmail: "creator@example.com" },
    mx: [
      { exchange: "backup.mail.example", priority: 20 },
      { exchange: "primary.mail.example", priority: 10 },
    ],
  };

  const plan = buildMediaMailPlan(input);

  assert.equal(plan.deliveryState, "awaiting_processing");
  assert.deepEqual(plan.mx.map(({ exchange, priority }) => [exchange, priority]), [
    ["primary.mail.example", 10],
    ["backup.mail.example", 20],
  ]);
});
