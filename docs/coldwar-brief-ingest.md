# Cold War Brief Ingest Scaffold

Use this endpoint to upsert daily lesson content from your scraper.

## Endpoint

- `POST /v1/admin/briefs`
- Auth: `x-admin-key: <ADMIN_API_KEY>` (or `Authorization: Bearer <ADMIN_API_KEY>`)

## Payload

```json
{
  "items": [
    {
      "id": "cw-1961-berlin-wall",
      "date": "2026-03-12",
      "title": "Berlin Wall Construction (1961)",
      "lesson": "Physical barriers can harden political realities for generations.",
      "quote": "Ich bin ein Berliner.",
      "source": "John F. Kennedy, 1963",
      "tags": ["Berlin", "Germany", "Symbolism"]
    }
  ]
}
```

Notes:
- `date`, `title`, and `lesson` are required.
- `date` format must be `YYYY-MM-DD` (UTC day key).
- `id` is optional; if omitted it is auto-derived.

## Example

```bash
curl -X POST "https://<YOUR_APP_DOMAIN>/v1/admin/briefs" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  -d '{
    "items": [
      {
        "date": "2026-03-12",
        "title": "Berlin Wall Construction (1961)",
        "lesson": "Physical barriers can harden political realities for generations.",
        "quote": "Ich bin ein Berliner.",
        "source": "John F. Kennedy, 1963",
        "tags": ["Berlin", "Germany", "Symbolism"]
      }
    ]
  }'
```

