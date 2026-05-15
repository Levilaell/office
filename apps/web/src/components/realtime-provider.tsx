'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { disconnectSocket, getSocket } from '@/lib/socket';

/**
 * Mantém a conexão Socket.io viva enquanto user + org estão ativos.
 * Não consome eventos — isso fica nos consumers (Sprint 0.3c+).
 */
export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded, isSignedIn, orgId, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) {
      disconnectSocket();
      return;
    }
    let cancelled = false;
    getSocket(() => getToken()).catch((err) => {
      if (cancelled) return;
      console.error('[realtime] handshake falhou', err);
    });
    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, [isLoaded, isSignedIn, orgId, getToken]);

  return <>{children}</>;
};
