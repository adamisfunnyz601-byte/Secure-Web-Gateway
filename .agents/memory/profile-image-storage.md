---
name: Profile image storage
description: Database requirements and quality-preserving thumbnail delivery for profile photos.
---

Profile photos are currently stored as data URLs in the user's avatar and banner fields. Those columns must be PostgreSQL `text`, not bounded `varchar`. Keep the stored original untouched when optimizing display quality: routine profile views should use authenticated, versioned compressed thumbnails, while an explicit full-image view should serve the original bytes. Do not include data URLs in user/message JSON or serialize API response bodies into request logs.

**Why:** Uploaded data URLs exceed ordinary varchar limits, and repeating large image strings in chat responses and logs adds network, database, and event-loop work. The user also requires full original quality when opening an image, so resizing uploads destructively is not acceptable.

**How to apply:** When changing profile image storage or investigating failed uploads, verify both the Drizzle declaration and live database type. Generate display derivatives without replacing originals, keep edit forms from saving proxy URLs over stored data, and verify both thumbnail and full-image views. Production schema changes should flow through Replit Publish, not app-startup DDL.
