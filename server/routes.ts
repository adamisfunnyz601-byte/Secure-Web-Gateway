
import { db } from "./db";
import { users, accessKeys, searchHistory, messages, groupChats, groupChatMembers, customEmojis, friendRequests, blocks, oauthAccounts, moderationLogs, blockBlastScores, dihhroAwards } from "@shared/schema";
import { eq, desc, and, or, gt, sql } from "drizzle-orm";
import type { Express, Request, RequestHandler } from "express";
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
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";

const hashAccountPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
};
const verifyAccountPassword = (password: string, stored: string) => {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, "hex"));
};
type OAuthProvider = "google" | "microsoft";

declare module "express-session" {
  interface SessionData {
    oauthFlow?: {
      provider: OAuthProvider;
      state: string;
      nonce: string;
      codeVerifier: string;
      redirectUri: string;
      returnTo: string;
    };
  }
}

const MemoryStore = createMemoryStore(session);
const OWNER_KEY = "TSHSKDB163)#(";
const PRESENCE_STATUSES = ["online", "idle", "dnd", "offline"] as const;
type ProfileImageKind = "avatar" | "banner";
type ProfileImageVariant = "thumbnail" | "full";
const PROFILE_IMAGE_DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]+={0,2})$/i;
const PROFILE_THUMBNAIL_CACHE_LIMIT = 32;
const profileThumbnailCache = new Map<string, Buffer>();
const profileThumbnailJobs = new Map<string, Promise<Buffer>>();
const oauthConfigCache = new Map<OAuthProvider, Promise<import("openid-client").Configuration>>();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Try again in a few minutes." },
});

const oauthStartRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Try again in a few minutes." },
});

const accessRequestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many access requests. Try again later." },
});

function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "microsoft";
}

function isOAuthProviderConfigured(provider: OAuthProvider) {
  const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
  return Boolean(process.env[`${prefix}_CLIENT_ID`] && process.env[`${prefix}_CLIENT_SECRET`]);
}

function getOAuthConfig(provider: OAuthProvider) {
  const existing = oauthConfigCache.get(provider);
  if (existing) return existing;

  const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`${provider} sign-in is not configured`);
  }

  const issuer = provider === "google"
    ? "https://accounts.google.com"
    : "https://login.microsoftonline.com/common/v2.0";
  const discovery = import("openid-client").then(({ discovery }) =>
    discovery(new URL(issuer), clientId, clientSecret),
  );
  oauthConfigCache.set(provider, discovery);
  discovery.catch(() => oauthConfigCache.delete(provider));
  return discovery;
}

function getOAuthRedirectUri(provider: OAuthProvider) {
  let baseUrl = process.env.OAUTH_REDIRECT_BASE_URL;
  if (!baseUrl && process.env.NODE_ENV !== "production") {
    const devDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0];
    if (devDomain) baseUrl = devDomain.startsWith("http") ? devDomain : `https://${devDomain}`;
  }
  if (!baseUrl && process.env.NODE_ENV !== "production") {
    baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  }
  if (!baseUrl) {
    throw new Error("OAUTH_REDIRECT_BASE_URL must be set for production sign-in");
  }

  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("Production OAuth redirect URL must use HTTPS");
  }
  return new URL(`/api/auth/oauth/${provider}/callback`, parsed.origin).toString();
}

function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}

function regenerateSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
}

function turnstileGuard(): RequestHandler {
  return async (req, res, next) => {
    const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

    if (!secret) {
      return res.status(503).json({
        message: "Cloudflare Turnstile secret is missing. Add CLOUDFLARE_TURNSTILE_SECRET_KEY to Replit Secrets."
      });
    }

    const token = req.body?.turnstileToken;
    if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return res.status(400).json({
        message: "Complete the Cloudflare verification first."
      });
    }

    try {
      const form = new URLSearchParams({
        secret,
        response: token
      });

      if (req.ip) form.set("remoteip", req.ip);

      const verificationResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form
        }
      );

      if (!verificationResponse.ok) {
        return res.status(503).json({
          message: "Cloudflare verification is temporarily unavailable. Try again."
        });
      }

      const result = await verificationResponse.json() as {
        success?: boolean;
        hostname?: string;
        "error-codes"?: string[];
      };

      const requestHost = req.hostname.toLowerCase();
      const verifiedHost = result.hostname?.toLowerCase();

      if (result.success !== true) {
        console.warn("Turnstile verification rejected:", result["error-codes"] || []);
        return res.status(403).json({
          message: "Cloudflare verification failed or expired. Please complete it again."
        });
      }

      if (verifiedHost && verifiedHost !== requestHost) {
        console.warn("Turnstile hostname mismatch:", { verifiedHost, requestHost });
        return res.status(403).json({
          message: "Cloudflare hostname mismatch. Check the hostname in your Turnstile widget."
        });
      }

      return next();
    } catch (error) {
      console.error("Turnstile Siteverify request failed:", error);
      return res.status(503).json({
        message: "Could not contact Cloudflare verification. Try again."
      });
    }
  };
}

function profileImageUrl(
  userId: number,
  kind: ProfileImageKind,
  value: unknown,
  variant: ProfileImageVariant = "thumbnail",
): unknown {
  if (typeof value !== "string") return value ?? null;
  const match = PROFILE_IMAGE_DATA_URL.exec(value);
  if (!match) return value;
  const version = createHash("sha256").update(value).digest("hex").slice(0, 24);
  return `/api/profile-images/${userId}/${kind}/${variant}/${version}`;
}

function isProfileImageProxyUrl(value: unknown, userId: number, kind: ProfileImageKind): boolean {
  return typeof value === "string"
    && new RegExp(`^/api/profile-images/${userId}/${kind}/(?:thumbnail|full)/[a-f0-9]{24}$`).test(value);
}

