# makuai(幕間)

エンタメ特化の同行者日程調整サービス(調整さん代替)。観劇・ライブ・推し活向けに、公演スロット単位で「誰がどの回に行けるか」を可視化する。

**まず `docs/REQUIREMENTS.md` を読むこと。** 2026-07-05 の構想セッションで固めたコンセプト・確定事項・未決事項がすべてそこにある。開発手順・デプロイは `README.md`。

## 現在のフェーズ

MVP 実装済み(2026-07-05)。Google ログイン、イベント作成(公演スロット)、○△×回答、集計マトリクス、ステータス管理(open/suspended/closed)、確定(confirm)まで動く。実際の Google ログインには OAuth クライアントの設定(README 参照)が必要。未着手: 常設NGルール、カレンダー free/busy 取り込み、確定のカレンダー出力、通知。

## 開発フロー(必須ルール)

1. 作業は必ず GitHub Issue に起票してから始める(なければ先に作る)
2. ブランチは `develop` から切る。命名は `feat/<issue番号>-<内容>` / `fix/<issue番号>-<内容>`(例: `feat/1-ogp-favicon`)
3. PR は **develop に対して**出す。`develop` / `main` への直接 push はしない
4. develop 環境(https://makuai-develop.shino3.workers.dev、`npm run deploy:dev`)で動作確認してから、本番リリース時に develop → main の PR を出す
5. develop の URL は知っている人がアクセスできて良い扱い

リモートは git@github.com:ShinoharaTa/makuai.git。

## スタック(確定)

- Cloudflare Workers + D1 + SvelteKit(adapter-cloudflare)+ Drizzle ORM + Better Auth(Google ログイン、全員アカウント必須)
- 運用コストゼロ(無料枠内)が必須要件。Firebase 等の別エコシステムは足さない
- D1/認証インスタンスはシングルトン禁止。`src/hooks.server.ts` でリクエストごとに生成して `locals` へ注入
- ステータス遷移・回答可否のガードは `src/lib/server/guards.ts` に集約。**すべての form action の先頭で検証**(UI の disabled は補助にすぎない)。closed は終端で、participant の INSERT 自体を拒否する

## 絶対に守る設計原則

- カレンダー取り込みは free/busy のみ。予定のタイトル・内容は**取得すらしない**。
- NG理由は表示しない・保持しない(answers にコメント系カラムを作らない)。
- イベント確定フローは Google 非依存。カレンダー連携は出力先の1つに過ぎない。
- トーンはビジネスではなくエンタメ寄り(開幕・終演・幕間などの言い回し)。
