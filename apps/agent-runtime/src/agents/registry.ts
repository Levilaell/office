import {
  runCoordenadorAtendimento,
  type CoordenadorInput,
  type CoordenadorOutput,
} from './atendimento/coordenador/index.js';
import {
  runEspecialistaOperacional,
  type EspecialistaOperacionalInput,
  type EspecialistaOperacionalOutput,
} from './atendimento/especialista_operacional/index.js';
import { runRouter, type RouterInput, type RouterOutput } from './router/index.js';
import type { AgentHandler } from './types.js';

/**
 * Registry de agentes disponíveis pra execução. A chave bate com
 * `agents.agent_key` no DB e com o `agentKey` que viaja no payload do job
 * BullMQ — é assim que o worker resolve qual handler invocar.
 *
 * Sprint 1.2 adiciona `atendimento.coordenador`.
 * Sprint 1.3 adiciona `atendimento.especialista_operacional`.
 */
export const AGENT_HANDLERS: Record<string, AgentHandler> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers têm tipos específicos; o registry é poliglota por design.
  router: runRouter as AgentHandler<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers têm tipos específicos; o registry é poliglota por design.
  'atendimento.coordenador': runCoordenadorAtendimento as AgentHandler<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers têm tipos específicos; o registry é poliglota por design.
  'atendimento.especialista_operacional': runEspecialistaOperacional as AgentHandler<any, any>,
};

export const getAgentHandler = (agentKey: string): AgentHandler => {
  const handler = AGENT_HANDLERS[agentKey];
  if (!handler) {
    throw new Error(`agent handler desconhecido: agentKey=${agentKey}`);
  }
  return handler;
};

export type { RouterInput, RouterOutput };
export type { CoordenadorInput, CoordenadorOutput };
export type { EspecialistaOperacionalInput, EspecialistaOperacionalOutput };
