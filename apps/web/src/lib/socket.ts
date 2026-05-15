'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let connectingPromise: Promise<Socket> | null = null;

export type GetTokenFn = () => Promise<string | null>;

const url = (): string => {
  const value = process.env.NEXT_PUBLIC_AGENT_RUNTIME_URL;
  if (!value) throw new Error('NEXT_PUBLIC_AGENT_RUNTIME_URL não definido');
  return value;
};

/**
 * Singleton de socket. Reusa instância já conectada; conexões concorrentes
 * compartilham a mesma promise pra evitar dois sockets vivos.
 */
export const getSocket = async (getToken: GetTokenFn): Promise<Socket> => {
  if (socket?.connected) return socket;
  if (connectingPromise) return connectingPromise;

  const token = await getToken();
  connectingPromise = new Promise<Socket>((resolve, reject) => {
    const s = io(url(), {
      auth: { token: token ?? '' },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    });
    s.once('connect', () => {
      socket = s;
      connectingPromise = null;
      resolve(s);
    });
    s.once('connect_error', (err) => {
      connectingPromise = null;
      s.close();
      reject(err);
    });
  });

  return connectingPromise;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
