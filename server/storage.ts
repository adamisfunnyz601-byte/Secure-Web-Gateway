
import { db } from "./db";
import { users, accessKeys, searchHistory, messages, groupChats, groupChatMembers, shopItems, userInventory, accessRequests, customEmojis,
  type User, type AccessKey, type HistoryItem, type Message,
  type CreateKeyRequest, type CreateHistoryRequest, type CreateMessageRequest
} from "@shared/schema";
import { eq, desc, and, or, gt, sql } from "drizzle-orm";

export interface IStorage {
  // User & Auth
  getUser(id: number): Promise<User | undefined>;
  getUserBySerial(serialKey: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: { username: string; serialKey: string; role: string; expiresAt?: Date }): Promise<User>;
  
  // Keys
  createAccessKey(key: { key: string; type: string; durationMinutes?: number; createdBy: number }): Promise<AccessKey>;
  getAccessKey(key: string): Promise<AccessKey | undefined>;
  listAccessKeys(): Promise<AccessKey[]>;
  deleteAccessKey(id: number): Promise<void>;
  markKeyAsUsed(id: number): Promise<void>;

  // History
  getHistory(userId: number): Promise<HistoryItem[]>;
  createHistory(item: { userId: number; url: string; query?: string }): Promise<HistoryItem>;
  clearHistory(userId: number): Promise<void>;

  // Chat
  getMessages(currentUserId: number, recipientId?: number, groupId?: number): Promise<(Message & { senderName: string })[]>;
  getPublicMessages(): Promise<(Message & { senderName: string })[]>;
  createMessage(msg: { senderId: number; recipientId?: number | null; groupId?: number | null; content: string }): Promise<Message>;
  getAllUsers(): Promise<any[]>;

  // Shop & Decorations
  getShopItems(): Promise<any[]>;
  createShopItem(item: any): Promise<any>;
  buyItem(userId: number, itemId: number): Promise<void>;
  getUserInventory(userId: number): Promise<any[]>;
  updateUserDecoration(userId: number, decorationId: number | null, nameStyleId: number | null): Promise<void>;

