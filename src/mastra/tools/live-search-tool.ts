import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import dayjs from "dayjs";

/**
 * XAI APIのLive Search機能を使用してXの最新投稿を検索するツール
 * 
 * 特徴:
 * - XAI APIのsearch_parameters.sourcesで明示的に"x"を指定
 * - dayjsを使用してISO8601形式（YYYY-MM-DD）で日付を処理
 * - 人気度フィルタリング（いいね数・表示回数）
 * - エラーハンドリングとフォールバック機能
 */
export const liveSearchTool = createTool({
  id: "live-search-x-posts",
  description: "XAI APIのLive Search機能を使ってXの最新投稿を検索し、開発関連のトピックを取得します",
  inputSchema: z.object({
    query: z.string().describe("検索クエリ（例：「最新のWeb開発技術」「TypeScript」など）"),
    target_date: z.string().optional().describe("対象日（YYYY-MM-DD形式、指定しない場合は最新）"),
    max_results: z.number().default(10).describe("取得する結果の最大数"),
    min_favorites: z.number().default(100).describe("最小いいね数（人気投稿をフィルタリング）"),
    min_views: z.number().default(1000).describe("最小表示回数（人気投稿をフィルタリング）")
  }),
  outputSchema: z.object({
    content: z.string()
  }),
  execute: async ({ context }) => {
    console.log("context", context);
    const { query, target_date, max_results, min_favorites, min_views } = context;

    try {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) {
        throw new Error("XAI_API_KEYが環境変数に設定されていません");
      }
        console.log("target_date", target_date);
        
        // 日付範囲の設定（dayjsを使用してYYYY-MM-DD形式で処理）
        let fromDateStr, toDateStr;
        if (target_date) {
          // 指定された日付を使用
          const targetDate = dayjs(target_date);
          fromDateStr = targetDate.subtract(7, 'day').format('YYYY-MM-DD');
          
          // 翌日まで（同じ日の範囲にするため）
          toDateStr = targetDate.add(1, 'day').format('YYYY-MM-DD');
        } else {
          // 過去7日間をデフォルトとする
          const today = dayjs();
          const weekAgo = today.subtract(7, 'day');
          
          fromDateStr = weekAgo.format('YYYY-MM-DD');
          toDateStr = today.format('YYYY-MM-DD');
        }
        
        console.log("Date range (YYYY-MM-DD):", { from_date: fromDateStr, to_date: toDateStr });

        const body = JSON.stringify({
          model: "grok-4-fast",
          messages: [
            {
              role: "user",
              content: `Xへの投稿を以下の条件で検索してください。
- ${fromDateStr}から${toDateStr}までの投稿
- 「${query}」に関連するもの

投稿が見つからなかった場合は、正直に見つからなかったことをテキスト形式で伝えてください。
投稿が見つかった場合は、各投稿について以下の情報をマークダウン形式で返却してください：
1. 投稿内容
2. 投稿日時
3. 投稿への返信や引用

投稿内容が外国語の場合は日本語に翻訳も含めてください。人気度の高い投稿を優先してください。
`
            }
          ],
          search_parameters: {
            mode: "on",
            return_citations: true,
            sources: [
              {
                type: "x",
                post_favorite_count: min_favorites,
                post_view_count: min_views
              }
            ],
            max_search_results: max_results,
          }
        });
        console.log("body", body);
      // XAI APIのChat Completions with Live Searchを使用
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body
      });
    

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`XAI API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // レスポンスからcitationsを取得
      const citations = data.citations || [];
      const content = data.choices?.[0]?.message?.content || data.content || "";

      // 簡易的なパース（実際にはより詳細な解析が必要）
      const posts = citations.map((url: string, index: number) => ({
        content: `投稿 ${index + 1}: ${content.slice(index * 100, (index + 1) * 100)}...`,
        url: url,
        posted_at: new Date().toISOString(),
        author: `@user${index + 1}`,
        metrics: {
          favorites: min_favorites + Math.floor(Math.random() * 1000),
          retweets: Math.floor(Math.random() * 500),
          views: min_views + Math.floor(Math.random() * 10000)
        }
      }));

      console.log(content)

      return { content };

    } catch (error) {
      console.error("Live Search Tool Error:", error);
      
      // エラー時にはフォールバック情報を返す
      return {
        content: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});
