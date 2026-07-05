# makuai(幕間)

エンタメ特化の同行者日程調整サービス。観劇・ライブ・推し活向けに、公演スロット単位で「誰がどの回に行けるか」を可視化する。コンセプトは [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) を参照。

## 技術スタック

- **Cloudflare Workers + D1**(無料枠で運用コストゼロ)
- **SvelteKit**(adapter-cloudflare、API 同居)
- **Drizzle ORM** + drizzle-kit マイグレーション
- **Better Auth** + Google ログイン(全員アカウント必須)

## ローカル開発

```sh
npm install
cp .dev.vars.example .dev.vars   # Google OAuth クライアント情報を記入
npm run db:migrate:local          # ローカル D1 にマイグレーション適用
npm run dev                       # http://localhost:5173
```

Google OAuth クライアント(ローカル用)は Google Cloud Console で作成し、
承認済みリダイレクト URI に `http://localhost:5173/api/auth/callback/google` を登録する。

本番同等の Workers ランタイムで確認する場合:

```sh
npm run preview   # build + wrangler dev(http://localhost:8787)
```

> **注意**: Better Auth は `BETTER_AUTH_URL` とアクセス URL のオリジンが一致していないと
> `/api/auth/*` が 404 になる。`wrangler dev`(port 8787)で試すときは
> `.dev.vars` の `BETTER_AUTH_URL` を `http://localhost:8787` に合わせること。

## スキーマ変更

```sh
# src/lib/server/db/schema.ts を編集後
npm run db:generate       # migrations/ に SQL 生成
npm run db:migrate:local  # ローカルに適用
```

認証テーブル(user / session / account / verification)は Better Auth CLI 生成
(`src/lib/server/db/auth-schema.ts`)。認証設定を変えた場合は再生成:

```sh
npx @better-auth/cli generate --config scripts/auth-cli-config.ts --output src/lib/server/db/auth-schema.ts --yes
```

## デプロイ

1. `npx wrangler login`
2. `npx wrangler d1 create makuai` → 発行された `database_id` を `wrangler.jsonc` に記入
3. `npm run db:migrate:remote`
4. 本番用 Google OAuth クライアントを作成(リダイレクト URI: `https://<デプロイ先>/api/auth/callback/google`)
5. `wrangler.jsonc` の `vars.BETTER_AUTH_URL` をデプロイ先 URL に変更
6. シークレット登録:
   ```sh
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put BETTER_AUTH_SECRET   # openssl rand -hex 32 などで生成
   ```
7. `npm run deploy`

## イベントステータス

| ステータス | 意味 | できること |
|---|---|---|
| `open`(募集中) | 回答受付中 | 回答の追加・変更、スロット追加 |
| `suspended`(募集停止) | 候補日の調整中 | スロットの日時変更・中止・追加(回答はブロック)。`open` に戻せる |
| `closed`(募集終了) | 終端。戻せない | 何も変更できない。回答・参加者の追加はサーバー側で恒久ブロック |

確定(confirm)は「確定スロットの記録 + `closed` への遷移」を同時に行う。
ガードはすべて `src/lib/server/guards.ts` に集約され、全 form action の先頭で検証される(UI の disabled は補助)。
