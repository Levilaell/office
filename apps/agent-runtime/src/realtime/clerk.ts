import { verifyToken } from '@clerk/backend';

/**
 * Claims relevantes do JWT do Clerk em session v2.
 * `o.id` é o Clerk Organization ID; `o.rol` é o role do user na org.
 */
export type ClerkClaims = {
  sub: string;
  o?: { id: string; rol?: string };
  [k: string]: unknown;
};

export type VerifyClerkTokenInput = {
  secretKey: string;
};

/**
 * Valida o JWT do Clerk via JWKS (verifyToken faz fetch + cache da chave pública).
 * Retorna null se o token for inválido — caller traduz pra erro de handshake.
 */
export const verifyClerkToken = async (
  token: string,
  { secretKey }: VerifyClerkTokenInput,
): Promise<ClerkClaims | null> => {
  try {
    const payload = await verifyToken(token, { secretKey });
    return payload as ClerkClaims;
  } catch {
    return null;
  }
};
