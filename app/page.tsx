'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [targetDate, setTargetDate] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('ここにステータスが表示されます。');
  const [resultText, setResultText] = useState('まだ実行されていません。');
  const [audioSrc, setAudioSrc] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // ページ読み込み時に今日の日付を設定
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setTargetDate(today);
    setStatus(`📅 対象日付を ${today} に設定しました`);
  }, []);

  const setTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    setTargetDate(today);
    setStatus(`📅 対象日付を ${today} に設定しました`);
  };

  const runWorkflow = async () => {
    if (!targetDate) {
      alert('対象日付を選択してください');
      return;
    }

    setIsRunning(true);
    setStatus(`🚀 ワークフローの実行を開始します (対象日: ${targetDate})...`);
    setResultText('');
    setAudioSrc('');

    try {
      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_date: targetDate }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('=== ストリーミング完了 ===');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 改行で分割してJSONオブジェクトを抽出
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最後の未完成行を保持

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log('Received event:', data.type, data);

              switch (data.type) {
                case 'workflow-start':
                  setStatus('🚀 ワークフロー開始...');
                  break;

                case 'start':
                  setStatus('🔄 ワークフロー実行中...');
                  break;

                case 'step-start':
                  const startStepId = data.payload?.id || 'unknown';
                  setStatus(`🔄 実行中: ${startStepId}`);
                  break;

                case 'step-result':
                  const resultStepId = data.payload?.id || 'unknown';
                  setStatus(`✅ 完了: ${resultStepId}`);

                  // generate-hot-topic ステップの結果（テキスト）
                  if (resultStepId === 'generate-hot-topic' && data.payload?.output?.topicsText) {
                    setResultText(data.payload.output.topicsText);
                  }

                  // tts ステップの結果（テキスト + 音声データ）
                  if (resultStepId === 'tts' && data.payload?.output) {
                    // テキスト結果を表示
                    if (data.payload.output.topicsText) {
                      setResultText(data.payload.output.topicsText);
                    }

                    // 音声データを処理
                    if (data.payload.output.audioData) {
                      try {
                        console.log('Processing TTS audio data...');
                        const audioData = data.payload.output.audioData;
                        
                        // 音声データの構造を確認
                        let audioBuffer = null;
                        
                        if (audioData._readableState?.buffer?.[0]?.data) {
                          // ReadableState からバイナリデータを取得
                          const bufferData = audioData._readableState.buffer[0].data;
                          audioBuffer = new Uint8Array(bufferData);
                        } else if (audioData.data) {
                          audioBuffer = new Uint8Array(audioData.data);
                        } else if (typeof audioData === 'string') {
                          // Base64文字列の場合
                          const binaryString = atob(audioData);
                          audioBuffer = new Uint8Array(binaryString.length);
                          for (let i = 0; i < binaryString.length; i++) {
                            audioBuffer[i] = binaryString.charCodeAt(i);
                          }
                        }

                        if (audioBuffer) {
                          const blob = new Blob([audioBuffer], { type: 'audio/wav' });
                          const audioUrl = URL.createObjectURL(blob);
                          setAudioSrc(audioUrl);
                          setStatus('🎵 音声準備完了！再生ボタンを押してください。');
                        } else {
                          console.error('音声データの形式が不明です:', audioData);
                          setStatus('⚠️ テキスト完了、音声データの処理に失敗しました。');
                        }
                      } catch (audioError) {
                        console.error('音声処理エラー:', audioError);
                        setStatus('⚠️ テキスト完了、音声処理でエラーが発生しました。');
                      }
                    }
                  }
                  break;

                case 'step-finish':
                  const finishStepId = data.payload?.id || 'unknown';
                  console.log(`Step finished: ${finishStepId}`);
                  break;

                case 'finish':
                  setStatus('🎉 ワークフロー完了！');
                  break;

                case 'error':
                  throw new Error(
                    data.payload?.error || 'ワークフローエラー'
                  );
              }
            } catch (e) {
              console.error('JSONパースエラー:', e, 'Line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('エラー詳細:', error);
      setStatus(
        `❌ エラーが発生しました: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setIsRunning(false);
    }
  };

  // 古いaudioSrcをクリーンアップ
  useEffect(() => {
    return () => {
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
            🎙️ Hot Topic Radio
          </h1>

          {/* 日付選択エリア */}
          <div className="mb-8 p-6 bg-gray-50 rounded-xl">
            <label
              htmlFor="targetDate"
              className="block text-lg font-semibold text-gray-700 mb-3"
            >
              対象日付：
            </label>
            <div className="flex gap-3">
              <input
                type="date"
                id="targetDate"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
              <button
                onClick={setTodayDate}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                今日の日付
              </button>
            </div>
          </div>

          {/* 実行ボタン */}
          <button
            onClick={runWorkflow}
            disabled={isRunning}
            className="w-full py-4 text-xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isRunning ? '実行中...' : 'ワークフローを実行'}
          </button>

          {/* ステータス */}
          <p className="mt-6 text-center text-lg italic text-gray-600 min-h-[2rem]">
            {status}
          </p>

          {/* 実行結果テキスト */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              📝 実行結果テキスト
            </h2>
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 min-h-[200px]">
              <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans">
                {resultText}
              </pre>
            </div>
          </div>

          {/* 音声再生 */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              🎵 再生
            </h2>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
              {audioSrc ? (
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  controls
                  className="w-full"
                  onPlay={() => console.log('Audio playing')}
                />
              ) : (
                <p className="text-center text-gray-500 py-4">
                  音声データはまだありません
                </p>
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="mt-8 text-center text-gray-600">
          <p className="text-sm">
            Powered by Next.js + Mastra + Xai
          </p>
        </div>
      </div>
    </div>
  );
}
