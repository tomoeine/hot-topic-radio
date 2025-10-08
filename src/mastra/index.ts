
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { developerHotTopicWorkflow } from './workflows/developer-hot-topic-workflow';
import { developerHotTopicAgent } from './agents/developer-hot-topic-agent';

export const mastra = new Mastra({
  workflows: { developerHotTopicWorkflow },
  agents: { developerHotTopicAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
