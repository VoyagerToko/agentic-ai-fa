---
label: Notification Service
desc: Sends emails, push notifications and in-app messages.
ownedBy: platform-team
maintainedBy: ava-patel
dependsOn: kafka, redis
mustSatisfy: logging-standard, secrets-standard
---
# Notification Service

One service for every message we send to users: email, mobile push and in-app banners.

## What it does
- Listens to events on **Kafka** (for example `payment.failed`) and turns them into messages.
- Applies user preferences (some users opt out of marketing email).
- Keeps a short de-duplication window in **Redis** so nobody gets the same message twice.

## Notes
- Email provider credentials are stored in the secret manager, as the Secrets Standard requires.
