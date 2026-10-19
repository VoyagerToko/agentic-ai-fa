---
label: Analytics Pipeline
desc: Collects product events and builds the daily usage dashboards.
ownedBy: data-team
maintainedBy: sofia-martinez
dependsOn: kafka, postgres
mustSatisfy: logging-standard, secrets-standard
---
# Analytics Pipeline

Turns raw product events into the daily dashboards used by leadership and the product team.

## What it does
- Reads every event from **Kafka** (sign-ups, invoices, searches).
- Writes daily summaries into a reporting schema in **Postgres** at 04:00 UTC.

## Notes
- Personal data (names, emails) is removed before events are stored.
