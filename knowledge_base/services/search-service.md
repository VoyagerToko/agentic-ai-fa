---
label: Search Service
desc: Fast full-text search across customer projects and documents.
ownedBy: data-team
maintainedBy: diego-ramos
dependsOn: postgres
mustSatisfy: api-design-standard, testing-standard
---
# Search Service

Lets customers search across their projects, tasks and documents from the Web App.

## What it does
- Indexes new and changed records every minute from **Postgres**.
- Serves `GET /v1/search?q=` with typo tolerance and ranking by recency.

## How it is built
- Go service. Index is rebuilt nightly at 02:00 UTC.
