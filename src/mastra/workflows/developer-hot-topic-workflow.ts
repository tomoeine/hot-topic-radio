import { createStep, createWorkflow } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { ttsTool } from '../tools/tts-tool';

const generateHotTopic = createStep({
  id: 'generate-hot-topic',
  description: 'Generate a hot topic for a given topic',
  inputSchema: z.object({
    target_date: z.string().optional().describe('対象日付（YYYY-MM-DD形式）')
  }).optional(),
  outputSchema: z.object({
    topicsText: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('developerHotTopicAgent');
    if (!agent) {
      throw new Error('Developer hot topic agent not found');
    }

    const targetDate = inputData?.target_date;
    const prompt = targetDate 
      ? `${targetDate}の開発関連トピックを調べて教えて` 
      : `今日の開発関連トピックを調べて教えて`;
    
    console.warn('Prompt with target_date:', prompt, 'Target date:', targetDate);
    
    // Vercel環境ではメモリ機能を無効化
    const response = await agent.stream([{ role: 'user', content: prompt }]); 

    let topicsText = '';
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      topicsText += chunk;
    }

    return { topicsText };
  },
});

const tts = createStep({
  id: 'tts',
  description: 'Convert text to speech',
  inputSchema: z.object({
    topicsText: z.string(),
  }),
  outputSchema: z.object({
    topicsText: z.string(),
    audioData: z.any(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }
    
    // Mastraのツールとして正しく使用
    const runtimeContext = new RuntimeContext();
    
    if (!ttsTool?.execute) {
      throw new Error('TTS tool is not available');
    }
    
    const audioData = await ttsTool.execute({
      context: { text: inputData.topicsText },
      runtimeContext,
      suspend: () => Promise.resolve(),
    });
    
    return {
      topicsText: inputData.topicsText,
      audioData,
    };
  },
});

const developerHotTopicWorkflow = createWorkflow({
  id: 'developer-hot-topic-workflow',
  inputSchema: z.object({
    target_date: z.string().optional().describe('対象日付（YYYY-MM-DD形式）')
  }).optional(),
  outputSchema: z.object({
    topicsText: z.string(),
    audioData: z.any(),
  }),
})
.then(generateHotTopic)
.then(tts);

developerHotTopicWorkflow.commit();

export { developerHotTopicWorkflow };