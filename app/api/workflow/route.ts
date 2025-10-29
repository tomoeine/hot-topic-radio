import { NextRequest } from 'next/server';

// Vercel環境に対応するための設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分のタイムアウト

// Mastraのimportを遅延ロード
async function getMastra() {
  try {
    const { mastra } = await import('@/src/mastra');
    return { mastra, error: null };
  } catch (error) {
    console.error('Failed to load Mastra:', error);
    return {
      mastra: null,
      error: error instanceof Error ? error : new Error('Unknown Mastra import error'),
    };
  }
}

// Vercel環境でのCORS対応
export async function OPTIONS(_request: NextRequest) {
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
    // デバッグ: POSTメソッドが呼ばれているか確認
    console.warn('POST method called at:', new Date().toISOString());
    
    // 環境変数の確認（Vercel環境での問題を早期発見）
    console.warn('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    });

    const body = await request.json();
    const { target_date } = body;

    // デバッグ用の早期リターン（Mastraの初期化をスキップ）
    if (process.env.DEBUG_SKIP_MASTRA === 'true') {
      console.warn('DEBUG_SKIP_MASTRA is enabled, returning early');
      return new Response(
        JSON.stringify({
          message: 'Debug mode: Mastra initialization skipped',
          target_date,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.warn('Initializing Mastra workflow...');
    const { mastra, error: mastraError } = await getMastra();
    
    if (mastraError || !mastra) {
      console.error('Mastra initialization failed:', mastraError);
      return new Response(
        JSON.stringify({
          error: 'Failed to initialize Mastra',
          details: mastraError?.message || 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

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
          console.warn('Creating workflow run with input:', { target_date });
          const run = await workflow.createRunAsync();
          
          console.warn('Starting workflow stream...');
          const streamResult = await run.stream({
            inputData: target_date ? { target_date } : undefined,
          });

          // ストリームからイベントを受け取る
          const reader = streamResult.stream.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            console.warn('Received event:', value);
            
            // イベントをJSON文字列に変換して転送
            controller.enqueue(
              encoder.encode(JSON.stringify(value) + '\n')
            );
          }

          console.warn('Workflow stream completed');

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


