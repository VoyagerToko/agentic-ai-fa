---
label: Incident Runbook
desc: Step-by-step response when a production service is down or degraded.
maintainedBy: platform-team
relatesTo: logging-standard, notification-service, ava-patel
---
# Incident Runbook

1. **Declare** the incident in #incidents and name an incident lead (default: **Ava Patel**).
2. **Assess** impact: which services are affected? Check what depends on the failing service.
3. **Communicate**: post an update every 30 minutes; customer-facing outages get a status-page note.
4. **Mitigate** first (roll back, fail over, scale up), investigate root cause later.
5. **Review**: write a blameless post-incident review within 3 working days.

Use the `request_id` from logs (Logging Standard) to trace a failing request across services.
