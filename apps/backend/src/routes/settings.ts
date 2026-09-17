// ============================================================
// Settings Routes — /api/settings (protected)
// ============================================================
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { userSettings } from '../db/schema';
import { authenticate } from '../middleware/auth';
import type { ApiResponse, UserSettings } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}

const VALID_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

const UpdateSettingsSchema = z.object({
  symbols: z.array(z.string()).optional(),
  timeframes: z.array(z.enum(VALID_TIMEFRAMES)).optional(),
  riskPerTrade: z.number().min(0.1).max(10).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  minRR: z.number().min(1).max(20).optional(),
  newsEnabled: z.boolean().optional(),
  socialEnabled: z.boolean().optional(),
  telegramAlerts: z.boolean().optional(),
  signalCooldownMinutes: z.number().int().min(1).max(1440).optional(),
  maxSignalsPerSymbolPerHour: z.number().int().min(1).max(10).optional(),
});

function mapSettings(r: typeof userSettings.$inferSelect): UserSettings {
  return {
    symbols: (r.symbols as string[]) ?? [],
    timeframes: (r.timeframes as UserSettings['timeframes']) ?? [],
    riskPerTrade: Number(r.riskPerTrade ?? 1),
    minConfidence: Number(r.minConfidence ?? 0.7),
    minRR: Number(r.minRR ?? 2),
    newsEnabled: r.newsEnabled ?? true,
    socialEnabled: r.socialEnabled ?? false,
    telegramAlerts: r.telegramAlerts ?? true,
    signalCooldownMinutes: r.signalCooldownMinutes ?? 60,
    maxSignalsPerSymbolPerHour: r.maxSignalsPerSymbolPerHour ?? 2,
  };
}

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/settings
  fastify.get(
    '/api/settings',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const [row] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          success: false, data: null, error: 'Settings not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send(ok(mapSettings(row)));
    },
  );

  // PUT /api/settings
  fastify.put<{ Body: z.infer<typeof UpdateSettingsSchema> }>(
    '/api/settings',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const parseResult = UpdateSettingsSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false, data: null,
          error: parseResult.error.errors.map((e) => e.message).join(', '),
          timestamp: new Date().toISOString(),
        });
      }

      const data = parseResult.data;
      const updates: Partial<typeof userSettings.$inferInsert> = {};

      if (data.symbols !== undefined) updates.symbols = data.symbols;
      if (data.timeframes !== undefined) updates.timeframes = data.timeframes;
      if (data.riskPerTrade !== undefined) updates.riskPerTrade = String(data.riskPerTrade);
      if (data.minConfidence !== undefined) updates.minConfidence = String(data.minConfidence);
      if (data.minRR !== undefined) updates.minRR = String(data.minRR);
      if (data.newsEnabled !== undefined) updates.newsEnabled = data.newsEnabled;
      if (data.socialEnabled !== undefined) updates.socialEnabled = data.socialEnabled;
      if (data.telegramAlerts !== undefined) updates.telegramAlerts = data.telegramAlerts;
      if (data.signalCooldownMinutes !== undefined) updates.signalCooldownMinutes = data.signalCooldownMinutes;
      if (data.maxSignalsPerSymbolPerHour !== undefined) updates.maxSignalsPerSymbolPerHour = data.maxSignalsPerSymbolPerHour;
      updates.updatedAt = new Date();

      const [updated] = await db
        .update(userSettings)
        .set(updates)
        .where(eq(userSettings.userId, userId))
        .returning();

      if (!updated) {
        return reply.status(404).send({
          success: false, data: null, error: 'Settings not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send(ok(mapSettings(updated)));
    },
  );
}
