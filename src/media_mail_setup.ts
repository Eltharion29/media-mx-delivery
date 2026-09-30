import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { z } from "zod";
import { InfraiError, InfraiMailClient } from "./infrai_mail.js";
import { buildMediaMailPlan, setupRequest, type SetupRequest } from "./media_delivery_plan.js";

export async function configureMediaMail(input: SetupRequest, client: InfraiMailClient) {
  const plan = buildMediaMailPlan(input);
  const { zone_id } = await client.getZone(input.domain);

  await Promise.all(plan.mx.map((record) => {
    const key = createHash("sha256")
      .update(`${zone_id}:${input.domain}:${record.exchange}:${record.priority}`)
      .digest("hex");
    return client.upsertMx({
      zone_id,
      name: input.domain,
      content: record.exchange,
      priority: record.priority,
      ttl: 3600,
    }, key);
  }));

  const sendingDomains = await client.listSendingDomains();
  return { zone_id, plan, sendingDomains };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const client = new InfraiMailClient(apiKey);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/media-mail/setup") {
    respond(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = setupRequest.parse(await readJson(request));
    respond(response, 200, await configureMediaMail(input, client));
  } catch (error) {
    if (error instanceof z.ZodError) {
      respond(response, 400, { error: "Invalid request", issues: error.issues });
    } else if (error instanceof InfraiError) {
      respond(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message,
      });
    } else {
      respond(response, 500, { error: "Request could not be completed" });
    }
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Media mail setup listening on http://localhost:${process.env.PORT ?? 3000}`);
});
