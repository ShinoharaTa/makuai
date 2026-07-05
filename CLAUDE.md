# makuai(幕間)

同行者日程調整サービス(調整さん代替)。日時固定のスロット単位で「誰がどの日時なら行けるか」を可視化する。ライブ・観劇などのエンタメ発祥だが、**用途はエンタメに限定しない**(オフ会・カラオケ・旅行なども対象。2026-07-05 決定 #15)。

**まず `docs/REQUIREMENTS.md` を読むこと。** 2026-07-05 の構想セッションで固めたコンセプト・確定事項・未決事項がすべてそこにある(冒頭の更新注記も読むこと)。開発手順・デプロイは `README.md`。

## 現在のフェーズ

MVP 実装済み(2026-07-05)。Google ログイン、イベント作成(日時スロット)、○△×回答、集計マトリクス、ステータス(open ⇄ suspended の2値トグル)、日程確定(ステータスから独立、変更・解除可)まで動く。実際の Google ログインには OAuth クライアントの設定(README 参照)が必要。残タスクは GitHub Issues 参照。

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
- 回答可否・権限のガードは `src/lib/server/guards.ts` に集約。**すべての form action の先頭で検証**(UI の disabled は補助にすぎない)。ステータスに終端はなく(closed は 2026-07-05 に廃止 #14)、回答をブロックするのは suspended のみ。日程確定はステータスと独立した属性で、変更・解除可能
- `use:enhance` は `onsubmit` の `preventDefault()` を無視する。確認ダイアログは enhance コールバックの `cancel()` で実装すること(#13 の教訓)

## 絶対に守る設計原則

- カレンダー取り込みは free/busy のみ。予定のタイトル・内容は**取得すらしない**。
- NG理由は表示しない・保持しない(answers にコメント系カラムを作らない)。
- イベント確定フローは Google 非依存。カレンダー連携は出力先の1つに過ぎない。
- トーンは軽やかに、ただし**特定ジャンルに限定しない**。機能・UI の説明に劇場用語(公演・開演・終演・開幕など)を使わない。ブランド名「幕間 / makuai」と緞帳モチーフのビジュアルはブランドとして維持。
