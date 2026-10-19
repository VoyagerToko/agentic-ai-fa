---
label: Billing Service
desc: Plans, subscriptions, invoices and payments for paying customers.
ownedBy: product-team
maintainedBy: chloe-nguyen
dependsOn: auth-service, postgres, kafka
mustSatisfy: secrets-standard, logging-standard, testing-standard
?dependsOn: notification-service
---
# Billing Service

Manages everything to do with money: pricing plans, subscriptions, monthly invoices and card payments.

## What it does
- Creates and upgrades subscriptions (Free, Team, Business plans).
- Generates an invoice on the 1st of every month.
- Publishes `invoice.created` and `payment.failed` events to **Kafka**.

## How it is built
- Python service. Invoices and subscriptions are stored in **Postgres**.
- Every request is checked against the **Auth Service**.

## Open question
The team believes failed-payment emails are sent by the Notification Service, but this has not been
confirmed yet - that link is recorded as a *proposed* fact.
