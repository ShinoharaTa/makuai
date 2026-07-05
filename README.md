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

## ブランチ運用

- `develop` — 開発ブランチ。動作確認は develop 環境(`makuai-develop` Worker)で行う
- `main` — 本番。develop で確認できたものを取り込んでから本番デプロイ

develop 環境の URL は「知っている人はアクセスできて OK」の扱い(認証自体は本番同様 Google ログイン必須)。

## デプロイ(develop 環境)

初回のみ:

1. `npx wrangler login`
2. `npx wrangler d1 create makuai-develop` → 発行された `database_id` を `wrangler.jsonc` の `env.develop` に記入
3. `npm run db:migrate:dev`
4. `npm run deploy:dev` → 表示された workers.dev URL を `env.develop.vars.BETTER_AUTH_URL` に記入して再デプロイ
5. Google OAuth クライアントのリダイレクト URI に `https://<develop URL>/api/auth/callback/google` を追加
6. シークレット登録:
   ```sh
   npx wrangler secret put GOOGLE_CLIENT_ID --env develop
   npx wrangler secret put GOOGLE_CLIENT_SECRET --env develop
   npx wrangler secret put BETTER_AUTH_SECRET --env develop   # openssl rand -hex 32 などで生成
   ```

以後は `npm run deploy:dev`(スキーマ変更があれば先に `npm run db:migrate:dev`)。

## デプロイ(本番)

1. `npx wrangler d1 create makuai` → 発行された `database_id` を `wrangler.jsonc`(トップレベル)に記入
2. `npm run db:migrate:remote`
3. 本番用リダイレクト URI(`https://<本番URL>/api/auth/callback/google`)を OAuth クライアントに追加
4. `wrangler.jsonc` の `vars.BETTER_AUTH_URL` を本番 URL に変更
5. シークレット登録(`--env` なし):
   ```sh
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put BETTER_AUTH_SECRET
   ```
6. `npm run deploy`

## イベントステータスと確定

ステータスは **`open`(募集OK)⇄ `suspended`(募集停止)の2値トグル**で、終端状態はない。

| ステータス | 意味 | できること |
|---|---|---|
| `open`(募集OK) | 回答受付中 | 回答の追加・変更、スロットの追加・中止・復活 |
| `suspended`(募集停止) | 回答を一時停止 | スロットの日時変更(この状態でのみ可)・中止・追加。いつでも再開できる |

**日程の確定(`confirmed_slot_id`)はステータスから独立した属性。** 確定しても回答は止まらず、確定の変更・解除も可能。確定中のスロットは中止できない(先に確定解除が必要)。回答を締め切りたい場合は募集停止を使う(いつでも解除可)。

ガードはすべて `src/lib/server/guards.ts` に集約され、全 form action の先頭で検証される(UI の disabled は補助)。
