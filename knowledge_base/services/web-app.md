---
label: Web App
desc: The customer-facing dashboard where teams manage projects.
ownedBy: product-team
maintainedBy: marcus-lee
dependsOn: auth-service, billing-service, search-service
mustSatisfy: testing-standard, api-design-standard
---
# Web App

The main product: a browser dashboard where customer teams plan projects, track tasks and manage billing.

## How it is built
- React single-page app talking to backend services over HTTPS.
- Login via the **Auth Service**, plan and invoice pages via the **Billing Service**, the search bar via the **Search Service**.

## Release rhythm
Released every Tuesday and Thursday, following the Deploy Guide.
