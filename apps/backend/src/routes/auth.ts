// ============================================================
// Auth Routes — /api/auth
// ============================================================
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, userSettings } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { logger } from '../services/logger';
import type { ApiResponse } from '@trading/shared';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface UserProfile {
  id: string;
  email: string;
  timezone: string;
  createdAt: Date | null;
}

function makeApiResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}

function makeErrorResponse(error: string): ApiResponse<null> {
  return { success: false, data: null, error, timestamp: new Date().toISOString() };
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/auth/register
  fastify.post<{ Body: z.infer<typeof RegisterSchema> }>(
    '/api/auth/register',
    async (request, reply) => {
      const parseResult = RegisterSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send(makeErrorResponse(parseResult.error.errors.map((e) => e.message).join(', ')));
      }

      const { email, password } = parseResult.data;

      // Check duplicate
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(409).send(makeErrorResponse('Email already registered'));
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          timezone: 'UTC',
          defaultRisk: String(config.defaultRiskPerTrade),
        })
        .returning({ id: users.id, email: users.email, createdAt: users.createdAt });

      if (!newUser) {
        return reply.status(500).send(makeErrorResponse('Failed to create user'));
      }

      // Insert default settings
      await db.insert(userSettings).values({
        userId: newUser.id,
        riskPerTrade: String(config.defaultRiskPerTrade),
        minConfidence: String(config.defaultMinConfidence),
        minRR: String(config.defaultMinRR),
        signalCooldownMinutes: config.signalCooldownMinutes,
        maxSignalsPerSymbolPerHour: config.maxSignalsPerSymbolPerHour,
      });

      const payload = { sub: newUser.id, email: newUser.email };
      const accessToken = fastify.jwt.sign(payload, { expiresIn: config.jwtExpiresIn });
      const refreshToken = (fastify.jwt as unknown as { sign: (payload: object, options: object) => string }).sign(
        payload,
        { expiresIn: config.jwtRefreshExpiresIn, secret: config.jwtRefreshSecret },
      );

      logger.info({ event: 'user_registered', userId: newUser.id }, 'New user registered');

      return reply.status(201).send(
        makeApiResponse<TokenPair>({ accessToken, refreshToken }),
      );
    },
  );

  // POST /api/auth/login
  fastify.post<{ Body: z.infer<typeof LoginSchema> }>(
    '/api/auth/login',
    async (request, reply) => {
      const parseResult = LoginSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send(makeErrorResponse(parseResult.error.errors.map((e) => e.message).join(', ')));
      }

      const { email, password } = parseResult.data;

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          timezone: users.timezone,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        return reply.status(401).send(makeErrorResponse('Invalid email or password'));
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send(makeErrorResponse('Invalid email or password'));
      }

      const payload = { sub: user.id, email: user.email };
      const accessToken = fastify.jwt.sign(payload, { expiresIn: config.jwtExpiresIn });
      const refreshToken = (fastify.jwt as unknown as { sign: (payload: object, options: object) => string }).sign(
        payload,
        { expiresIn: config.jwtRefreshExpiresIn, secret: config.jwtRefreshSecret },
      );

      logger.info({ event: 'user_login', userId: user.id }, 'User logged in');

      return reply.send(makeApiResponse<TokenPair>({ accessToken, refreshToken }));
    },
  );

  // POST /api/auth/refresh
  fastify.post<{ Body: z.infer<typeof RefreshSchema> }>(
    '/api/auth/refresh',
    async (request, reply) => {
      const parseResult = RefreshSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send(makeErrorResponse('refreshToken is required'));
      }

      try {
        const decoded = fastify.jwt.verify<{ sub: string; email: string }>(
          parseResult.data.refreshToken,
          { secret: config.jwtRefreshSecret } as Parameters<typeof fastify.jwt.verify>[1],
        );

        const payload = { sub: decoded.sub, email: decoded.email };
        const accessToken = fastify.jwt.sign(payload, { expiresIn: config.jwtExpiresIn });

        return reply.send(makeApiResponse({ accessToken }));
      } catch {
        return reply.status(401).send(makeErrorResponse('Invalid or expired refresh token'));
      }
    },
  );

  // POST /api/auth/logout (stateless)
  fastify.post('/api/auth/logout', async (_request, reply) => {
    return reply.send(makeApiResponse({ message: 'Logged out' }));
  });

  // GET /api/auth/me — protected
  fastify.get(
    '/api/auth/me',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          timezone: users.timezone,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send(makeErrorResponse('User not found'));
      }

      const profile: UserProfile = {
        id: user.id,
        email: user.email,
        timezone: user.timezone ?? 'UTC',
        createdAt: user.createdAt ?? new Date(),
      };
      return reply.send(makeApiResponse<UserProfile>(profile));
    },
  );
}
