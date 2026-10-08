---
name: Profile image storage
description: Database requirements and schema-drift checks for profile photo uploads.
---

Profile photos are currently stored as data URLs in the user's avatar field. That column must be PostgreSQL `text`, not a bounded `varchar`; check the live development column type when profile saves fail even though the Drizzle schema declares `text`.

**Why:** A real profile save failed because the database column remained `varchar(255)` while uploaded photo data URLs are much longer. Widening the column to `text` preserved existing data and fixed persistence.

**How to apply:** When changing profile image storage or investigating failed uploads, verify both the Drizzle declaration and the actual database type. Production schema changes should flow through Replit Publish, not app-startup DDL.
