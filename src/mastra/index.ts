
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { developerHotTopicWorkflow } from './workflows/developer-hot-topic-workflow';
import { developerHotTopicAgent } from './agents/developer-hot-topic-agent';

// Vercel環境での設定
const isVercel = process.env.VERCEL === '1';

console.log('before mastra');
const mastra = new Mastra({
  workflows: { developerHotTopicWorkflow },
  agents: { developerHotTopicAgent },
  // Vercel環境ではstorageを完全に削除
  // storageがない場合、Mastraはメモリのみで動作する
  logger: new PinoLogger({
    name: 'Mastra',
    level: isVercel ? 'warn' : 'info', // Vercelではログレベルを下げる
  }),
})
console.log('after mastra');

export { mastra };
