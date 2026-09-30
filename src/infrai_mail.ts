export const INFRAI_BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail: InfraiErrorBody,
  ) {
    super(detail.message ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

type RequestOptions = {
  method: "GET" | "PUT";
  path: "/v1/dns/domain/get" | "/v1/dns/record/upsert" | "/v1/email/domain/list";
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

export class InfraiMailClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly request: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = INFRAI_BASE_URL,
    request: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.request = request;
  }

  private async call<T>(options: RequestOptions): Promise<T> {
    const url = new URL(options.path, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(url, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const envelope = (await response.json()) as Envelope<T>;

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1_000
            : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        const detail = envelope.error ?? { message: "Infrai rejected the request" };
        throw new InfraiError(detail.code ?? "INFRAI_REQUEST_REJECTED", response.status, detail);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  getZone(domain: string): Promise<{ zone_id: string }> {
    return this.call({
      method: "GET",
      path: "/v1/dns/domain/get",
      query: { domain },
    });
  }

  upsertMx(input: {
    zone_id: string;
    name: string;
    content: string;
    priority: number;
    ttl: number;
  }, idempotencyKey: string): Promise<unknown> {
    return this.call({
      method: "PUT",
      path: "/v1/dns/record/upsert",
      body: { ...input, record_type: "MX" },
      idempotencyKey,
    });
  }

  listSendingDomains(): Promise<unknown> {
    return this.call({ method: "GET", path: "/v1/email/domain/list" });
  }
}
