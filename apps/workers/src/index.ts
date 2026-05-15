import { health } from '@office/shared-domain';

// Placeholder: workers BullMQ vão ser registrados aqui.
// Sem Redis configurado ainda — registramos só um stub que loga e fica vivo.
// Cada worker real fica em src/workers/<name>.ts e é importado aqui.

const main = async (): Promise<void> => {
  const result = health();
  console.log(`[workers] boot ok=${result.ok}`);

  // Mantém o processo vivo pra `pnpm dev` em paralelo via turbo.
  // Quando Redis entrar, substituir por `new Worker(...)` da BullMQ.
  setInterval(() => {
    // heartbeat silencioso
  }, 30_000);
};

void main();
