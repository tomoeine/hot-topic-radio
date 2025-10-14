import { mastra } from '@/src/mastra';
import { NextRequest } from 'next/server';

// Vercel環境に対応するための設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分のタイムアウト

// Vercel環境でのCORS対応
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // 環境変数の確認（Vercel環境での問題を早期発見）
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    });

    const body = await request.json();
    const { target_date } = body;

    const workflow = mastra.getWorkflow('developerHotTopicWorkflow');
    if (!workflow) {
      return new Response(
        JSON.stringify({ error: 'Workflow not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          } 
        }
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        } 
      }
    );
  }
}


