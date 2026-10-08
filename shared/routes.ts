
import { z } from 'zod';
import { insertUserSchema, insertKeySchema, insertMessageSchema, insertHistorySchema, users, accessKeys, searchHistory, messages } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        serialKey: z.string(),
        username: z.string().trim().min(1, "Username is required").max(32, "Username must be 32 characters or fewer"),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
  admin: {
    generateKey: {
      method: 'POST' as const,
      path: '/api/admin/keys',
      input: z.object({
        type: z.enum(['permanent', 'limited']),
        durationMinutes: z.number().optional(),
      }),
      responses: {
        201: z.custom<typeof accessKeys.$inferSelect>(),
        403: errorSchemas.unauthorized,
      },
    },
    listKeys: {
      method: 'GET' as const,
      path: '/api/admin/keys',
      responses: {
        200: z.array(z.custom<typeof accessKeys.$inferSelect>()),
        403: errorSchemas.unauthorized,
      },
    },
    deleteKey: {
      method: 'DELETE' as const,
      path: '/api/admin/keys/:id',
      responses: {
        204: z.void(),
        403: errorSchemas.unauthorized,
      },
    },
  },
  history: {
    list: {
      method: 'GET' as const,
      path: '/api/history',
      responses: {
        200: z.array(z.custom<typeof searchHistory.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/history',
      input: insertHistorySchema.pick({ url: true, query: true }),
      responses: {
        201: z.custom<typeof searchHistory.$inferSelect>(),
      },
    },
    clear: {
      method: 'DELETE' as const,
      path: '/api/history',
      responses: {
        204: z.void(),
      },
    }
  },
  chat: {
    list: {
      method: 'GET' as const,
      path: '/api/messages',
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect & { senderName: string }>()),
      },
    },
    send: {
      method: 'POST' as const,
      path: '/api/messages',
      input: z.object({
        content: z.string(),
        recipientId: z.number().optional(),
        groupId: z.number().optional(),
        mediaUrl: z.string().optional().nullable(),
        mediaType: z.string().optional().nullable(),
        replyToId: z.number().optional().nullable(),
      }),
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
      },
    },
    users: {
      method: 'GET' as const,
      path: '/api/chat/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    createGroup: {
      method: 'POST' as const,
      path: '/api/chat/groups',
      input: z.object({
        name: z.string(),
      }),
      responses: {
        201: z.any(), // Group object
      },
    },
    joinGroup: {
      method: 'POST' as const,
      path: '/api/chat/groups/join',
      input: z.object({
        inviteCode: z.string(),
      }),
      responses: {
        200: z.any(),
      },
    },
    listGroups: {
      method: 'GET' as const,
      path: '/api/chat/groups',
      responses: {
        200: z.array(z.any()),
      },
    },
    voice: {
      offer: {
        method: 'POST' as const,
        path: '/api/chat/voice/offer',
        input: z.object({
          recipientId: z.number(),
          offer: z.any(),
        }),
        responses: { 200: z.any() },
      },
      answer: {
        method: 'POST' as const,
        path: '/api/chat/voice/answer',
        input: z.object({
          recipientId: z.number(),
          answer: z.any(),
        }),
        responses: { 200: z.any() },
      },
      ice: {
        method: 'POST' as const,
        path: '/api/chat/voice/ice',
        input: z.object({
          recipientId: z.number(),
          candidate: z.any(),
        }),
        responses: { 200: z.any() },
      }
    }
  },
  proxy: {
    fetch: {
      method: 'GET' as const,
      path: '/api/proxy',
      input: z.object({
        url: z.string().url(),
      }),
      responses: {
        // Returns the HTML content directly, or proxied data
        200: z.any(), 
      }
    }
  }
};

// ============================================
// HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
