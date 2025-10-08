import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GoogleVoice } from '@mastra/voice-google';

const voice = new GoogleVoice();

export const ttsTool = createTool({
  id: 'tts',
  description: 'Convert text to speech',
  inputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ context }) => {
    return await voice.speak(context.text, {
      speaker: 'ja-JP-Wavenet-B',
      languageCode: 'ja-JP',
    });
  },
});