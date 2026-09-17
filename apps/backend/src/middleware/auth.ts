// ============================================================
// Auth Middleware — JWT Bearer verification
// ============================================================
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface JWTPayload {
  sub: string;    // user id
  email: string;
  iat?: number;
  exp?: number;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      success: false,
      data: null,
      error: 'Unauthorized: invalid or expired token',
      timestamp: new Date().toISOString(),
    });
  }
}
