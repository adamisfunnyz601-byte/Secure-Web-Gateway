---
name: Account cleanup safety
description: Preserve the correct owner and review related records before bulk account removal.
---

Before bulk account deletion, do not identify the retained owner from role labels alone. Require the app owner to identify the canonical account and review linked groups, access keys, history, and social records before removal.

**Why:** The development data contained multiple accounts marked as owners, but the app owner confirmed only one was canonical. Deleting by role alone could remove the actual administrator or strand linked records.

**How to apply:** For account resets, verify the target environment, preserve the user-confirmed owner, and enumerate dependent data and credentials before executing deletes. Count memberships on both sides: memberships belonging to removed users and memberships in groups that will be deleted, since the retained owner may be a member of someone else’s group.

**Why:** A retained account can have memberships in groups owned by accounts being removed. Those records must be disclosed separately because deleting the groups also removes the retained account’s memberships.
