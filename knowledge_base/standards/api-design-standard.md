---
label: API Design Standard
desc: Rules for designing HTTP APIs that are consistent across all services.
maintainedBy: platform-team
---
# API Design Standard

- Version every API in the path: `/v1/...`. Breaking changes need a new version.
- Use nouns for resources (`/v1/invoices`) and HTTP verbs for actions.
- Errors always use the same shape: `{ "error": { "type": "...", "message": "..." } }`.
- Lists are paginated with `?limit=` and `?cursor=`.
- Every endpoint is documented in the service README before it ships.
