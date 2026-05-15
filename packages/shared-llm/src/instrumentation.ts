import Anthropic from '@anthropic-ai/sdk';
import { AnthropicInstrumentation } from '@arizeai/openinference-instrumentation-anthropic';
import { LangfuseSpanProcessor, isDefaultExportSpan } from '@langfuse/otel';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';

export interface InitLlmTracingInput {
  langfusePublicKey: string;
  langfuseSecretKey: string;
  langfuseHost: string;
  serviceName: string;
  environment?: string;
}

let initialized = false;
let sdk: NodeSDK | null = null;

// O smart filter default da Langfuse aceita scope "openinference" /
// "openinference.*", mas:
// - o tracer emitido pelo openinference-anthropic se chama
//   "@arizeai/openinference-instrumentation-anthropic"
// - o span pai criado por llmCall em shared-llm carrega o scope
//   "@office/shared-llm"
// Sem custom predicate ambos seriam descartados silenciosamente — chamadas
// retornariam normal, mas nada chegaria no Langfuse.
export const LLM_TRACER_SCOPE = '@office/shared-llm';

const shouldExportLlmSpan = ({
  otelSpan,
}: {
  otelSpan: { instrumentationScope: { name: string } };
}): boolean => {
  if (isDefaultExportSpan(otelSpan as never)) return true;
  const scope = otelSpan.instrumentationScope.name;
  return (
    scope.startsWith('@arizeai/openinference') || scope === LLM_TRACER_SCOPE
  );
};

export const initLlmTracing = (input: InitLlmTracingInput): void => {
  if (initialized) return;

  if (process.env.LLM_TRACING_DEBUG === '1') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const spanProcessor = new LangfuseSpanProcessor({
    publicKey: input.langfusePublicKey,
    secretKey: input.langfuseSecretKey,
    baseUrl: input.langfuseHost,
    environment: input.environment ?? process.env.NODE_ENV ?? 'development',
    shouldExportSpan: shouldExportLlmSpan,
  });

  sdk = new NodeSDK({
    serviceName: input.serviceName,
    spanProcessors: [spanProcessor],
  });

  // Ordem importa: sdk.start() registra global TracerProvider, depois o
  // AnthropicInstrumentation captura o tracer em construção.
  sdk.start();

  const instrumentation = new AnthropicInstrumentation();
  instrumentation.manuallyInstrument(Anthropic);

  initialized = true;
};

export const shutdownLlmTracing = async (): Promise<void> => {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
  initialized = false;
};

export const isLlmTracingInitialized = (): boolean => initialized;
