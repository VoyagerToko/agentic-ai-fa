---
label: Testing Standard
desc: Minimum automated testing every service and app must have before release.
maintainedBy: product-team
---
# Testing Standard

- Unit tests for business logic, with at least 70% line coverage on new code.
- At least one end-to-end test for each critical user journey (sign up, pay, search).
- Tests run on every pull request; a red build cannot be merged.
- Flaky tests are fixed or removed within one week.