async function getProfileThumbnail(
  cacheKey: string,
  source: Buffer,
  kind: ProfileImageKind,
): Promise<Buffer> {
  const cached = profileThumbnailCache.get(cacheKey);
  if (cached) {
    profileThumbnailCache.delete(cacheKey);
    profileThumbnailCache.set(cacheKey, cached);
    return cached;
  }

  const pending = profileThumbnailJobs.get(cacheKey);
  if (pending) return pending;

  const job = sharp(source, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(kind === "avatar"
      ? { width: 256, height: 256, fit: "cover", withoutEnlargement: true }
      : { width: 1280, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: kind === "avatar" ? 48 : 54, effort: 3 })
    .toBuffer();
  profileThumbnailJobs.set(cacheKey, job);

  try {
    const thumbnail = await job;
    profileThumbnailCache.set(cacheKey, thumbnail);
    while (profileThumbnailCache.size > PROFILE_THUMBNAIL_CACHE_LIMIT) {
      const oldestKey = profileThumbnailCache.keys().next().value;
      if (oldestKey === undefined) break;
      profileThumbnailCache.delete(oldestKey);
    }
    return thumbnail;
  } finally {
    profileThumbnailJobs.delete(cacheKey);
  }
}

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
  const requireAdmin = async (req: Request, res: any, next: any) => {
    if (!req.session.userId) return res.status(401).json({ message: "Login required." });
    const actor = await storage.getUser(req.session.userId);
    if (!actor || !["owner","admin"].includes(String(actor.role).toLowerCase())) return res.status(403).json({ message: "Owner or Admin access required." });
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
    const { serialKey: _serialKey, passwordHash: _passwordHash, ...safe } = user;
    return {
      ...safe,
      avatarUrl: profileImageUrl(safe.id, "avatar", safe.avatarUrl),
      bannerUrl: profileImageUrl(safe.id, "banner", safe.bannerUrl),
    };
  };

  app.get("/api/profile-images/:id/:kind/:variant/:version", requireAuth, async (req, res) => {
    const userId = Number(req.params.id);
    const kind = req.params.kind;
    const variant = req.params.variant;
    if (
      !Number.isInteger(userId)
      || userId <= 0
      || (kind !== "avatar" && kind !== "banner")
      || (variant !== "thumbnail" && variant !== "full")
    ) {
      return res.status(400).json({ message: "Invalid profile image" });
    }
    const imageColumn = kind === "avatar" ? users.avatarUrl : users.bannerUrl;
    const [row] = await db.select({ imageUrl: imageColumn }).from(users)
      .where(eq(users.id, userId)).limit(1);
    if (!row || typeof row.imageUrl !== "string" || row.imageUrl.length > 16 * 1024 * 1024) {
      return res.status(404).end();
    }
    const image = PROFILE_IMAGE_DATA_URL.exec(row.imageUrl);
    if (!image) return res.status(404).end();
    const currentVersion = createHash("sha256").update(row.imageUrl).digest("hex").slice(0, 24);
    if (req.params.version !== currentVersion) return res.status(404).end();

    const originalBytes = Buffer.from(image[2], "base64");
    if (originalBytes.length > 12 * 1024 * 1024) return res.status(413).end();
    let imageBytes = originalBytes;
    let contentType = image[1];
    if (variant === "thumbnail") {
      try {
        imageBytes = await getProfileThumbnail(`${userId}:${kind}:${currentVersion}`, originalBytes, kind);
        contentType = "image/webp";
      } catch (error) {
        console.error("Profile thumbnail processing failed:", error);
        return res.status(415).end();
      }
    }
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", imageBytes.length);
    return res.send(imageBytes);
  });

  // === AUTH ===
  app.post(api.auth.login.path, authRateLimit, turnstileGuard(), async (req, res) => {
    try {
      const { serialKey, username } = api.auth.login.input.parse(req.body);

      let user = await storage.getUserBySerial(serialKey);
      if (!user && username) {
        const [namedUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (namedUser?.passwordHash && verifyAccountPassword(serialKey, namedUser.passwordHash)) user = namedUser;
        else if (namedUser) return res.status(401).json({ message: "Incorrect username or password." });
      }

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
      const [activeBan] = await db.select().from(moderationLogs)
        .where(and(eq(moderationLogs.targetId, user.id), sql`${moderationLogs.action} IN ('ban','tempban','permban','softban','unban')`))
        .orderBy(desc(moderationLogs.createdAt)).limit(1);
      if (activeBan && activeBan.action !== "unban" && (!activeBan.expiresAt || activeBan.expiresAt > new Date())) {
        return res.status(403).json({ message: "This account is currently banned." });
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

  // Public invite-link validation. The key itself remains the credential used at signup.
  app.get("/api/invites/:key", async (req, res) => {
    try {
      const key = String(req.params.key || "").trim();
      if (!key || key.length > 128) return res.status(400).json({ valid: false, message: "Invalid invitation link." });
      const invite = await storage.getAccessKey(key);
      if (!invite) return res.status(404).json({ valid: false, message: "This invitation link is invalid or has been revoked." });
      if (invite.isUsed) return res.status(410).json({ valid: false, message: "This invitation has already been used or revoked and is no longer available." });
      return res.json({
        valid: true,
        type: invite.type,
        durationMinutes: invite.durationMinutes ?? null,
      });
    } catch (error) {
      console.error("Invite validation failed:", error);
      return res.status(500).json({ valid: false, message: "Could not verify this invitation right now." });
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

  // === SERVER-AUTHORITATIVE ROLE + MODERATION COMMANDS ===
  const roleRank: Record<string, number> = {
    owner: 100, admin: 90, "trial-admin": 80, moderator: 70,
    "trial-moderator": 60, helper: 40, "trial-helper": 30, user: 0,
  };
  const canonicalRole = (role: string) => role.toLowerCase().replace(/_/g, "-");
  const actorRole = async (id: number) => {
    const actor = await storage.getUser(id);
    return actor ? canonicalRole(actor.role) : "user";
  };
  const canModerate = (actor: string, target: string) =>
    actor === "owner" || (roleRank[actor] ?? 0) > (roleRank[target] ?? 0);
  const moderationCommandNames = [
    "ban","unban","kick","mute","unmute","timeout","untimeout","warn","warnings","clearwarnings",
    "softban","tempban","permban","shadowban","unshadowban","jail","unjail","deafen","undeafen",
    "freeze","unfreeze","slowmode","slowmodeoff","lock","unlock","lockdown","unlockdown",
    "purge","purgeuser","purgebots","clear","slowchat","unslowchat","note","notes","clearnotes",
    "strike","strikes","clearstrikes","report","reports","resolve","role","promote","demote",
    "nickreset","restrict","unrestrict","unkick"
  ];
  const memberCommandNames = [
    "help","me","shrug","roll","flip","avatar","profile","serverinfo","userinfo","ping",
    "whoami","rules","invite","coinflip","8ball","choose","quote","uptime"
  ];
  const parseDurationMs = (value: string) => {
    if (value === "null") return null;
    const match = value.match(/^([1-9]\d*)(m|min|mins|h|hr|hrs|d|day|days|w|wk|wks|mo|y)$/i);
    if (!match) return undefined;
    const n = Number(match[1]);
    const rawUnit = match[2].toLowerCase();
    const unit = rawUnit.startsWith("min") ? "m" : rawUnit.startsWith("hr") ? "h" : rawUnit.startsWith("day") ? "d" : rawUnit.startsWith("wk") ? "w" : rawUnit;
    return n * ({ m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000, y: 31536000000 } as Record<string, number>)[unit];
  };

  app.get("/api/moderation/users", requireAuth, async (req, res) => {
    const actor = await storage.getUser(req.session.userId!);
    const allowed = ["owner","admin","trial-admin","moderator","trial-moderator","helper","trial-helper"];
    if (!actor || !allowed.includes(canonicalRole(actor.role))) return res.status(403).json({ message: "Staff access required." });
    return res.json(await storage.getAllUsers());
  });

  app.get("/api/chat/commands", requireAuth, (_req, res) => {
    res.json({ moderation: moderationCommandNames, member: memberCommandNames });
  });

  app.patch("/api/admin/users/:id/role", requireAuth, async (req, res) => {
    const actorId = req.session.userId!;
    const actor = await storage.getUser(actorId);
    const targetId = Number(req.params.id);
    const target = await storage.getUser(targetId);
    const requestedRole = typeof req.body?.role === "string" ? canonicalRole(req.body.role) : "";
    if (!actor || !target) return res.status(404).json({ message: "User not found" });
    if (!["owner","admin","trial-admin","moderator","trial-moderator","helper","trial-helper","user"].includes(requestedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const aRole = canonicalRole(actor.role), tRole = canonicalRole(target.role);
    if (tRole === "owner" || requestedRole === "owner") return res.status(403).json({ message: "Owner role is immutable and protected." });
    if (aRole !== "owner" && aRole !== "admin") return res.status(403).json({ message: "Only Owner or Admin can assign roles." });
    if (aRole !== "owner" && (roleRank[tRole] ?? 0) >= (roleRank[aRole] ?? 0)) return res.status(403).json({ message: "You cannot change a peer or higher-ranked role." });
    if (aRole !== "owner" && (roleRank[requestedRole] ?? 0) >= (roleRank[aRole] ?? 0)) return res.status(403).json({ message: "You cannot assign a role equal to or above your own." });
    await db.update(users).set({ role: requestedRole }).where(eq(users.id, targetId));
    await db.insert(moderationLogs).values({ actorId, targetId, action: "role-change", reason: `Role changed from ${target.role} to ${requestedRole}`, metadata: { from: tRole, to: requestedRole } });
    res.json({ success: true, userId: targetId, role: requestedRole });
  });

  app.post("/api/chat/command", requireAuth, async (req, res) => {
    const actorId = req.session.userId!;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text.startsWith("/") || text.length > 500) return res.status(400).json({ message: "Invalid command." });
    const [rawName, ...args] = text.slice(1).split(/\s+/);
    const name = (rawName || "").toLowerCase();
    const actor = await storage.getUser(actorId);
    if (!actor) return res.status(401).json({ message: "Session user not found." });
    const aRole = canonicalRole(actor.role);
    const isModCommand = moderationCommandNames.includes(name);
    const helperCommands = ["warn","warnings","note","notes","report","reports"];
    const trialHelperCommands = ["note","report"];
    const staffAllowed = (roleRank[aRole] ?? 0) >= roleRank["trial-moderator"]
      || (aRole === "helper" && helperCommands.includes(name))
      || (aRole === "trial-helper" && trialHelperCommands.includes(name));
    if (isModCommand && !staffAllowed) return res.status(403).json({ message: "Your staff role does not have permission to use this command." });
    if (!isModCommand && !memberCommandNames.includes(name)) return res.status(400).json({ message: "Unknown command. Use /help." });

    if (!isModCommand) {
      if (name === "help") return res.json({ message: `Member commands: /${memberCommandNames.join(", /")}. Moderation commands require staff permissions.` });
      if (name === "ping") return res.json({ message: "Pong! API is responding." });
      if (name === "whoami") return res.json({ message: `You are ${actor.username} (${aRole}).` });
      if (name === "roll" || name === "coinflip" || name === "flip") {
        const sides = name === "roll" ? Math.min(100, Math.max(2, Number((args[0] || "d6").replace(/^d/i, "")) || 6)) : 2;
        return res.json({ message: name === "roll" ? `You rolled ${1 + Math.floor(Math.random()*sides)} (d${sides}).` : Math.random() < .5 ? "Heads!" : "Tails!" });
      }
      if (name === "me") return res.json({ message: args.join(" ").slice(0, 200) ? `* ${actor.username} ${args.join(" ").slice(0,200)}` : "Usage: /me <action>" });
      if (name === "shrug") return res.json({ message: "¯\\_(ツ)_/¯" });
      if (name === "8ball") return res.json({ message: ["Absolutely.","Probably.","Ask again later.","Unlikely.","No."][Math.floor(Math.random()*5)] });
      if (name === "choose") return res.json({ message: args.join(" ").split("|").map(x=>x.trim()).filter(Boolean).sort(()=>Math.random()-.5)[0] || "Usage: /choose option A | option B" });
      if (name === "rules") return res.json({ message: "Be respectful, do not harass others, and follow the community rules." });
      if (name === "serverinfo") return res.json({ message: "Secure Web Gateway community chat." });
      if (name === "userinfo" || name === "profile" || name === "avatar") {
        const target = await storage.getUser(Number(args[0])) || (args[0] ? await storage.getUserBySerial(args[0]) : actor);
        return res.json({ message: target ? `${target.username} · ${canonicalRole(target.role)}` : "User not found." });
      }
      return res.json({ message: `/${name} is recognised. This command does not change account data.` });
    }

    const needsTarget = !["slowmode","slowmodeoff","lock","unlock","lockdown","unlockdown","purge","clear","slowchat","unslowchat","reports","uptime"].includes(name);
    let targetId = Number(req.body?.targetUserId || args[0]?.replace(/^@/,""));
    let target = Number.isInteger(targetId) && targetId > 0 ? await storage.getUser(targetId) : undefined;
    if (!target && args[0]) {
      const all = await storage.getAllUsers();
      target = all.find((u:any) => u.username.toLowerCase() === args[0].replace(/^@/,"").toLowerCase());
      targetId = target?.id;
    }
    if (needsTarget && (!target || !targetId)) return res.status(400).json({ message: "Specify a valid target username or user ID." });
    if (target) {
      const tRole = canonicalRole(target.role);
      if (targetId === actorId) return res.status(400).json({ message: "You cannot moderate yourself." });
      if (tRole === "owner" || !canModerate(aRole,tRole)) return res.status(403).json({ message: "That member is protected by the role hierarchy." });
    }
    const durationToken = String(req.body?.duration || args[1] || "");
    const durationMs = ["ban","tempban","mute","timeout","jail","restrict","shadowban","softban"].includes(name) ? parseDurationMs(durationToken) : null;
    if (["ban","tempban","mute","timeout","jail","restrict","shadowban","softban"].includes(name) && durationMs === undefined) return res.status(400).json({ message: "Provide a duration such as 10m, 2h, 3d, 1w, 1mo, 1y or null." });
    if (name === "role" || name === "promote" || name === "demote") {
      if (!target) return res.status(400).json({ message: "Specify a target username." });
      const desired = canonicalRole(String(args[1] || req.body?.role || ""));
      if (!["admin","trial-admin","moderator","trial-moderator","helper","trial-helper","user"].includes(desired)) return res.status(400).json({ message: "Usage: /role @user admin|trial-admin|moderator|trial-moderator|helper|trial-helper|user" });
      if (aRole !== "owner" && (roleRank[desired] ?? 0) >= (roleRank[aRole] ?? 0)) return res.status(403).json({ message: "You cannot assign a role equal to or above your own." });
      await db.update(users).set({ role: desired }).where(eq(users.id, target.id));
      await db.insert(moderationLogs).values({ actorId, targetId: target.id, action: "role-change", reason: `Role set to ${desired}`, metadata: { to: desired } });
      return res.json({ message: `${target.username} is now ${desired}.` });
    }
    const reason = String(req.body?.reason || args.slice(2).join(" ") || "").slice(0,300);
    const action = name;
    await db.insert(moderationLogs).values({
      actorId, targetId: targetId || null, action, reason: reason || null,
      duration: durationToken || null,
      expiresAt: durationMs ? new Date(Date.now()+durationMs) : null,
      metadata: { command: name, actorRole: aRole },
    });
    if (name === "unkick") return res.json({ message: "Kicks are immediate, not timed restrictions. The member can rejoin with a valid invite; there is no kick ban to reverse." });
    if (name === "purge" || name === "clear") {
      const count = Math.min(100, Math.max(1, Number(args[0]) || 10));
      const deleted = await db.delete(messages).where(sql`${messages.id} IN (SELECT id FROM messages WHERE group_id IS NULL AND recipient_id IS NULL ORDER BY created_at DESC LIMIT ${count})`).returning({id:messages.id});
      return res.json({ message: `Removed ${deleted.length} recent public messages. Audit entry saved.` });
    }
    if (name === "warnings" || name === "strikes" || name === "notes" || name === "reports") {
      const rows = await db.select().from(moderationLogs).where(targetId ? eq(moderationLogs.targetId,targetId) : eq(moderationLogs.actorId,actorId)).orderBy(desc(moderationLogs.createdAt)).limit(20);
      return res.json({ message: rows.length ? rows.map(row=>`#${row.id} ${row.action}: ${row.reason || "No reason"}`).join(" · ") : "No records found." });
    }
    res.json({ message: `/${name} recorded for ${target?.username || "the current chat"}.` });
  });

  // DIHHRO membership and Block Blast monthly leaderboard
  const monthKeyFor = (d = new Date()) => d.getUTCFullYear() + "-" + String(d.getUTCMonth()+1).padStart(2,"0");
  app.post("/api/admin/dihhro/grant", requireAuth, async (req,res) => {
    const actor = await storage.getUser(req.session.userId!);
    if (!actor || !["owner","admin"].includes(String(actor.role).toLowerCase())) return res.status(403).json({message:"Only owners and admins can gift Dihhro."});
    const targetId = Number(req.body?.userId), months = Math.max(1,Math.min(12,Number(req.body?.months)||1));
    if (!Number.isInteger(targetId) || targetId < 1) return res.status(400).json({message:"Enter a valid user ID."});
    const target = await storage.getUser(targetId); if (!target) return res.status(404).json({message:"User not found."});
    const start = target.dihhroUntil && target.dihhroUntil > new Date() ? target.dihhroUntil : new Date();
    const expires = new Date(start.getTime()+months*30*86400000);
    await db.update(users).set({dihhroUntil:expires}).where(eq(users.id,targetId));
    await db.insert(moderationLogs).values({actorId:req.session.userId!,targetId,action:"dihhro-gift",reason:"Gifted "+months+" month(s) of Dihhro",expiresAt:expires});
    res.json({success:true,userId:targetId,dihhroUntil:expires});
  });
  app.get("/api/dihhro/me", requireAuth, async (req,res) => { const u=await storage.getUser(req.session.userId!); res.json({active:Boolean(u?.dihhroUntil&&u.dihhroUntil>new Date()),expiresAt:u?.dihhroUntil||null}); });
  app.post("/api/dihhro/gift-links", requireAuth, async (req,res) => {
    const actor = await storage.getUser(req.session.userId!);
    if (!actor || !["owner","admin"].includes(String(actor.role).toLowerCase())) return res.status(403).json({message:"Only owners and admins can create Dihhro gift links."});
    const code = "DH-" + randomBytes(18).toString("hex");
    await storage.createAccessKey({key:code,type:"dihhro-gift",createdBy:actor.id});
    return res.status(201).json({url:"/gift/"+code,code});
  });
  app.get("/api/dihhro/gift-links/:code", async (req,res) => {
    const key = await storage.getAccessKey(String(req.params.code||""));
    if (!key || key.type !== "dihhro-gift" || key.isUsed) return res.status(410).json({valid:false,message:"This Dihhro gift link is invalid, revoked, or already claimed."});
    return res.json({valid:true,months:1});
  });
  app.post("/api/dihhro/gift-links/:code/claim", requireAuth, async (req,res) => {
    const key = await storage.getAccessKey(String(req.params.code||""));
    if (!key || key.type !== "dihhro-gift" || key.isUsed) return res.status(410).json({message:"This Dihhro gift link is invalid, revoked, or already claimed."});
    const [claimed] = await db.update(accessKeys).set({isUsed:true}).where(and(eq(accessKeys.id,key.id),eq(accessKeys.isUsed,false))).returning({id:accessKeys.id});
    if (!claimed) return res.status(410).json({message:"This gift has already been claimed."});
    const target = await storage.getUser(req.session.userId!);
    if (!target) return res.status(401).json({message:"Sign in to claim this gift."});
    const start = target.dihhroUntil && target.dihhroUntil > new Date() ? target.dihhroUntil : new Date();
    const expires = new Date(start.getTime()+30*86400000);
    await db.update(users).set({dihhroUntil:expires}).where(eq(users.id,target.id));
    await db.insert(moderationLogs).values({actorId:key.createdBy || target.id,targetId:target.id,action:"dihhro-gift-claimed",reason:"Claimed one month of Dihhro",expiresAt:expires});
    return res.json({success:true,dihhroUntil:expires});
  });

  app.get("/api/blockblast/leaderboard", requireAuth, async (req,res) => {
    const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : monthKeyFor();
    const now = new Date(); const previousDate = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)); const previousMonth = monthKeyFor(previousDate);
    if (monthKeyFor() !== previousMonth) {
      const [alreadyAwarded] = await db.select().from(dihhroAwards).where(eq(dihhroAwards.monthKey,previousMonth)).limit(1);
      if (!alreadyAwarded) {
        const previousRows = await db.select({userId:blockBlastScores.userId,score:blockBlastScores.score}).from(blockBlastScores).where(eq(blockBlastScores.monthKey,previousMonth)).orderBy(desc(blockBlastScores.score)).limit(100);
        const monthlyBest = new Map<number,number>(); previousRows.forEach(row=>monthlyBest.set(row.userId,Math.max(monthlyBest.get(row.userId)||0,row.score)));
        const winner = Array.from(monthlyBest.entries()).sort((a,b)=>b[1]-a[1])[0];
        if (winner) { const winnerUser=await storage.getUser(winner[0]); const base=winnerUser?.dihhroUntil&&winnerUser.dihhroUntil>new Date()?winnerUser.dihhroUntil:new Date(); const expiry=new Date(base.getTime()+30*86400000); await db.update(users).set({dihhroUntil:expiry}).where(eq(users.id,winner[0])); await db.insert(dihhroAwards).values({userId:winner[0],monthKey:previousMonth,score:winner[1],expiresAt:expiry}); }
      }
    }
    const rows = await db.select({userId:blockBlastScores.userId,score:blockBlastScores.score,username:users.username,displayName:users.displayName}).from(blockBlastScores).innerJoin(users,eq(users.id,blockBlastScores.userId)).where(eq(blockBlastScores.monthKey,month)).orderBy(desc(blockBlastScores.score)).limit(100);
    const best = new Map<number,typeof rows[number]>(); rows.forEach(row=>{const old=best.get(row.userId);if(!old||row.score>old.score)best.set(row.userId,row);});
    res.json({month,entries:Array.from(best.values()).sort((a,b)=>b.score-a.score).map((row,index)=>({...row,rank:index+1}))});
  });
  const ensureBlockBlastChatRoom = async (userId:number) => {
    const inviteCode = "blockblast-public-room";
    let [room] = await db.select().from(groupChats).where(eq(groupChats.inviteCode,inviteCode)).limit(1);
    if (!room) {
      try {
        [room] = await db.insert(groupChats).values({name:"Block Blast Live Chat",inviteCode,ownerId:userId}).returning();
      } catch {
        [room] = await db.select().from(groupChats).where(eq(groupChats.inviteCode,inviteCode)).limit(1);
      }
    }
    if (!room) throw new Error("Could not initialise Block Blast chat");
    const [membership] = await db.select({id:groupChatMembers.id}).from(groupChatMembers).where(and(eq(groupChatMembers.groupId,room.id),eq(groupChatMembers.userId,userId))).limit(1);
    if (!membership) await db.insert(groupChatMembers).values({groupId:room.id,userId}).onConflictDoNothing();
    return room.id;
  };

  app.get("/api/blockblast/chat", requireAuth, async (req,res) => {
    const groupId = await ensureBlockBlastChatRoom(req.session.userId!);
    const rows = await storage.getMessages(req.session.userId!,undefined,groupId);
    res.setHeader("Cache-Control","no-store");
    res.json(rows.slice(-100));
  });

  app.post("/api/blockblast/chat", requireAuth, async (req,res) => {
    const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0,300) : "";
    if (!content) return res.status(400).json({message:"Enter a message first."});
    const [activeMute] = await db.select().from(moderationLogs).where(and(eq(moderationLogs.targetId,req.session.userId!),sql`${moderationLogs.action} IN ('mute','timeout','jail','restrict')`)).orderBy(desc(moderationLogs.createdAt)).limit(1);
    if (activeMute && (!activeMute.expiresAt || activeMute.expiresAt > new Date())) return res.status(403).json({message:"You are currently muted or restricted."});
    const groupId = await ensureBlockBlastChatRoom(req.session.userId!);
    const created = await storage.createMessage({senderId:req.session.userId!,groupId,content});
    const [row] = await db.select({id:messages.id,content:messages.content,createdAt:messages.createdAt,senderId:messages.senderId,senderName:users.username,senderDisplayName:users.displayName}).from(messages).innerJoin(users,eq(messages.senderId,users.id)).where(eq(messages.id,created.id)).limit(1);
    const [usage] = await db.select({bytes:sql<number>`COALESCE(SUM(octet_length(${messages.content}) + COALESCE(octet_length(${messages.mediaUrl}),0)),0)`}).from(messages).where(eq(messages.groupId,groupId));
    if (Number(usage?.bytes||0) > 1024*1024*1024) {
      await db.execute(sql`WITH ranked AS (
        SELECT id, SUM(octet_length(content) + COALESCE(octet_length(media_url),0)) OVER (ORDER BY created_at ASC, id ASC) AS total_bytes
        FROM messages WHERE group_id = ${groupId}
      ), purge AS (SELECT id FROM ranked WHERE total_bytes <= 500*1024*1024)
      DELETE FROM messages WHERE id IN (SELECT id FROM purge)`);
    }
    res.status(201).json(row);
  });

  app.get("/api/blockblast/history", requireAuth, async (req,res) => { const rows=await db.select().from(blockBlastScores).where(eq(blockBlastScores.userId,req.session.userId!)).orderBy(desc(blockBlastScores.createdAt)).limit(30); res.json(rows); });
  app.post("/api/blockblast/scores", requireAuth, async (req,res) => {
    const score=Number(req.body?.score); if(!Number.isSafeInteger(score)||score<0||score>1000000) return res.status(400).json({message:"Invalid score."});
    const userId=req.session.userId!; const [recent]=await db.select().from(blockBlastScores).where(eq(blockBlastScores.userId,userId)).orderBy(desc(blockBlastScores.createdAt)).limit(1);
    if(recent?.createdAt && Date.now()-recent.createdAt.getTime()<3000) return res.status(429).json({message:"Please wait before submitting another run."});
    await db.insert(blockBlastScores).values({userId,score,monthKey:monthKeyFor()}); res.status(201).json({success:true,score,month:monthKeyFor()});
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
    const [activeMute] = await db.select().from(moderationLogs)
      .where(and(eq(moderationLogs.targetId, req.session.userId!), sql`${moderationLogs.action} IN ('mute','timeout','jail','restrict','unmute','untimeout','unjail','unrestrict')`))
      .orderBy(desc(moderationLogs.createdAt)).limit(1);
    if (activeMute && !["unmute","untimeout","unjail","unrestrict"].includes(activeMute.action) && (!activeMute.expiresAt || activeMute.expiresAt > new Date())) {
      return res.status(403).json({ message: "You are currently muted or restricted by moderation." });
    }
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
    // The optimistic client already has its attachment URL. Don't echo a large
    // base64 data URL back over the network after an upload.
    res.status(201).json({
      ...message,
      mediaUrl: null,
      hasMedia: Boolean(message.mediaUrl),
    });
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

    res.json({ ...safeUser(user), mutualGroups });
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
        profileGradient,
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
      if (avatarUrl !== undefined && !isProfileImageProxyUrl(avatarUrl, req.session.userId!, "avatar")) {
        update.avatarUrl = typeof avatarUrl === 'string' && avatarUrl.length > 0 ? avatarUrl : null;
      }
      if (bannerUrl !== undefined && !isProfileImageProxyUrl(bannerUrl, req.session.userId!, "banner")) {
        update.bannerUrl = typeof bannerUrl === 'string' && bannerUrl.length > 0 ? bannerUrl : null;
      }
      if (usernameFont !== undefined) {
        const fonts = ["default","neon","matrix","cyber","glitch","fire","ice","rainbow","ghost","elite","comic-sans"];
        const rawFont = String(usernameFont);
        const customText = /^custom-gradient\|(default|neon|matrix|cyber|glitch|fire|ice|rainbow|ghost|elite|comic-sans)\|#[0-9a-f]{6}\|#[0-9a-f]{6}(?:\|#[0-9a-f]{6})?$/i.test(rawFont);
        const customFont = /^custom-font\|data:(?:font\/(?:woff2?|ttf|otf)|application\/octet-stream);base64,[A-Za-z0-9+/=]+(?:\|#[0-9a-f]{6}\|#[0-9a-f]{6}\|#[0-9a-f]{6})?$/i.test(rawFont);
        if (customFont && rawFont.length > 400000) return res.status(413).json({ message: "Uploaded fonts must be 256 KB or smaller." });
        if (!fonts.includes(rawFont) && !customText && !customFont) return res.status(400).json({message:"Unsupported font or text gradient."});
        const current = await storage.getUser(req.session.userId!);
        const fontName = customText ? rawFont.split("|")[1] : rawFont;
        const usesDihhroFont = customText || customFont || fontName === "comic-sans";
        if (usesDihhroFont && !["owner","admin"].includes(current?.role || "") && !(current?.dihhroUntil && current.dihhroUntil > new Date())) return res.status(403).json({message:"Custom fonts and text gradients are DIHTRO perks."});
        update.usernameFont = rawFont || null;
      }
      if (profileGradient !== undefined) {
        const rawGradient = String(profileGradient);
        const gradients = ["aurora","sunset","ocean","ember","violet","mint","mono","none"];
        const parts = rawGradient.split("~");
        const isStyle2 = parts.length === 6 && parts[0] === "style2";
        const selectedGradient = isStyle2 ? parts[1] : rawGradient;
        const customProfile = /^custom:#[0-9a-f]{6}:#[0-9a-f]{6}:#[0-9a-f]{6}$/i.test(selectedGradient);
        const validStyle2 = !isStyle2 || (
          /^#[0-9a-f]{6}$/i.test(parts[2] || "") &&
          /^#[0-9a-f]{6}$/i.test(parts[3] || "") &&
          ["0","1"].includes(parts[4]) &&
          ["portrait","landscape"].includes(parts[5])
        );
        if ((!gradients.includes(selectedGradient) && !customProfile) || !validStyle2) return res.status(400).json({message:"Invalid profile gradient settings."});
        const current = await storage.getUser(req.session.userId!);
        if (selectedGradient !== "none" && !["owner","admin"].includes(current?.role || "") && !(current?.dihhroUntil && current.dihhroUntil > new Date())) return res.status(403).json({message:"Profile gradients are a DIHTRO perk."});
        update.profileGradient = selectedGradient === "none" && !isStyle2 ? null : rawGradient;
      }
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
      res.json(safeUser(updated));
    } catch (err: any) {
      console.error('Profile update error:', err);
      res.status(500).json({ message: err?.message || 'Update failed' });
    }
  });

  app.get(api.chat.users.path, requireAuth, async (req, res) => {
    const usersList = await storage.getAllUsers();
    res.json(usersList.map(safeUser));
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
     res.json(friendUsers.map(safeUser));
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
    res.json(rows.map(safeUser));
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

  // === VOICE CALL SIGNALING — authenticated WebRTC signalling ===
  // Signals and call sessions are process-local; run one server instance unless these
  // maps are moved to shared storage/pub-sub (Redis or the database).
  interface CallSession { callerId: number; calleeId: number; withVideo: boolean; }
  const signals = new Map<number, any[]>();
  const callSessions = new Map<string, CallSession>();
  const activeCalls = new Map<string, Set<number>>();

  const pushVoiceSignal = (userId: number, signal: any) => {
    const queue = signals.get(userId) || [];
    queue.push({ ...signal, createdAt: Date.now() });
    // Bound memory if a client stops polling.
    if (queue.length > 200) queue.splice(0, queue.length - 200);
    signals.set(userId, queue);
  };

  const getCallPeer = (callId: unknown, userId: number) => {
    if (typeof callId !== 'string' || !callId) return null;
    const call = callSessions.get(callId);
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) return null;
    return { call, peerId: call.callerId === userId ? call.calleeId : call.callerId };
  };

  // Authenticated WebRTC mesh signalling for the shared Block Blast voice room.
  const blockBlastMembers = new Map<number,string>();
  const blockBlastSignals = new Map<number,any[]>();
  app.post("/api/blockblast/voice/join", requireAuth, async (req,res) => {
    const id=Number(req.session.userId!); const u=await storage.getUser(id); blockBlastMembers.set(id,u?.username||("Player "+id));
    res.json({participants:Array.from(blockBlastMembers.entries()).filter(([peer])=>peer!==id).map(([userId,username])=>({userId,username}))});
  });
  app.get("/api/blockblast/voice/participants", requireAuth, (req,res) => { const id=Number(req.session.userId!); res.json(Array.from(blockBlastMembers.entries()).filter(([peer])=>peer!==id).map(([userId,username])=>({userId,username}))); });
  app.post("/api/blockblast/voice/signal", requireAuth, (req,res) => {
    const from=Number(req.session.userId!), to=Number(req.body?.to); const signal=req.body?.signal;
    if(!blockBlastMembers.has(from)||!blockBlastMembers.has(to)||from===to) return res.status(403).json({message:"Both players must be in the voice room."});
    if(!signal||!["offer","answer","ice","left"].includes(signal.type)) return res.status(400).json({message:"Invalid WebRTC signal."});
    const queue=blockBlastSignals.get(to)||[]; queue.push({from,signal,createdAt:Date.now()}); if(queue.length>100)queue.splice(0,queue.length-100); blockBlastSignals.set(to,queue); res.json({success:true});
  });
  app.get("/api/blockblast/voice/signals", requireAuth, (req,res) => { const id=Number(req.session.userId!); const queue=blockBlastSignals.get(id)||[]; blockBlastSignals.set(id,[]); res.json(queue.filter(item=>Date.now()-item.createdAt<60000)); });
  app.post("/api/blockblast/voice/leave", requireAuth, (req,res) => {
    const id=Number(req.session.userId!); blockBlastMembers.delete(id);
    for(const peer of blockBlastMembers.keys()){const queue=blockBlastSignals.get(peer)||[];queue.push({from:id,signal:{type:"left"},createdAt:Date.now()});blockBlastSignals.set(peer,queue);}
    blockBlastSignals.delete(id); res.json({success:true});
  });
  app.post('/api/chat/voice/start', requireAuth, async (req, res) => {
    const calleeId = Number(req.body?.calleeId);
    const callerId = Number(req.session.userId!);
    const withVideo = Boolean(req.body?.withVideo);
    if (!Number.isInteger(calleeId) || calleeId <= 0 || calleeId === callerId) {
      return res.status(400).json({ message: 'Invalid call recipient' });
    }
    const callee = await storage.getUser(calleeId);
    if (!callee) return res.status(404).json({ message: 'User not found' });
    if (await blockedEitherWay(callerId, calleeId)) return res.status(403).json({ message: 'This user is unavailable' });

    const callId = `call-${Date.now()}-${randomBytes(8).toString('hex')}`;
    callSessions.set(callId, { callerId, calleeId, withVideo });
    const caller = await storage.getUser(callerId);
    pushVoiceSignal(calleeId, {
      type: 'incoming', callId, fromId: callerId,
      fromName: caller?.username || `User_${callerId}`, withVideo,
    });
    res.json({ callId });
  });

  app.post('/api/chat/voice/accept', requireAuth, (req, res) => {
    const callId = req.body?.callId;
    const call = typeof callId === 'string' ? callSessions.get(callId) : null;
    if (!call) return res.status(404).json({ message: 'Call not found or expired' });
    if (call.calleeId !== req.session.userId!) return res.status(403).json({ message: 'Only the invited recipient can accept this call' });
    pushVoiceSignal(call.callerId, { type: 'accepted', callId });
    res.json({ success: true });
  });

  app.post('/api/chat/voice/offer', requireAuth, (req, res) => {
    const { callId, recipientId, offer } = req.body || {};
    const peer = getCallPeer(callId, Number(req.session.userId!));
    if (!peer || peer.peerId !== Number(recipientId)) return res.status(403).json({ message: 'Invalid call participant' });
    if (!offer || typeof offer.sdp !== 'string' || !['offer'].includes(String(offer.type))) {
      return res.status(400).json({ message: 'Invalid WebRTC offer' });
    }
    pushVoiceSignal(peer.peerId, { type: 'offer', callId, from: req.session.userId!, offer });
    res.json({ success: true });
  });

  app.post('/api/chat/voice/answer', requireAuth, (req, res) => {
    const { callId, recipientId, answer } = req.body || {};
    const peer = getCallPeer(callId, Number(req.session.userId!));
    if (!peer || peer.peerId !== Number(recipientId)) return res.status(403).json({ message: 'Invalid call participant' });
    if (!answer || typeof answer.sdp !== 'string' || answer.type !== 'answer') {
      return res.status(400).json({ message: 'Invalid WebRTC answer' });
    }
    pushVoiceSignal(peer.peerId, { type: 'answer', callId, from: req.session.userId!, answer });
    res.json({ success: true });
  });

  app.post('/api/chat/voice/ice', requireAuth, (req, res) => {
    const { callId, recipientId, candidate } = req.body || {};
    const peer = getCallPeer(callId, Number(req.session.userId!));
    if (!peer || peer.peerId !== Number(recipientId)) return res.status(403).json({ message: 'Invalid call participant' });
    if (!candidate || typeof candidate.candidate !== 'string') return res.status(400).json({ message: 'Invalid ICE candidate' });
    pushVoiceSignal(peer.peerId, { type: 'ice', callId, from: req.session.userId!, candidate });
    res.json({ success: true });
  });

  app.post('/api/chat/voice/decline', requireAuth, (req, res) => {
    const callId = req.body?.callId;
    const call = typeof callId === 'string' ? callSessions.get(callId) : null;
    if (!call) return res.json({ success: true });
    if (call.calleeId !== req.session.userId!) return res.status(403).json({ message: 'Only the invited recipient can decline this call' });
    pushVoiceSignal(call.callerId, { type: 'declined', callId });
    callSessions.delete(callId);
    res.json({ success: true });
  });

  app.post('/api/chat/voice/end', requireAuth, (req, res) => {
    const callId = req.body?.callId;
    const peer = getCallPeer(callId, Number(req.session.userId!));
    if (!peer) return res.json({ success: true });
    pushVoiceSignal(peer.peerId, { type: 'ended', callId });
    callSessions.delete(String(callId));
    res.json({ success: true });
  });

  app.get('/api/chat/voice/poll', requireAuth, (req, res) => {
    const userId = Number(req.session.userId!);
    const queue = signals.get(userId) || [];
    signals.set(userId, []);
    res.json(queue);
  });

  // Optional group-call presence endpoints retained for existing clients.
  app.get('/api/chat/voice/active', requireAuth, (req, res) => {
    const { id, isGroup } = req.query;
    const key = `${isGroup ? 'g' : 'u'}${id}`;
    res.json(Array.from(activeCalls.get(key) || new Set<number>()));
  });
  app.post('/api/chat/voice/join', requireAuth, (req, res) => {
    const { id, isGroup } = req.body || {};
    const key = `${isGroup ? 'g' : 'u'}${id}`;
    const participants = activeCalls.get(key) || new Set<number>();
    participants.add(Number(req.session.userId!));
    activeCalls.set(key, participants);
    res.json({ success: true });
  });
  app.post('/api/chat/voice/leave', requireAuth, (req, res) => {
    const { id, isGroup } = req.body || {};
    const key = `${isGroup ? 'g' : 'u'}${id}`;
    const participants = activeCalls.get(key);
    if (participants) {
      participants.delete(Number(req.session.userId!));
      if (!participants.size) activeCalls.delete(key);
    }
    res.json({ success: true });
  });

  // === ACCESS REQUESTS (public - no auth required) ===
  app.post('/api/access-requests', accessRequestRateLimit, turnstileGuard(), async (req, res) => {
    try {
      const { username, name, password, message } = req.body;
      const requestedUsername = String(username || name || "").trim();
      if (!/^[A-Za-z0-9_.-]{3,24}$/.test(requestedUsername)) return res.status(400).json({ message: "Username must be 3–24 characters using letters, numbers, dots, dashes or underscores." });
      if (typeof password !== "string" || password.length < 8 || password.length > 128) return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
      if (typeof message !== "string" || message.trim().length < 5 || message.trim().length > 500) return res.status(400).json({ message: "Tell us why you want to join (5–500 characters)." });
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, requestedUsername)).limit(1);
      if (existing) return res.status(409).json({ message: "That username is already taken." });
      const request = await storage.createAccessRequest({ name: requestedUsername, passwordHash: hashAccountPassword(password), message: message.trim() });
      res.status(201).json({ id: request.id, name: request.name, message: request.message, status: request.status, createdAt: request.createdAt });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Failed' });
    }
  });

  app.get('/api/admin/requests', requireAdmin, async (req, res) => {
    const requests = await storage.listAccessRequests();
    res.json(requests);
  });

  app.patch('/api/admin/requests/:id', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId < 1) return res.status(400).json({ message: 'Invalid request.' });
    const request = await storage.getAccessRequest(requestId);
    if (!request) return res.status(404).json({ message: 'Access request not found.' });
    if (request.status !== "pending") return res.status(409).json({ message: "This request has already been reviewed." });
    if (status === "approved") {
      if (!request.passwordHash) return res.status(400).json({ message: "This older request has no saved password. Ask the applicant to submit a new request." });
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, request.name)).limit(1);
      if (existing) return res.status(409).json({ message: "That username is now taken. Reject this request and ask them to apply with another username." });
      const [created] = await db.insert(users).values({
        username: request.name,
        serialKey: "ACCOUNT-" + randomBytes(24).toString("hex"),
        passwordHash: request.passwordHash,
        role: "user",
      }).returning({ id: users.id });
      await storage.updateAccessRequestStatus(requestId, "approved", created.id);
      return res.json({ success: true, accountCreated: true, userId: created.id, username: request.name });
    }
    await storage.updateAccessRequestStatus(requestId, status);
    return res.json({ success: true, accountCreated: false });
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