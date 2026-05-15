// IMPORTANTE: Esse módulo precisa ser importado ANTES de qualquer código que
// instancie `Anthropic`. A ordem garante que o tracer global do OTEL esteja
// registrado quando o AnthropicInstrumentation aplicar o monkey-patch.
import { initLlmTracing } from '@office/shared-llm';
import { parseAgentRuntimeEnv } from '@office/shared-config';

const env = parseAgentRuntimeEnv();

initLlmTracing({
  langfusePublicKey: env.LANGFUSE_PUBLIC_KEY,
  langfuseSecretKey: env.LANGFUSE_SECRET_KEY,
  langfuseHost: env.LANGFUSE_HOST,
  serviceName: 'agent-runtime',
  environment: env.NODE_ENV,
});

export const agentRuntimeEnv = env;
