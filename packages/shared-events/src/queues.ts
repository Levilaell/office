import { Queue, Worker, type JobsOptions, type WorkerOptions } from 'bullmq';
import { AgentTaskJobPayload } from './schemas.js';
import { getRedis } from './redis.js';

const AGENT_TASKS_QUEUE = 'agent-tasks';

let agentTasksQueue: Queue<AgentTaskJobPayload> | null = null;

const getAgentTasksQueue = (): Queue<AgentTaskJobPayload> => {
  if (agentTasksQueue) return agentTasksQueue;
  agentTasksQueue = new Queue<AgentTaskJobPayload>(AGENT_TASKS_QUEUE, {
    connection: getRedis('bullmq'),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  return agentTasksQueue;
};

export type EnqueueOptions = {
  priority?: number;
  delay?: number;
  jobId?: string;
};

export const enqueueAgentTask = async (
  payload: AgentTaskJobPayload,
  opts: EnqueueOptions = {},
): Promise<string> => {
  const parsed = AgentTaskJobPayload.parse(payload);
  const queue = getAgentTasksQueue();
  const jobOpts: JobsOptions = {};
  if (opts.priority !== undefined) jobOpts.priority = opts.priority;
  if (opts.delay !== undefined) jobOpts.delay = opts.delay;
  if (opts.jobId !== undefined) jobOpts.jobId = opts.jobId;
  const job = await queue.add('run', parsed, jobOpts);
  if (!job.id) throw new Error('BullMQ não retornou jobId');
  return job.id;
};

export type CreateWorkerOptions = {
  concurrency?: number;
};

export const createAgentTasksWorker = (
  handler: (payload: AgentTaskJobPayload) => Promise<void>,
  opts: CreateWorkerOptions = {},
): Worker<AgentTaskJobPayload> => {
  const workerOptions: WorkerOptions = {
    connection: getRedis('bullmq'),
    concurrency: opts.concurrency ?? 5,
  };
  return new Worker<AgentTaskJobPayload>(
    AGENT_TASKS_QUEUE,
    async (job) => {
      const parsed = AgentTaskJobPayload.parse(job.data);
      await handler(parsed);
    },
    workerOptions,
  );
};

export const closeAgentTasksQueue = async (): Promise<void> => {
  if (!agentTasksQueue) return;
  await agentTasksQueue.close();
  agentTasksQueue = null;
};
