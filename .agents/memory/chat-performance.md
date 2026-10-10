---
name: Chat performance
description: Durable rules for keeping group chat history and message sends responsive.
---

Chat history should be requested for the active public channel, DM, or group only, with a bounded recent-history window and indexes matching channel membership and message ordering. Message sends should update the active query cache immediately instead of invalidating and downloading the entire history. Keep profile-image data out of per-message responses and API body logs; resolve sender images from the user list.

**Why:** The application stores media as data URLs in message rows, and profile images can also be large. Repeating them across message responses or synchronously serializing full responses for logs makes history loading and sends feel slow.

**How to apply:** Preserve channel-scoped query keys and database indexes when changing chat polling, pagination, media, or message mutation behavior. Keep attachment previews cached locally after optimistic sends, and add explicit pagination before removing the recent-history bound.