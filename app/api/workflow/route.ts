import { mastra } from '@/src/mastra';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target_date } = body;

    const workflow = mastra.getWorkflow('developerHotTopicWorkflow');
    if (!workflow) {
      return new Response(
        JSON.stringify({ error: 'Workflow not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ストリーミングレスポンスを作成
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ワークフロー開始イベント
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'workflow-start',
                payload: { workflowId: 'developerHotTopicWorkflow' },
              }) + '\n'
            )
          );

          // ワークフローを実行（createRunAsync + stream）
          console.log('Creating workflow run with input:', { target_date });
          const run = await workflow.createRunAsync();
          
          console.log('Starting workflow stream...');
          const streamResult = await run.stream({
            inputData: target_date ? { target_date } : undefined,
          });

          // ストリームからイベントを受け取る
          const reader = streamResult.stream.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            console.log('Received event:', value);
            
            // イベントをJSON文字列に変換して転送
            controller.enqueue(
              encoder.encode(JSON.stringify(value) + '\n')
            );
          }

          console.log('Workflow stream completed');

          controller.close();
        } catch (error) {
          console.error('Workflow execution error:', error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'workflow-error',
                payload: {
                  error: error instanceof Error ? error.message : 'Unknown error',
                },
              }) + '\n'
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


