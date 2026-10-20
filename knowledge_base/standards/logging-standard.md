---
label: Logging Standard
desc: What every service must log, in which format, and what it must never log.
maintainedBy: platform-team
---
# Logging Standard

- Log as **JSON**, one event per line, with `time`, `level`, `service`, `request_id` and `message`.
- Every incoming request gets a `request_id`, passed on to every downstream call.
- Use levels consistently: `error` needs action, `warn` is unusual, `info` is normal operation.
- Never log passwords, tokens, card numbers or full email addresses.
- Logs are kept for 30 days and searchable from the central log viewer.
