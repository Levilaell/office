export function relativeTime(iso: string, now: Date = new Date()): string {
  const past = new Date(iso);
  const diffMs = now.getTime() - past.getTime();
  if (diffMs < 0) return 'agora';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} dia${days > 1 ? 's' : ''}`;
  return past.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function relativeFuture(iso: string, now: Date = new Date()): string {
  const future = new Date(iso);
  const diffMs = future.getTime() - now.getTime();
  if (diffMs <= 0) return 'expirado';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'em instantes';
  if (minutes < 60) return `em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `em ${hours} h`;
  const days = Math.floor(hours / 24);
  return `em ${days} dia${days > 1 ? 's' : ''}`;
}
