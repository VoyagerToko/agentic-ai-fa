---
label: Secrets Standard
desc: How passwords, API keys and tokens must be stored and handled.
maintainedBy: platform-team
---
# Secrets Standard

1. **Never commit secrets** to a repository - not even in test files. A pre-commit scan blocks it.
2. Store every secret in the company secret manager and load it at runtime through environment variables.
3. Rotate keys at least every 90 days, and immediately after someone with access leaves.
4. Each service gets its own credentials - no shared "admin" keys.
5. Secrets must never appear in logs, error messages or analytics events.
