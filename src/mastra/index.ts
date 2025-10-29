
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { developerHotTopicWorkflow } from './workflows/developer-hot-topic-workflow';
import { developerHotTopicAgent } from './agents/developer-hot-topic-agent';

export const mastra = new Mastra({
  workflows: { developerHotTopicWorkflow },
  agents: { developerHotTopicAgent },
  // Vercel環境ではstorageを無効化（メモリのみで動作）
  // storage: new LibSQLStore({
  //   url: ":memory:",
  // }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
