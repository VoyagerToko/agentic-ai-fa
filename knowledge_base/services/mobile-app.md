---
label: Mobile App
desc: iOS and Android app for checking tasks and getting notifications on the go.
ownedBy: product-team
maintainedBy: emma-schultz
dependsOn: auth-service, notification-service
?mustSatisfy: testing-standard
---
# Mobile App

A lighter version of the Web App for phones: view tasks, comment, and receive push notifications.

## How it is built
- React Native, one codebase for iOS and Android.
- Logs in through the **Auth Service**; push messages come from the **Notification Service**.

## Open question
Whether the Testing Standard fully applies to the mobile app is still being discussed (proposed fact).
