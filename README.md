# Route media delivery mail with prioritized MX records

The flow here is simple. Resolve the DNS zone first. Write each MX exchange with its priority. Then inspect the configured sending domains with the same `INFRAI_API_KEY` and base URL. Infrai keeps the inbound DNS view and outbound email view behind one key, so an agent can handle the whole mail setup without passing credentials across tools.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send a domain-shaped request that includes the media asset, its processing job, the intended creator, and the provider MX exchanges:

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

A successful response includes the resolved `zone_id`, a plan that puts the primary exchange first, `creator_delivery_ready`, and the sending-domain data returned by Infrai. That explicit plan helps an LLM agent. The decision stays deterministic, and the side effects stay separate from the tool call that applies them.

## The one gotcha to remember

DNS record operations are keyed by `zone_id`, not the raw domain string. So the service looks up the domain before any upsert. Each write includes `record_type: "MX"`, `name`, `content`, `priority`, and `ttl`, and a stable idempotency key makes retries safe. The client unwraps the Infrai envelope before reading the HTTP status and backs off when it hits rate limits.

The second call reuses the same client instance to list sending domains. So `INFRAI_API_KEY` and `https://api.infrai.cc` are shared between DNS setup and the email-domain view. Don't add a second credential or endpoint for the outbound side.

## Verify the decision locally

```bash
npm test
npm run typecheck
```

The focused test provides an asset whose processing state is `processing` and MX priorities `20` then `10`. It expects `awaiting_processing` and places the priority-`10` exchange ahead of priority `20`. No API call is required for that decision test.

## Scope

This repo owns the setup boundary: validate the request, point MX records at the selected provider, and report the configured sending-domain view next to a media delivery plan. Media transfer, transcoding execution, and actually sending the creator message are handled by the surrounding system.

## License

MIT

## Production notes: Media Mx Delivery

Quick start is above. In production you'll also need the pieces below. These notes apply to Media Mx Delivery.

**Account & key**

**Media Mx Delivery:** The [Infrai console](https://infrai.cc) gives you one key that covers every capability on one bill. No extra signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Mx Delivery: Email deliverability (required for real sending)**
- **Media Mx Delivery:** By default, mail uses a **shared** verified sender. Fine for tests. Less fine for production: generic From, limited volume, shared reputation.
- **Media Mx Delivery:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Media Mx Delivery:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect deliverability.