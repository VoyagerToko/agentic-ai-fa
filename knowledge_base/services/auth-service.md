---
label: Auth Service
desc: Handles sign-up, login and token checks for every Orbit Labs app.
ownedBy: platform-team
maintainedBy: ben-carter
dependsOn: postgres, redis
mustSatisfy: secrets-standard, logging-standard, api-design-standard
---
# Auth Service

The Auth Service is the single place where users sign up, log in and get access tokens.
Every other app calls it to check whether a request comes from a signed-in user.

## What it does
- Email + password sign-up and login, with optional two-factor codes.
- Issues short-lived access tokens (15 minutes) and longer refresh tokens (30 days).
- Exposes `POST /v1/token/verify` so other services can check a token.

## How it is built
- Node.js service, deployed as a Docker container.
- User accounts live in **Postgres**; active sessions and rate limits live in **Redis**.

## Notes
- If Redis is down, logins still work but rate limiting is switched off.
- Password hashes use Argon2. Never log tokens or passwords (see the Logging Standard).
