
import { db } from "./db";
import { users, accessKeys, accessRequests, searchHistory, messages, groupChats, groupChatMembers, customEmojis, friendRequests, blocks, oauthAccounts } from "@shared/schema";
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
import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";

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

function derivePasswordKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, saltHex, keyHex] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/i.test(saltHex || "") ||
    !/^[a-f0-9]{128}$/i.test(keyHex || "")
  ) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  const actual = await derivePasswordKey(password, salt);
  return timingSafeEqual(actual, expected);
}

function turnstileGuard(requiredWhenUnconfigured = false): RequestHandler {
  return async (req, res, next) => {
    const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    const siteKey = process.env.CLOUDFLARE_TURNSTILE_SITE_KEY;

    if (!secret && !siteKey) {
      if (requiredWhenUnconfigured && process.env.NODE_ENV === "production") {
        return res.status(503).json({ message: "Cloudflare verification is not configured yet." });
      }
      return next();
    }
    if (!secret || !siteKey) {
      return res.status(503).json({ message: "Cloudflare verification is not fully configured." });
    }

    const token = req.body?.turnstileToken;
    if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return res.status(400).json({ message: "Complete the Cloudflare verification first." });
    }

    try {
      const form = new URLSearchParams({ secret, response: token });
      if (req.ip) form.set("remoteip", req.ip);
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (!response.ok) {
        return res.status(503).json({ message: "Cloudflare verification is temporarily unavailable." });
      }
      const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
      const requestHost = req.hostname.toLowerCase();
      if (
        result.success !== true ||
        result.action !== "auth" ||
        (result.hostname && result.hostname.toLowerCase() !== requestHost)
      ) {
        return res.status(403).json({ message: "Cloudflare verification failed. Please try again." });
      }
      next();
    } catch {
      res.status(503).json({ message: "Cloudflare verification is temporarily unavailable." });
    }
  };
}

