---
label: Deploy Guide
desc: How code goes from a pull request to production.
maintainedBy: platform-team
relatesTo: docker, testing-standard
---
# Deploy Guide

1. Open a pull request. Automated tests must pass (see the Testing Standard).
2. Get one approval from someone on the owning team.
3. Merging builds a **Docker** image and deploys it to the staging environment automatically.
4. Check staging, then press "Promote" to release to production.
5. Watch the dashboards for 15 minutes after release. If error rates rise, roll back with one click.

Releases are not allowed on Friday afternoons.
