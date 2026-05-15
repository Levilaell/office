import type { Server as IOServer } from 'socket.io';
import { verifyClerkToken } from './clerk.js';
import { resolveTenantId } from './tenant.js';

// Estende Socket.data com nossos campos. Mantém type-safety sem precisar
// fazer cast em cada handler.
declare module 'socket.io' {
  interface SocketData {
    userId: string;
    tenantId: string;
  }
}

export type SetupSocketIoConfig = {
  clerkSecretKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

export const setupSocketIo = (io: IOServer, config: SetupSocketIoConfig): void => {
  const tenantResolverInput = {
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  };

  io.use(async (socket, next) => {
    const raw = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof raw !== 'string' || raw.length === 0) {
      next(new Error('missing token'));
      return;
    }
    const claims = await verifyClerkToken(raw, { secretKey: config.clerkSecretKey });
    if (!claims) {
      next(new Error('invalid token'));
      return;
    }
    const orgId = claims.o?.id;
    if (!orgId) {
      next(new Error('no organization in token'));
      return;
    }
    const tenantId = await resolveTenantId(orgId, tenantResolverInput);
    if (!tenantId) {
      next(new Error('tenant not found'));
      return;
    }
    socket.data.userId = claims.sub;
    socket.data.tenantId = tenantId;
    next();
  });

  io.on('connection', (socket) => {
    void socket.join(`tenant:${socket.data.tenantId}`);
    socket.emit('connected', { tenantId: socket.data.tenantId });
  });
};
