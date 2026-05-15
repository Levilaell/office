export interface HealthResult {
  ok: true;
}

export const health = (): HealthResult => ({ ok: true });
