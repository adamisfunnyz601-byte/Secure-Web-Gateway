---
name: Drizzle schema caution
description: Project-specific caution for applying database schema changes.
---

Inspect the development schema and the proposed `drizzle-kit push` changes before applying them. A previous push warned about possible data loss on existing columns. For strictly additive nullable columns, prefer narrowly scoped development-only DDL and verify the resulting columns. Never target production directly; production schema changes go through Replit Publish.

**Why:** A broad schema push may affect existing columns unrelated to the requested feature, while a targeted additive change preserves current user data.

**How to apply:** Confirm each new column is absent before adding it in development, then query the catalog to verify it exists. Keep production changes within the Publish flow.
