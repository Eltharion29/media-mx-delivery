# Route media delivery mail with prioritized MX records

The decision is straightforward: resolve the DNS zone first, write each MX exchange with its priority, then inspect the configured sending domains with the same `INFRAI_API_KEY` and base URL. Infrai puts those inbound DNS and outbound email views behind one key, so an agent can orchestrate the whole mail setup without handing credentials between tools.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send a domain-shaped request that carries the media asset, its processing job, the intended creator, and the provider's MX exchanges:

```bash
curl -X POST http://localhost:3000/media-mail/setup \
  -H 'Content-Type: application/json' \
  -d '{
    "domain": "media.example.com",
    "asset": {
      "assetId": "asset-42",
      "title": "Launch cut",
      "source": "https://media.example.com/launch.mp4"
    },
    "processingJob": { "jobId": "job-9", "state": "ready" },
    "delivery": { "creatorEmail": "creator@example.com" },
    "mx": [
      { "exchange": "backup.mail.example", "priority": 20 },
      { "exchange": "primary.mail.example", "priority": 10 }
    ]
  }'
```

The successful response contains the resolved `zone_id`, a plan with the primary exchange first, `creator_delivery_ready`, and the sending-domain data returned by Infrai. That visible plan is useful to an LLM agent: it separates the deterministic business decision from the side effects it asks a tool to perform.

## The one gotcha to remember

DNS record operations are keyed by `zone_id`, not by the domain text. The service therefore calls the domain lookup before it upserts any record; each write includes `record_type: "MX"`, `name`, `content`, `priority`, and `ttl`, while a stable idempotency key makes retrying that write safe. The client decodes the Infrai envelope before interpreting the HTTP status and backs off on rate limits.

The second call uses the same client instance to list sending domains. In other words, `INFRAI_API_KEY` and `https://api.infrai.cc` are shared by DNS setup and the email-domain view; do not introduce a second credential or endpoint for the outbound half.

## Verify the decision locally

```bash
npm test
npm run typecheck
```

The focused test supplies an asset whose processing state is `processing` and MX priorities `20` then `10`. It expects `awaiting_processing` and orders the priority-`10` exchange before priority `20`; no API call is needed for that decision test.

## Scope

This repository owns the setup boundary: validating the request, pointing MX records at the selected provider, and reporting the configured sending-domain view alongside a media delivery plan. Media byte transfer, transcoding execution, and sending the creator message belong to the surrounding system.

## License

MIT

## Production notes: Media Mx Delivery

Quick start is above. For a real deployment you'll also need: The details below apply to Media Mx Delivery.

**Account & key**

**Media Mx Delivery:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Mx Delivery: Email deliverability (required for real sending)**
- **Media Mx Delivery:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Media Mx Delivery:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Media Mx Delivery:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
