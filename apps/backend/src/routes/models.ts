// ============================================================
// Model Versions Routes — /api/models
// ============================================================
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { modelVersions } from '../db/schema';
import type { ApiResponse, ModelVersion } from '@trading/shared';

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}
function notFound(msg: string): ApiResponse<null> {
  return { success: false, data: null, error: msg, timestamp: new Date().toISOString() };
}

function mapModel(r: typeof modelVersions.$inferSelect): ModelVersion {
  return {
    id: r.id,
    modelName: r.modelName ?? '',
    version: r.version ?? '',
    artifactPath: r.artifactPath ?? '',
    featuresVersion: r.featuresVersion ?? '',
    trainingStart: r.trainingStart as Date,
    trainingEnd: r.trainingEnd as Date,
    validationMetrics: (r.validationMetrics as Record<string, number>) ?? {},
    testMetrics: (r.testMetrics as Record<string, number>) ?? {},
    hyperparameters: (r.hyperparameters as Record<string, unknown>) ?? {},
    createdAt: r.createdAt as Date,
    isActive: r.isActive ?? false,
  };
}

export async function modelRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/models
  fastify.get('/api/models', async (_request, reply) => {
    const rows = await db.select().from(modelVersions);
    return reply.send(ok(rows.map(mapModel)));
  });

  // GET /api/models/:id
  fastify.get<{ Params: { id: string } }>(
    '/api/models/:id',
    async (request, reply) => {
      const [row] = await db
        .select()
        .from(modelVersions)
        .where(eq(modelVersions.id, request.params.id))
        .limit(1);

      if (!row) return reply.status(404).send(notFound('Model not found'));
      return reply.send(ok(mapModel(row)));
    },
  );
}