async function getOrCreateOAuthUser(provider: OAuthProvider, providerSubject: string, displayName: string) {
  return db.transaction(async (tx) => {
    const findLinkedAccount = () => tx.select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerSubject, providerSubject),
      ))
      .limit(1);

    const [linkedAccount] = await findLinkedAccount();
    if (linkedAccount) return linkedAccount.userId;

    const visibleName = displayName.trim().slice(0, 80) || "New member";
    const username = visibleName
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}_.-]/gu, "")
      .slice(0, 32) || `member-${randomBytes(3).toString("hex")}`;
    const [createdUser] = await tx.insert(users).values({
      username,
      displayName: visibleName,
      serialKey: `OAUTH-${randomBytes(32).toString("hex")}`,
      role: "user",
      presenceStatus: "offline",
    }).returning({ id: users.id });

    const [createdAccount] = await tx.insert(oauthAccounts)
      .values({ userId: createdUser.id, provider, providerSubject })
      .onConflictDoNothing()
      .returning({ userId: oauthAccounts.userId });
    if (createdAccount) return createdAccount.userId;

    // A simultaneous callback may have created the same provider identity.
    await tx.delete(users).where(eq(users.id, createdUser.id));
    const [racedAccount] = await findLinkedAccount();
    return racedAccount?.userId;
  });
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
      cookie: {
        maxAge: 86400000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
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
  app.get("/api/auth/config", (_req, res) => {
    res.json({
      providers: {
        google: isOAuthProviderConfigured("google"),
        microsoft: isOAuthProviderConfigured("microsoft"),
      },
      turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || null,
    });
  });

  app.post("/api/auth/oauth/:provider/start", oauthStartRateLimit, turnstileGuard(true), async (req, res) => {
    const providerParam = String(req.params.provider);
    if (!isOAuthProvider(providerParam)) {
      return res.status(404).json({ message: "Sign-in provider not found." });
    }
    const provider = providerParam;
    if (!isOAuthProviderConfigured(provider)) {
      return res.status(503).json({ message: `${provider} sign-in is not configured yet.` });
    }

    try {
      const input = z.object({
        turnstileToken: z.string().max(2048).optional(),
        returnTo: z.string().max(300).optional(),
      }).parse(req.body ?? {});
      const returnTo = input.returnTo && (
        input.returnTo === "/chat" ||
        input.returnTo === "/proxy" ||
        /^\/join\/[A-Za-z0-9_-]{1,100}$/.test(input.returnTo)
      ) ? input.returnTo : "/proxy";

      const oidc = await import("openid-client");
      const configuration = await getOAuthConfig(provider);
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
      const redirectUri = getOAuthRedirectUri(provider);
      const authorizationUrl = oidc.buildAuthorizationUrl(configuration, {
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      });

      req.session.oauthFlow = { provider, state, nonce, codeVerifier, redirectUri, returnTo };
      await saveSession(req);
      res.json({ authorizationUrl: authorizationUrl.toString() });
    } catch {
      console.error(`OAuth start failed for ${provider}`);
      res.status(503).json({ message: "Could not start sign-in. Check the provider configuration." });
    }
  });

  app.get("/api/auth/oauth/:provider/callback", authRateLimit, async (req, res) => {
    const providerParam = String(req.params.provider);
    if (!isOAuthProvider(providerParam)) {
      return res.redirect("/?oauthError=provider");
    }
    const provider = providerParam;
    const flow = req.session.oauthFlow;
    if (!flow || flow.provider !== provider || !isOAuthProviderConfigured(provider)) {
      return res.redirect("/?oauthError=state");
    }

    try {
      const oidc = await import("openid-client");
      const configuration = await getOAuthConfig(provider);
      const callbackUrl = new URL(req.originalUrl, flow.redirectUri);
      const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
        pkceCodeVerifier: flow.codeVerifier,
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      const subject = claims?.sub;
      if (typeof subject !== "string" || subject.length === 0) {
        throw new Error("Provider response did not include a subject");
      }

      const accountName = typeof claims.name === "string" ? claims.name : "New member";
      const userId = await getOrCreateOAuthUser(provider, subject, accountName);
      if (!userId) throw new Error("Could not resolve the provider account");
      const user = await storage.getUser(userId);
      if (!user) throw new Error("Provider account no longer exists");

      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.role = user.role;
      await db.update(users).set({
        presenceStatus: "online",
        lastSeen: new Date(),
      }).where(eq(users.id, user.id));
      await saveSession(req);
      res.redirect(flow.returnTo);
    } catch {
      console.error(`OAuth callback failed for ${provider}`);
      res.redirect(`/?oauthError=${provider}`);
    }
  });

  app.post(api.auth.login.path, authRateLimit, turnstileGuard(), async (req, res) => {
    try {
      const { serialKey, password, username } = api.auth.login.input.parse(req.body);
      const credential = password ?? serialKey ?? "";
      const accountByName = await storage.getUserByUsername(username);
      let user = accountByName?.passwordHash ? accountByName : undefined;

      if (user?.passwordHash) {
        if (!password || !await verifyPassword(password, user.passwordHash)) {
          return res.status(401).json({ message: "Invalid username or password." });
        }
      } else {
        user = await storage.getUserBySerial(credential);
        if (user && user.username.toLowerCase() !== username.toLowerCase()) {
          return res.status(401).json({ message: "Invalid username or password." });
        }

        if (credential === OWNER_KEY) {
          if (!user) {
            user = await storage.createUser({ username, serialKey: credential, role: "owner" });
          }
        } else if (!user) {
          // Do not let an OAuth-only account be bypassed by entering another access key.
          if (accountByName) {
            return res.status(401).json({ message: "Invalid username or password." });
          }
          const accessKey = await storage.getAccessKey(credential);
          if (!accessKey) {
            return res.status(401).json({ message: "Invalid username or password." });
          }

          let expiresAt: Date | undefined;
          if (accessKey.type === "limited" && accessKey.durationMinutes) {
            expiresAt = new Date(Date.now() + accessKey.durationMinutes * 60000);
          }
          user = await storage.createUser({ username, serialKey: credential, role: "user", expiresAt });
          await storage.markKeyAsUsed(accessKey.id);
        }
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid username or password." });
      }
      // Check expiration
      if (user.expiresAt && new Date() > user.expiresAt) {
        return res.status(401).json({ message: "Account expired" });
      }

      // Rotate the session identifier after authentication to prevent fixation.
      await regenerateSession(req);
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
    const inviteCode = randomBytes(16).toString("base64url");
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
  app.post('/api/access-requests', accessRequestRateLimit, turnstileGuard(true), async (req, res) => {
    try {
      const input = z.object({
        username: z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N}_.-]+$/u),
        password: z.string().min(12).max(128),
        reason: z.string().trim().min(5).max(1000),
        turnstileToken: z.string().max(2048).optional(),
      }).parse(req.body ?? {});

      if (await storage.getUserByUsername(input.username)) {
        return res.status(409).json({ message: "That username is already in use." });
      }
      const [pendingRequest] = await db.select({ id: accessRequests.id })
        .from(accessRequests)
        .where(and(
          eq(accessRequests.status, "pending"),
          sql`LOWER(${accessRequests.name}) = LOWER(${input.username})`,
        ))
        .limit(1);
      if (pendingRequest) {
        return res.status(409).json({ message: "A request for that username is already pending." });
      }

      const passwordHash = await hashPassword(input.password);
      const request = await storage.createAccessRequest({
        name: input.username,
        message: input.reason,
        passwordHash,
      });
      res.status(201).json({ id: request.id, status: request.status });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0]?.message || "Check the request details." });
      }
      res.status(500).json({ message: "Failed to submit access request." });
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
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ message: "Invalid request." });
    }

    try {
      const outcome = await db.transaction(async (tx) => {
        const [request] = await tx.select().from(accessRequests)
          .where(eq(accessRequests.id, requestId))
          .limit(1);
        if (!request) {
          return { statusCode: 404, error: "Access request not found." };
        }
        if (request.status !== "pending") {
          return { statusCode: 409, error: "This request has already been reviewed." };
        }

        if (status === "rejected") {
          await tx.update(accessRequests).set({ status, passwordHash: null })
            .where(eq(accessRequests.id, requestId));
          return { success: true as const };
        }
        if (status === "pending") {
          return { statusCode: 400, error: "A request cannot be moved back to pending." };
        }
        if (!request.passwordHash) {
          return { statusCode: 409, error: "This older request has no password. Ask them to submit a new request." };
        }

        const [existingUser] = await tx.select({ id: users.id }).from(users)
          .where(sql`LOWER(${users.username}) = LOWER(${request.name})`)
          .limit(1);
        if (existingUser) {
          return { statusCode: 409, error: "That username is already in use. Ask them to submit a new request." };
        }

        await tx.insert(users).values({
          username: request.name,
          serialKey: `REQUEST-${randomBytes(32).toString("hex")}`,
          passwordHash: request.passwordHash,
          role: "user",
          presenceStatus: "offline",
        });
        await tx.update(accessRequests).set({ status: "approved", passwordHash: null })
          .where(eq(accessRequests.id, requestId));
        return { success: true as const };
      });

      if ("error" in outcome) {
        return res.status(outcome.statusCode).json({ message: outcome.error });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Could not update the access request." });
    }
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
