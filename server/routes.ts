
import { db } from "./db";
import { users, accessKeys, searchHistory, messages, groupChats, groupChatMembers, customEmojis, friendRequests, blocks } from "@shared/schema";
import { eq, desc, and, or, gt, sql } from "drizzle-orm";
import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import {
  PROFILE_TAG_COLORS,
  PROFILE_TAG_SYMBOLS,
  isProfileTagColor,
  isProfileTagSymbol,
  normalizeProfileTagText,
} from "@shared/profile-tag";
import { z } from "zod";
import session from "express-session";
import createMemoryStore from "memorystore";
import { randomBytes } from "crypto";

const MemoryStore = createMemoryStore(session);
const OWNER_KEY = "TSHSKDB163)#(";
const PRESENCE_STATUSES = ["online", "idle", "dnd", "offline"] as const;

// Extend session type
declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware
  app.use(
    session({
      cookie: { maxAge: 86400000 },
      store: new MemoryStore({
        checkPeriod: 86400000,
      }),
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "super secret hacker key",
    })
  );

  // Middleware to check auth
  const requireAuth = (req: Request, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized: Login required" });
    }
    next();
  };

  const requireOwner = (req: Request, res: any, next: any) => {
    if (!req.session.userId || req.session.role !== "owner") {
      return res.status(403).json({ message: "Forbidden: Owner access only" });
    }
    next();
  };

  const blockedEitherWay = async (userId: number, otherId: number) => {
    const [block] = await db.select({ id: blocks.id }).from(blocks).where(
      or(
        and(eq(blocks.blockerId, userId), eq(blocks.blockedId, otherId)),
        and(eq(blocks.blockerId, otherId), eq(blocks.blockedId, userId)),
      ),
    ).limit(1);
    return !!block;
  };

  const safeUser = (user: any) => {
    if (!user) return user;
    const { serialKey: _serialKey, ...safe } = user;
    return safe;
  };

  // === AUTH ===
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { serialKey, username } = api.auth.login.input.parse(req.body);
      
      let user = await storage.getUserBySerial(serialKey);
      
      // Check if it's the owner key
      if (serialKey === OWNER_KEY) {
        if (!user) {
          user = await storage.createUser({
            username: username || "Owner",
            serialKey,
            role: "owner",
          });
        }
      } else {
        // Standard user login via Access Key
        if (!user) {
          // Check if it's a valid access key
          const accessKey = await storage.getAccessKey(serialKey);
          if (!accessKey) {
            return res.status(401).json({ message: "Invalid serial key" });
          }
          if (accessKey.isUsed && accessKey.type !== 'permanent') {
             // If key is single-use and used (NOTE: Schema implies keys create accounts, 
             // we might want to allow re-login if account exists. 
             // But let's assume keys are "invites" to create an account OR purely reusable keys.
             // For simplicity: keys map to Users. If User exists for key, they log in.
             // If not, we create user.)
          }
          
          // Create the user
          let expiresAt: Date | undefined;
          if (accessKey.type === 'limited' && accessKey.durationMinutes) {
            expiresAt = new Date(Date.now() + accessKey.durationMinutes * 60000);
          }

          user = await storage.createUser({
            username: username || `User-${randomBytes(2).toString('hex')}`,
            serialKey,
            role: "user",
            expiresAt
          });
          
          await storage.markKeyAsUsed(accessKey.id);
        }
      }
      
      // Check expiration
      if (user.expiresAt && new Date() > user.expiresAt) {
        return res.status(401).json({ message: "Account expired" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.role = user.role;
      await db.update(users).set({
        presenceStatus: "online",
        lastSeen: new Date(),
      }).where(eq(users.id, user.id));
      
      res.json(safeUser({ ...user, presenceStatus: "online", lastSeen: new Date() }));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0]?.message || "Invalid login details" });
      }
      console.error(err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get(api.auth.me.path, requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (user) {
      await db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, user.id));
    }
    res.json(safeUser(user));
  });

  app.post(api.auth.logout.path, (req, res) => {
    const userId = req.session.userId;
    if (userId) {
      db.update(users).set({ presenceStatus: "offline", lastSeen: new Date() })
        .where(eq(users.id, userId)).catch(console.error);
    }
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  // === ADMIN ===
  app.post(api.admin.generateKey.path, requireOwner, async (req, res) => {
    const input = api.admin.generateKey.input.parse(req.body);
    // Generate a random key
    const key = `KEY-${randomBytes(4).toString('hex').toUpperCase()}`;
    
    const newKey = await storage.createAccessKey({
      key,
      type: input.type,
      durationMinutes: input.durationMinutes,
      createdBy: req.session.userId!
    });
    
    res.status(201).json(newKey);
  });

  app.get(api.admin.listKeys.path, requireOwner, async (req, res) => {
    // Join with users to see who used the key, also select isUsed and duration
    const keysWithUsers = await db.select({
      id: accessKeys.id,
      key: accessKeys.key,
      type: accessKeys.type,
      isUsed: accessKeys.isUsed,
      durationMinutes: accessKeys.durationMinutes,
      createdAt: accessKeys.createdAt,
      username: users.username,
    })
    .from(accessKeys)
    .leftJoin(users, eq(accessKeys.key, users.serialKey))
    .orderBy(desc(accessKeys.createdAt));
    
    res.json(keysWithUsers);
  });

  app.delete(api.admin.deleteKey.path, requireOwner, async (req, res) => {
    await storage.deleteAccessKey(Number(req.params.id));
    res.status(204).send();
  });

  // === HISTORY ===
  app.get(api.history.list.path, requireAuth, async (req, res) => {
    const history = await storage.getHistory(req.session.userId!);
    res.json(history);
  });

  app.post(api.history.create.path, requireAuth, async (req, res) => {
    const input = api.history.create.input.parse(req.body);
    const entry = await storage.createHistory({
      userId: req.session.userId!,
      url: input.url,
      query: input.query ?? undefined
    });
    res.status(201).json(entry);
  });

  app.delete(api.history.clear.path, requireAuth, async (req, res) => {
    await storage.clearHistory(req.session.userId!);
    res.status(204).send();
  });

  // === CHAT ===
  app.get(api.chat.list.path, requireAuth, async (req, res) => {
    const recipientId = req.query.recipientId ? Number(req.query.recipientId) : undefined;
    const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
    if (recipientId !== undefined && (!Number.isInteger(recipientId) || recipientId <= 0)) {
      return res.status(400).json({ message: "Invalid recipient" });
    }
    if (groupId !== undefined && (!Number.isInteger(groupId) || groupId <= 0)) {
      return res.status(400).json({ message: "Invalid group" });
    }
    const messages = await storage.getMessages(req.session.userId!, recipientId, groupId);
    res.json(messages);
  });

  app.post(api.chat.send.path, requireAuth, async (req, res) => {
    const input = api.chat.send.input.parse(req.body);
    if (input.recipientId && input.groupId) {
      return res.status(400).json({ message: "Choose a DM or a channel, not both" });
    }
    if (input.recipientId) {
      if (input.recipientId === req.session.userId) {
        return res.status(400).json({ message: "You cannot DM yourself" });
      }
      if (await blockedEitherWay(req.session.userId!, input.recipientId)) {
        return res.status(403).json({ message: "Messaging is unavailable for this user" });
      }
    }
    if (input.groupId) {
      const [membership] = await db.select({ id: groupChatMembers.id })
        .from(groupChatMembers)
        .where(and(eq(groupChatMembers.groupId, input.groupId), eq(groupChatMembers.userId, req.session.userId!)))
        .limit(1);
      if (!membership) return res.status(403).json({ message: "You are not a member of this channel" });
    }
    const message = await storage.createMessage({
      senderId: req.session.userId!,
      recipientId: input.recipientId,
      groupId: input.groupId,
      content: input.content,
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      replyToId: (req.body as any).replyToId ?? null,
    });
    res.status(201).json(message);
  });

  app.get('/api/chat/messages/:id/media', requireAuth, async (req, res) => {
    const messageId = Number(req.params.id);
    if (!Number.isInteger(messageId)) return res.status(400).json({ message: 'Invalid message' });

    const [message] = await db.select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      groupId: messages.groupId,
      mediaUrl: messages.mediaUrl,
      mediaType: messages.mediaType,
    }).from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!message || !message.mediaUrl) return res.status(404).json({ message: 'Attachment not found' });

    let allowed = !message.recipientId && !message.groupId;
    if (message.recipientId) {
      allowed = message.senderId === req.session.userId || message.recipientId === req.session.userId;
    }
    if (message.groupId) {
      const [membership] = await db.select({ id: groupChatMembers.id })
        .from(groupChatMembers)
        .where(and(eq(groupChatMembers.groupId, message.groupId), eq(groupChatMembers.userId, req.session.userId!)))
        .limit(1);
      allowed = !!membership;
    }
    if (allowed && await blockedEitherWay(req.session.userId!, message.senderId)) allowed = false;
    if (!allowed) return res.status(403).json({ message: 'Attachment unavailable' });

    res.json({ mediaUrl: message.mediaUrl, mediaType: message.mediaType });
  });

  app.delete('/api/chat/messages/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    await db.delete(messages).where(and(eq(messages.id, id), eq(messages.senderId, req.session.userId!)));
    res.status(204).send();
  });

  // Soundboard broadcast - sends an SFX signal message to a channel so others auto-play it
  app.post('/api/chat/soundboard/play', requireAuth, async (req, res) => {
    const { soundUrl, soundName, recipientId, groupId } = req.body;
    const message = await storage.createMessage({
      senderId: req.session.userId!,
      recipientId: recipientId ?? null,
      groupId: groupId ?? null,
      content: `[SFX:${soundName}]`,
      mediaUrl: soundUrl,
      mediaType: 'sfx',
    });
    res.status(201).json(message);
  });

  app.post(api.chat.createGroup.path, requireAuth, async (req, res) => {
    const { name } = api.chat.createGroup.input.parse(req.body);
    const inviteCode = `GC-${randomBytes(3).toString('hex').toUpperCase()}`;
    const group = await storage.createGroup({
      name,
      inviteCode,
      ownerId: req.session.userId!
    });
    res.status(201).json(group);
  });

  app.post(api.chat.joinGroup.path, requireAuth, async (req, res) => {
    const { inviteCode } = api.chat.joinGroup.input.parse(req.body);
    const group = await storage.getGroupByCode(inviteCode);
    if (!group) {
      return res.status(404).json({ message: "Invalid group code" });
    }
    await storage.joinGroup(req.session.userId!, group.id);
    res.json(group);
  });

  app.get(api.chat.listGroups.path, requireAuth, async (req, res) => {
    const groups = await storage.getUserGroups(req.session.userId!);
    res.json(groups);
  });

  app.patch("/api/user/settings", requireAuth, async (req, res) => {
    const update: any = {};
    const { ringtoneUrl, muteNotifications, presenceStatus } = req.body;
    if (ringtoneUrl !== undefined) {
      update.ringtoneUrl = ringtoneUrl ? String(ringtoneUrl).slice(0, 500) : null;
    }
    if (muteNotifications !== undefined) {
      update.muteNotifications = Boolean(muteNotifications);
    }
    if (presenceStatus !== undefined && PRESENCE_STATUSES.includes(presenceStatus)) {
      update.presenceStatus = presenceStatus;
    }
    if (Object.keys(update).length) {
      update.lastSeen = new Date();
      await db.update(users).set(update).where(eq(users.id, req.session.userId!));
    }
    const updated = await storage.getUser(req.session.userId!);
    res.json(safeUser(updated));
  });

  // === USER PROFILE ===
  app.get("/api/user/profile/:id", requireAuth, async (req, res) => {
    const targetId = Number(req.params.id);
    const [user] = await db.select().from(users).where(eq(users.id, targetId));
    if (!user) return res.status(404).json({ message: "User not found" });

    // Find mutual group chats
    const myGroupRows = await db.select({ groupId: groupChatMembers.groupId })
      .from(groupChatMembers).where(eq(groupChatMembers.userId, req.session.userId!));
    const theirGroupRows = await db.select({ groupId: groupChatMembers.groupId })
      .from(groupChatMembers).where(eq(groupChatMembers.userId, targetId));
    const myIds = new Set(myGroupRows.map(r => r.groupId));
    const mutualIds = theirGroupRows.map(r => r.groupId).filter(id => myIds.has(id));
    const mutualGroups = mutualIds.length
      ? await db.select().from(groupChats).where(sql`${groupChats.id} IN (${sql.join(mutualIds.map(i => sql`${i}`), sql`, `)})`)
      : [];

    const { serialKey, ...safe } = user;
    res.json({ ...safe, mutualGroups });
  });

  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const {
        username,
        nickname,
        displayName,
        bio,
        pronouns,
        avatarUrl,
        bannerUrl,
        usernameFont,
        tagSymbol,
        tagText,
        tagColor,
      } = req.body;
      const update: any = {};
      if (typeof username === 'string' && username.trim().length > 0) update.username = username.trim().slice(0, 32);
      if (nickname !== undefined) update.nickname = nickname ? String(nickname).slice(0, 32) : null;
      if (displayName !== undefined) update.displayName = displayName ? String(displayName).slice(0, 32) : null;
      if (bio !== undefined) update.bio = bio ? String(bio).slice(0, 500) : null;
      if (pronouns !== undefined) update.pronouns = pronouns ? String(pronouns).slice(0, 32) : null;
      if (avatarUrl !== undefined) update.avatarUrl = typeof avatarUrl === 'string' && avatarUrl.length > 0 ? avatarUrl : null;
      if (bannerUrl !== undefined) update.bannerUrl = typeof bannerUrl === 'string' && bannerUrl.length > 0 ? bannerUrl : null;
      if (usernameFont !== undefined) update.usernameFont = usernameFont || null;
      if (tagSymbol !== undefined || tagText !== undefined || tagColor !== undefined) {
        if (tagText !== undefined && tagText !== null && typeof tagText !== "string") {
          return res.status(400).json({ message: "Tag text must be a string" });
        }

        const [currentUser] = await db
          .select({
            tagSymbol: users.tagSymbol,
            tagText: users.tagText,
            tagColor: users.tagColor,
          })
          .from(users)
          .where(eq(users.id, req.session.userId!));
        const nextTagText =
          tagText === null
            ? ""
            : typeof tagText === "string"
              ? normalizeProfileTagText(tagText)
              : currentUser?.tagText || "";

        if (!nextTagText) {
          update.tagSymbol = null;
          update.tagText = null;
          update.tagColor = null;
        } else {
          const nextTagSymbol =
            tagSymbol === undefined || tagSymbol === null
              ? currentUser?.tagSymbol || PROFILE_TAG_SYMBOLS[0]
              : tagSymbol;
          const nextTagColor =
            tagColor === undefined || tagColor === null
              ? currentUser?.tagColor || PROFILE_TAG_COLORS[0]
              : tagColor;

          if (!isProfileTagSymbol(nextTagSymbol)) {
            return res.status(400).json({ message: "Choose a valid profile tag symbol" });
          }
          if (!isProfileTagColor(nextTagColor)) {
            return res.status(400).json({ message: "Choose a valid profile tag color" });
          }

          update.tagSymbol = nextTagSymbol;
          update.tagText = nextTagText;
          update.tagColor = nextTagColor;
        }
      }
      // Always ensure at least one field
      if (Object.keys(update).length === 0) return res.json({ success: true });
      await db.update(users).set(update).where(eq(users.id, req.session.userId!));
      const [updated] = await db.select().from(users).where(eq(users.id, req.session.userId!));
      const { serialKey: _sk, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      console.error('Profile update error:', err);
      res.status(500).json({ message: err?.message || 'Update failed' });
    }
  });

  app.get(api.chat.users.path, requireAuth, async (req, res) => {
    const usersList = await storage.getAllUsers();
    res.json(usersList);
  });

  // === FRIENDS & BLOCKS ===
  app.get("/api/social/relationship/:id", requireAuth, async (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId === req.session.userId) {
      return res.status(400).json({ message: "Invalid user" });
    }
    const [request] = await db.select().from(friendRequests).where(or(
      and(eq(friendRequests.requesterId, req.session.userId!), eq(friendRequests.addresseeId, targetId)),
      and(eq(friendRequests.requesterId, targetId), eq(friendRequests.addresseeId, req.session.userId!)),
    )).orderBy(desc(friendRequests.id)).limit(1);
    const [myBlock] = await db.select({ id: blocks.id }).from(blocks)
      .where(and(eq(blocks.blockerId, req.session.userId!), eq(blocks.blockedId, targetId))).limit(1);
    const [theirBlock] = await db.select({ id: blocks.id }).from(blocks)
      .where(and(eq(blocks.blockerId, targetId), eq(blocks.blockedId, req.session.userId!))).limit(1);
    const blockedByMe = !!myBlock;
    const blockedMe = !!theirBlock;
    let friendStatus = "none";
    if (request?.status === "accepted") friendStatus = "accepted";
    else if (request?.status === "pending") {
      friendStatus = request.requesterId === req.session.userId ? "pending_sent" : "pending_received";
    }
    res.json({ friendStatus, friendRequestId: request?.id ?? null, blockedByMe, blockedMe });
  });

  app.get("/api/social/friends", requireAuth, async (req, res) => {
    const rows = await db.select().from(friendRequests).where(or(
      and(eq(friendRequests.requesterId, req.session.userId!), eq(friendRequests.status, "accepted")),
      and(eq(friendRequests.addresseeId, req.session.userId!), eq(friendRequests.status, "accepted")),
    )).orderBy(desc(friendRequests.createdAt));
    const friendIds = rows.map(row => row.requesterId === req.session.userId ? row.addresseeId : row.requesterId);
    const friendUsers = friendIds.length
      ? await db.select({
          id: users.id, username: users.username, displayName: users.displayName,
          nickname: users.nickname, avatarUrl: users.avatarUrl, presenceStatus: users.presenceStatus,
          pronouns: users.pronouns,
        }).from(users).where(sql`${users.id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    res.json(friendUsers);
  });

  app.post("/api/social/friends/:id", requireAuth, async (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId === req.session.userId) {
      return res.status(400).json({ message: "Invalid user" });
    }
    if (await blockedEitherWay(req.session.userId!, targetId)) {
      return res.status(403).json({ message: "Unblock this user before sending a request" });
    }
    const [existing] = await db.select().from(friendRequests).where(or(
      and(eq(friendRequests.requesterId, req.session.userId!), eq(friendRequests.addresseeId, targetId)),
      and(eq(friendRequests.requesterId, targetId), eq(friendRequests.addresseeId, req.session.userId!)),
    )).orderBy(desc(friendRequests.id)).limit(1);
    if (existing?.status === "accepted") return res.json(existing);
    if (existing?.status === "pending") return res.json(existing);
    const [request] = await db.insert(friendRequests).values({
      requesterId: req.session.userId!, addresseeId: targetId, status: "pending",
    }).returning();
    res.status(201).json(request);
  });

  app.patch("/api/social/friends/:requestId", requireAuth, async (req, res) => {
    const requestId = Number(req.params.requestId);
    const status = req.body?.status;
    if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const [request] = await db.select().from(friendRequests)
      .where(and(eq(friendRequests.id, requestId), eq(friendRequests.addresseeId, req.session.userId!), eq(friendRequests.status, "pending")));
    if (!request) return res.status(404).json({ message: "Friend request not found" });
    const [updated] = await db.update(friendRequests).set({ status }).where(eq(friendRequests.id, requestId)).returning();
    res.json(updated);
  });

  app.delete("/api/social/friends/:id", requireAuth, async (req, res) => {
    const targetId = Number(req.params.id);
    await db.delete(friendRequests).where(and(
      or(
        and(eq(friendRequests.requesterId, req.session.userId!), eq(friendRequests.addresseeId, targetId)),
        and(eq(friendRequests.requesterId, targetId), eq(friendRequests.addresseeId, req.session.userId!)),
      ),
      eq(friendRequests.status, "accepted"),
    ));
    res.status(204).send();
  });

  app.get("/api/social/blocks", requireAuth, async (req, res) => {
    const rows = await db.select({
      id: blocks.id, userId: users.id, username: users.username,
      displayName: users.displayName, avatarUrl: users.avatarUrl,
    }).from(blocks).innerJoin(users, eq(blocks.blockedId, users.id))
      .where(eq(blocks.blockerId, req.session.userId!)).orderBy(desc(blocks.createdAt));
    res.json(rows);
  });

  app.post("/api/social/blocks/:id", requireAuth, async (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId === req.session.userId) return res.status(400).json({ message: "Invalid user" });
    await db.insert(blocks).values({ blockerId: req.session.userId!, blockedId: targetId }).onConflictDoNothing();
    await db.delete(friendRequests).where(or(
      and(eq(friendRequests.requesterId, req.session.userId!), eq(friendRequests.addresseeId, targetId)),
      and(eq(friendRequests.requesterId, targetId), eq(friendRequests.addresseeId, req.session.userId!)),
    ));
    res.status(201).json({ success: true });
  });

  app.delete("/api/social/blocks/:id", requireAuth, async (req, res) => {
    await db.delete(blocks).where(and(eq(blocks.blockerId, req.session.userId!), eq(blocks.blockedId, Number(req.params.id))));
    res.status(204).send();
  });

  // === SHOP ===
  app.get("/api/shop/items", requireAuth, async (req, res) => {
    const items = await storage.getShopItems();
    res.json(items);
  });

  app.post("/api/shop/buy", requireAuth, async (req, res) => {
    const { itemId } = req.body;
    try {
      await storage.buyItem(req.session.userId!, itemId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/shop/inventory", requireAuth, async (req, res) => {
    const inventory = await storage.getUserInventory(req.session.userId!);
    res.json(inventory);
  });

  app.post("/api/shop/equip", requireAuth, async (req, res) => {
    const { decorationId, nameStyleId } = req.body;
    await storage.updateUserDecoration(req.session.userId!, decorationId, nameStyleId);
    res.json({ success: true });
  });

  app.post("/api/admin/shop_items", requireOwner, async (req, res) => {
    const item = await storage.createShopItem(req.body);
    res.status(201).json(item);
  });

  // === VOICE CALL SIGNALING (ENHANCED) ===
  const signals = new Map<number, any[]>();
  const activeCalls = new Map<string, Set<number>>(); // key: targetId (user or group), value: set of userIds

  app.post(api.chat.voice.offer.path, requireAuth, (req, res) => {
    const { recipientId, offer, isGroup } = req.body;
    const s = signals.get(recipientId) || [];
    s.push({ type: 'offer', from: req.session.userId, offer, isGroup });
    signals.set(recipientId, s);
    res.json({ success: true });
  });

  app.get('/api/chat/voice/active', requireAuth, (req, res) => {
    const { id, isGroup } = req.query;
    const key = `${isGroup ? 'g' : 'u'}${id}`;
    const participants = activeCalls.get(key) || new Set();
    res.json(Array.from(participants));
  });

  app.post('/api/chat/voice/join', requireAuth, (req, res) => {
    const { id, isGroup } = req.body;
    const key = `${isGroup ? 'g' : 'u'}${id}`;
    const participants = activeCalls.get(key) || new Set();
    participants.add(req.session.userId!);
    activeCalls.set(key, participants);
    res.json({ success: true });
  });

  app.post('/api/chat/voice/leave', requireAuth, (req, res) => {
    const { id, isGroup } = req.body;
    const key = `${isGroup ? 'g' : 'u'}${id}`;
    const participants = activeCalls.get(key);
    if (participants) {
      participants.delete(req.session.userId!);
      if (participants.size === 0) activeCalls.delete(key);
    }
    res.json({ success: true });
  });

  app.post(api.chat.voice.answer.path, requireAuth, (req, res) => {
    const { recipientId, answer } = api.chat.voice.answer.input.parse(req.body);
    const s = signals.get(recipientId) || [];
    s.push({ type: 'answer', from: req.session.userId, answer });
    signals.set(recipientId, s);
    res.json({ success: true });
  });

  app.post(api.chat.voice.ice.path, requireAuth, (req, res) => {
    const { recipientId, candidate } = api.chat.voice.ice.input.parse(req.body);
    const s = signals.get(recipientId) || [];
    s.push({ type: 'ice', from: req.session.userId, candidate });
    signals.set(recipientId, s);
    res.json({ success: true });
  });

  app.post('/api/chat/voice/decline', requireAuth, (req, res) => {
    const { recipientId } = req.body;
    const s = signals.get(recipientId) || [];
    s.push({ type: 'decline', from: req.session.userId });
    signals.set(recipientId, s);
    res.json({ success: true });
  });

  app.get('/api/chat/voice/poll', requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const s = signals.get(userId) || [];
    signals.set(userId, []); // Clear after polling
    res.json(s);
  });

  // === SERVER-RELAY VOICE CALL SYSTEM ===
  interface CallSession { callerId: number; calleeId: number; }
  interface AudioChunk { senderId: number; dataUrl: string; mimeType: string; idx: number; }
  const callSessions = new Map<string, CallSession>();
  const callAudio = new Map<string, AudioChunk[]>();

  app.post('/api/chat/voice/start', requireAuth, async (req, res) => {
    const { calleeId } = req.body;
    const callerId = req.session.userId!;
    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    callSessions.set(callId, { callerId, calleeId });
    callAudio.set(callId, []);
    const caller = await storage.getUser(callerId);
    const callerName = caller?.username || `User_${callerId}`;
    const s = signals.get(calleeId) || [];
    s.push({ type: 'incoming', callId, fromId: callerId, fromName: callerName });
    signals.set(calleeId, s);
    res.json({ callId });
  });

  app.post('/api/chat/voice/accept', requireAuth, (req, res) => {
    const { callId } = req.body;
    const session = callSessions.get(callId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const s = signals.get(session.callerId) || [];
    s.push({ type: 'accepted', callId });
    signals.set(session.callerId, s);
    res.json({ success: true });
  });

  app.post('/api/chat/voice/end', requireAuth, (req, res) => {
    const { callId } = req.body;
    const session = callSessions.get(callId);
    if (session) {
      const otherId = session.callerId === req.session.userId! ? session.calleeId : session.callerId;
      const s = signals.get(otherId) || [];
      s.push({ type: 'ended' });
      signals.set(otherId, s);
      callSessions.delete(callId);
      callAudio.delete(callId);
    }
    res.json({ success: true });
  });

  app.post('/api/chat/voice/audio', requireAuth, (req, res) => {
    const { callId, dataUrl, mimeType } = req.body;
    const chunks = callAudio.get(callId);
    if (!chunks) return res.json({ success: false });
    const senderChunks = chunks.filter((c: AudioChunk) => c.senderId === req.session.userId!);
    const idx = senderChunks.length;
    chunks.push({ senderId: req.session.userId!, dataUrl, mimeType, idx });
    // Keep only last 40 chunks to prevent memory bloat
    if (chunks.length > 40) chunks.splice(0, chunks.length - 40);
    res.json({ success: true, idx });
  });

  app.get('/api/chat/voice/audio', requireAuth, (req, res) => {
    const callId = req.query.callId as string;
    const after = parseInt((req.query.after as string) ?? '-1');
    const userId = req.session.userId!;
    const chunks = callAudio.get(callId) || [];
    const newChunks = chunks.filter((c: AudioChunk) => c.senderId !== userId && c.idx > after);
    res.json(newChunks);
  });

  // === ACCESS REQUESTS (public - no auth required) ===
  app.post('/api/access-requests', async (req, res) => {
    try {
      const { name, message } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return res.status(400).json({ message: 'Name is required' });
      }
      if (!message || typeof message !== 'string' || message.trim().length < 5) {
        return res.status(400).json({ message: 'Message is required (min 5 characters)' });
      }
      const request = await storage.createAccessRequest({ name: name.trim(), message: message.trim() });
      res.status(201).json(request);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Failed' });
    }
  });

  app.get('/api/admin/requests', requireOwner, async (req, res) => {
    const requests = await storage.listAccessRequests();
    res.json(requests);
  });

  app.patch('/api/admin/requests/:id', requireOwner, async (req, res) => {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    await storage.updateAccessRequestStatus(Number(req.params.id), status);
    res.json({ success: true });
  });

  // === CUSTOM EMOJIS ===
  app.get('/api/emojis', requireAuth, async (req, res) => {
    const emojis = await storage.listCustomEmojis();
    res.json(emojis);
  });

  app.post('/api/admin/emojis', requireOwner, async (req, res) => {
    try {
      const { name, url } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return res.status(400).json({ message: 'Name is required' });
      }
      if (!url || typeof url !== 'string' || !url.startsWith('data:image/')) {
        return res.status(400).json({ message: 'A valid image URL is required' });
      }
      const emoji = await storage.createCustomEmoji({ name: name.trim().toLowerCase().replace(/\s+/g, '_'), url, createdBy: req.session.userId! });
      res.status(201).json(emoji);
    } catch (err: any) {
      if (err?.message?.includes('unique')) return res.status(409).json({ message: 'Emoji name already exists' });
      res.status(500).json({ message: err?.message || 'Failed' });
    }
  });

  app.delete('/api/admin/emojis/:id', requireOwner, async (req, res) => {
    await storage.deleteCustomEmoji(Number(req.params.id));
    res.status(204).send();
  });

  // === PROXY ===
  app.get(api.proxy.fetch.path, requireAuth, async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) return res.status(400).send("Missing URL");

      // Validate URL
      let parsed: URL;
      try { parsed = new URL(targetUrl); } catch { return res.status(400).send("Invalid URL"); }

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
      });

      const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';

      // Strip headers that prevent iframe embedding
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.set({
        'Content-Type': contentType,
        'X-Frame-Options': 'ALLOWALL',
        'Access-Control-Allow-Origin': '*',
      });

      if (contentType.includes('text/html')) {
        let html = await response.text();
        const base = parsed.origin;

        // Remove meta/http-equiv that set X-Frame-Options or CSP
        html = html.replace(/<meta[^>]+http-equiv=["']?x-frame-options["']?[^>]*>/gi, '');
        html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');

        // Inject base tag so relative URLs resolve correctly
        if (!html.match(/<base\s/i)) {
          if (html.match(/<head[^>]*>/i)) {
            html = html.replace(/(<head[^>]*>)/i, `$1<base href="${targetUrl}">`);
          } else {
            html = `<base href="${targetUrl}">` + html;
          }
        }

        // Inject small script to allow links to navigate within the proxy iframe
        const proxyScript = `<script>
(function(){
  document.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(a&&a.href&&!a.href.startsWith('javascript')){
      e.preventDefault();
      var abs=new URL(a.href,document.baseURI).href;
      window.location.href='/api/proxy?url='+encodeURIComponent(abs);
    }
  },true);
  var f=document.createElement('base');f.target='_self';
})();
</script>`;
        html = html.replace('</head>', proxyScript + '</head>');

        res.send(html);
      } else {
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      }

      // Log history asynchronously
      storage.createHistory({
        userId: req.session.userId!,
        url: targetUrl,
        query: "Proxy Visit"
      }).catch(console.error);

    } catch (err: any) {
      console.error("Proxy error:", err);
      res.status(502).send(`<!DOCTYPE html><html><body style="background:#111;color:#0f0;font-family:monospace;padding:30px">
        <h2 style="color:#f55">[PROXY_ERROR]</h2>
        <p><b>TARGET:</b> ${req.query.url}</p>
        <p><b>REASON:</b> ${err.message || 'Connection refused or timeout'}</p>
        <p style="color:#888">Some sites (Roblox, Google, etc.) block server-side requests with Cloudflare protection. Try: wikipedia.org, github.com, reddit.com</p>
      </body></html>`);
    }
  });

  return httpServer;
}
