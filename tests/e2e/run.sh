#!/usr/bin/env bash
# E2E テストの実行環境を組み立てて suite.sh を回す。
# ローカル・CI 共通。ローカル D1(.wrangler/state)のアプリテーブルを消すので注意
# (auth の user/session もテスト用に入れ直す)。
set -eu
cd "$(dirname "$0")/../.."

PORT="${E2E_PORT:-4173}"
BASE="http://localhost:$PORT"

# .dev.vars がなければ(CI など)ダミーで作る。Google ログイン実体は E2E では使わない
if [ ! -f .dev.vars ]; then
	cat > .dev.vars <<EOF
GOOGLE_CLIENT_ID=e2e-placeholder.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=e2e-placeholder
BETTER_AUTH_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
BETTER_AUTH_URL=http://localhost:5173
EOF
	echo "[e2e] .dev.vars を生成しました"
fi

echo "[e2e] マイグレーション適用(ローカル D1)"
npx wrangler d1 migrations apply makuai --local > /dev/null

echo "[e2e] フィクスチャ投入"
NOW=$(node -e 'console.log(Date.now())')
FUTURE=$(node -e 'console.log(Date.now()+86400000*7)')
npx wrangler d1 execute makuai --local --command "
DELETE FROM answers; DELETE FROM participants; DELETE FROM slots; DELETE FROM events;
DELETE FROM session; DELETE FROM account; DELETE FROM user;
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
 ('u_alice', 'アリス(主催)', 'alice@example.com', 1, $NOW, $NOW),
 ('u_bob', 'ボブ', 'bob@example.com', 1, $NOW, $NOW),
 ('u_carol', 'キャロル', 'carol@example.com', 1, $NOW, $NOW);
INSERT INTO session (id, token, expires_at, created_at, updated_at, user_id) VALUES
 ('s_alice', 'tok_alice_0000000000000000', $FUTURE, $NOW, $NOW, 'u_alice'),
 ('s_bob', 'tok_bob_000000000000000000', $FUTURE, $NOW, $NOW, 'u_bob'),
 ('s_carol', 'tok_carol_0000000000000000', $FUTURE, $NOW, $NOW, 'u_carol');
" > /dev/null

echo "[e2e] dev サーバー起動(port $PORT)"
npm run dev -- --port "$PORT" --strictPort > /tmp/makuai-e2e-dev.log 2>&1 &
DEV_PID=$!
cleanup() {
	kill "$DEV_PID" 2>/dev/null || true
	wait "$DEV_PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 60); do
	if curl -sf -o /dev/null "$BASE/"; then break; fi
	if ! kill -0 "$DEV_PID" 2>/dev/null; then
		echo "[e2e] dev サーバーが起動に失敗しました"; tail -30 /tmp/makuai-e2e-dev.log; exit 1
	fi
	sleep 1
done
if ! curl -sf -o /dev/null "$BASE/"; then
	echo "[e2e] dev サーバーが 60 秒以内に応答しませんでした"; tail -30 /tmp/makuai-e2e-dev.log; exit 1
fi

echo "[e2e] スイート実行"
BASE="$BASE" bash tests/e2e/suite.sh