  // Groups
  createGroup(data: { name: string; inviteCode: string; ownerId: number }): Promise<any>;
  joinGroup(userId: number, groupId: number): Promise<void>;
  getGroupByCode(code: string): Promise<any>;
  getUserGroups(userId: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User & Auth
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserBySerial(serialKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.serialKey, serialKey));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`)
      .limit(1);
    return user;
  }

  async createUser(insertUser: { username: string; serialKey: string; role: string; expiresAt?: Date }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Keys
  async createAccessKey(data: { key: string; type: string; durationMinutes?: number; createdBy: number }): Promise<AccessKey> {
    const [key] = await db.insert(accessKeys).values(data).returning();
    return key;
  }

  async getAccessKey(key: string): Promise<AccessKey | undefined> {
    const [accessKey] = await db.select().from(accessKeys).where(eq(accessKeys.key, key));
    return accessKey;
  }

  async listAccessKeys(): Promise<AccessKey[]> {
    return await db.select().from(accessKeys).orderBy(desc(accessKeys.createdAt));
  }

  async deleteAccessKey(id: number): Promise<void> {
    await db.delete(accessKeys).where(eq(accessKeys.id, id));
  }
  
  async markKeyAsUsed(id: number): Promise<void> {
    await db.update(accessKeys).set({ isUsed: true }).where(eq(accessKeys.id, id));
  }

  // History
  async getHistory(userId: number): Promise<HistoryItem[]> {
    return await db.select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.visitedAt))
      .limit(50);
  }

  async createHistory(item: { userId: number; url: string; query?: string }): Promise<HistoryItem> {
    const [entry] = await db.insert(searchHistory).values(item).returning();
    return entry;
  }

  async clearHistory(userId: number): Promise<void> {
    await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
  }

  // Chat - Return only the active channel's recent messages.
  // Keeping this scoped prevents every poll from downloading all group/DM history
  // (including potentially very large base64 media payloads).
  async getMessages(currentUserId: number, recipientId?: number, groupId?: number): Promise<any[]> {
    const channelFilter = groupId
      ? and(
          eq(messages.groupId, groupId),
          sql`EXISTS (
            SELECT 1 FROM group_chat_members
            WHERE group_chat_members.group_id = ${groupId}
              AND group_chat_members.user_id = ${currentUserId}
          )`,
        )
      : recipientId
        ? and(
            sql`${messages.groupId} IS NULL`,
            or(
              and(eq(messages.senderId, currentUserId), eq(messages.recipientId, recipientId)),
              and(eq(messages.senderId, recipientId), eq(messages.recipientId, currentUserId)),
            ),
          )
        : sql`${messages.recipientId} IS NULL AND ${messages.groupId} IS NULL`;
    const visibleFilter = and(
      channelFilter,
      sql`NOT EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocks.blocker_id = ${currentUserId} AND blocks.blocked_id = ${messages.senderId})
           OR (blocks.blocker_id = ${messages.senderId} AND blocks.blocked_id = ${currentUserId})
      )`,
    );

    return await db.select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      groupId: messages.groupId,
      content: messages.content,
      // Attachments are intentionally lazy-loaded via /api/chat/messages/:id/media.
      // Returning base64 blobs here made a normal chat open tens of megabytes.
      mediaUrl: sql<string | null>`NULL`,
      mediaType: messages.mediaType,
      hasMedia: sql<boolean>`(${messages.mediaUrl} IS NOT NULL)`,
      replyToId: messages.replyToId,
      createdAt: messages.createdAt,
      senderName: users.username,
      senderDisplayName: users.displayName,
      senderNickname: users.nickname,
      senderPronouns: users.pronouns,
      senderPresenceStatus: users.presenceStatus,
      senderUsernameFont: users.usernameFont,
      senderTagSymbol: users.tagSymbol,
      senderTagText: users.tagText,
      senderTagColor: users.tagColor,
      replyToContent: sql<string>`(SELECT content FROM messages WHERE id = ${messages.replyToId})`,
      replyToSenderName: sql<string>`(SELECT u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ${messages.replyToId})`,
    } as any)
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(visibleFilter)
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(100);
  }

  async getPublicMessages(): Promise<any[]> {
    return await db.select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      groupId: messages.groupId,
      content: messages.content,
      mediaUrl: messages.mediaUrl,
      mediaType: messages.mediaType,
      createdAt: messages.createdAt,
      senderName: users.username,
      senderTagSymbol: users.tagSymbol,
      senderTagText: users.tagText,
      senderTagColor: users.tagColor,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(sql`${messages.recipientId} IS NULL AND ${messages.groupId} IS NULL`)
    .orderBy(messages.createdAt);
  }

  async createMessage(msg: { senderId: number; recipientId?: number | null; groupId?: number | null; content: string; mediaUrl?: string | null; mediaType?: string | null; replyToId?: number | null }): Promise<Message> {
    const [message] = await db.insert(messages).values(msg).returning();
    return message;
  }

  async getAllUsers(): Promise<any[]> {
    // Never send serial keys or other private/account fields to the chat client.
    return await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      nickname: users.nickname,
      pronouns: users.pronouns,
      avatarUrl: users.avatarUrl,
      usernameFont: users.usernameFont,
      tagSymbol: users.tagSymbol,
      tagText: users.tagText,
      tagColor: users.tagColor,
      role: users.role,
      presenceStatus: users.presenceStatus,
      lastSeen: users.lastSeen,
    }).from(users).orderBy(users.username);
  }

  // Shop & Decorations implementation
  async getShopItems(): Promise<any[]> {
    return await db.select().from(shopItems);
  }

  async createShopItem(item: any): Promise<any> {
    const [newItem] = await db.insert(shopItems).values(item).returning();
    return newItem;
  }

  async buyItem(userId: number, itemId: number): Promise<void> {
    const [item] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!item || !user) throw new Error("Item or User not found");
    if (user.coins < item.price) throw new Error("Insufficient coins");

    await db.transaction(async (tx) => {
      await tx.update(users).set({ coins: user.coins - item.price }).where(eq(users.id, userId));
      await tx.insert(userInventory).values({ userId, itemId });
    });
  }

  async getUserInventory(userId: number): Promise<any[]> {
    return await db.select({
      id: shopItems.id,
      name: shopItems.name,
      type: shopItems.type,
      imageUrl: shopItems.imageUrl,
      cssStyles: shopItems.cssStyles,
    })
    .from(userInventory)
    .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
    .where(eq(userInventory.userId, userId));
  }

  async updateUserDecoration(userId: number, decorationId: number | null, nameStyleId: number | null): Promise<void> {
    await db.update(users)
      .set({ decorationId, nameStyleId })
      .where(eq(users.id, userId));
  }

  // Access Requests
  async createAccessRequest(data: { name: string; message: string; passwordHash: string }): Promise<any> {
    const [req] = await db.insert(accessRequests).values(data).returning();
    return req;
  }

  async listAccessRequests(): Promise<any[]> {
    return await db.select({
      id: accessRequests.id,
      name: accessRequests.name,
      message: accessRequests.message,
      status: accessRequests.status,
      createdAt: accessRequests.createdAt,
      hasPassword: sql<boolean>`${accessRequests.passwordHash} IS NOT NULL`,
    }).from(accessRequests).orderBy(desc(accessRequests.createdAt));
  }

  async updateAccessRequestStatus(id: number, status: string): Promise<void> {
    await db.update(accessRequests).set({ status }).where(eq(accessRequests.id, id));
  }

  // Custom Emojis
  async createCustomEmoji(data: { name: string; url: string; createdBy: number }): Promise<any> {
    const [emoji] = await db.insert(customEmojis).values(data).returning();
    return emoji;
  }

  async listCustomEmojis(): Promise<any[]> {
    return await db.select().from(customEmojis).orderBy(customEmojis.name);
  }

  async deleteCustomEmoji(id: number): Promise<void> {
    await db.delete(customEmojis).where(eq(customEmojis.id, id));
  }

  // Groups
  async createGroup(data: { name: string; inviteCode: string; ownerId: number }): Promise<any> {
    const [group] = await db.insert(groupChats).values(data).returning();
    // Add owner as member
    await db.insert(groupChatMembers).values({
      groupId: group.id,
      userId: data.ownerId
    });
    
    // Create system message with invite code
    await this.createMessage({
      senderId: data.ownerId,
      groupId: group.id,
      content: `[SYSTEM] Group Chat initialized. SECURE_INVITE_CODE: ${data.inviteCode}`
    });
    
    return group;
  }

  async joinGroup(userId: number, groupId: number): Promise<void> {
    // Check if already a member
    const [existing] = await db.select().from(groupChatMembers).where(
      and(eq(groupChatMembers.groupId, groupId), eq(groupChatMembers.userId, userId))
    );
    if (!existing) {
      await db.insert(groupChatMembers).values({ groupId, userId });
    }
  }

  async getGroupByCode(code: string): Promise<any> {
    const [group] = await db.select().from(groupChats).where(eq(groupChats.inviteCode, code));
    return group;
  }

  async getUserGroups(userId: number): Promise<any[]> {
    return await db.select({
      id: groupChats.id,
      name: groupChats.name,
      inviteCode: groupChats.inviteCode,
      ownerId: groupChats.ownerId
    })
    .from(groupChats)
    .innerJoin(groupChatMembers, eq(groupChatMembers.groupId, groupChats.id))
    .where(eq(groupChatMembers.userId, userId));
  }
}

export const storage = new DatabaseStorage();
