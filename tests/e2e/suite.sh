#!/usr/bin/env bash
# サーバー側ガードとダッシュボードの E2E スイート(curl・UI 迂回)。
# 前提: run.sh がフィクスチャ(u_alice/u_bob/u_carol + セッション)を投入済み。
set -u
cd "$(dirname "$0")/../.."

BASE="${BASE:-http://localhost:4173}"
SECRET=$(grep BETTER_AUTH_SECRET .dev.vars | cut -d= -f2)
ALICE="better-auth.session_token=$(node tests/e2e/sign-cookie.mjs "$SECRET" tok_alice_0000000000000000)"
BOB="better-auth.session_token=$(node tests/e2e/sign-cookie.mjs "$SECRET" tok_bob_000000000000000000)"
CAROL="better-auth.session_token=$(node tests/e2e/sign-cookie.mjs "$SECRET" tok_carol_0000000000000000)"
ORIGIN="Origin: $BASE"
ACCEPT="Accept: text/html"

PASS=0; FAIL=0
check() { # check <desc> <expected> <actual>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ok: $1"
  else FAIL=$((FAIL+1)); echo "  NG: $1 (expected: $2, got: $3)"; fi
}

d1_json() { # d1_json <sql> <node-expr on r(=results)>
  npx wrangler d1 execute makuai --local --json --command "$1" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s)[0].results;console.log($2)})"
}

create_event() { # create_event <title> <date1> <date2> <date3> -> event id
  curl -s -o /dev/null -w '%{redirect_url}' -X POST "$BASE/events/new?/create" \
    -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" \
    --data-urlencode "title=$1" \
    --data-urlencode "slot_date=$2" --data-urlencode 'slot_time=13:00' --data-urlencode 'slot_label=昼の部' \
    --data-urlencode "slot_date=$3" --data-urlencode 'slot_time=18:00' --data-urlencode 'slot_label=夜の部' \
    --data-urlencode "slot_date=$4" --data-urlencode 'slot_time=12:00' --data-urlencode 'slot_label=最終日' \
    | sed 's|.*/e/||'
}

slots_of() {
  d1_json "SELECT id FROM slots WHERE event_id='$1' ORDER BY date, start_time" "r.map(x=>x.id).join(' ')"
}

echo "=== ガード編 ==="

echo "== 1. イベント作成"
EID=$(create_event 'E2E ガード検証' 2026-08-01 2026-08-01 2026-08-02)
check "作成後 /e/<id> へリダイレクト" "yes" "$([ -n "$EID" ] && [[ "$EID" != *"/"* ]] && echo yes || echo no)"
read -r -a SLOTS <<< "$(slots_of "$EID")"
S1=${SLOTS[0]}; S2=${SLOTS[1]}; S3=${SLOTS[2]}
check "スロットが3件できている" "3" "${#SLOTS[@]}"

echo "== 2. 回答(○△×)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" \
  --data-urlencode "slot_$S1=yes" --data-urlencode "slot_$S2=maybe" --data-urlencode "slot_$S3=no")
check "回答 POST が成功" "200" "$CODE"
CNT=$(d1_json "SELECT COUNT(*) c FROM answers a JOIN participants p ON a.participant_id=p.id WHERE p.event_id='$EID' AND p.user_id='u_bob'" "r[0].c")
check "回答が3行保存" "3" "$CNT"

echo "== 3. 再回答は上書き(重複行なし)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_$S1=maybe")
check "再回答 POST が成功" "200" "$CODE"
ROW=$(d1_json "SELECT COUNT(*) c, MAX(mark) m FROM answers a JOIN participants p ON a.participant_id=p.id WHERE p.event_id='$EID' AND p.user_id='u_bob' AND a.slot_id='$S1'" "r[0].c+':'+r[0].m")
check "1行のまま maybe に更新" "1:maybe" "$ROW"

echo "== 4. 非主催者は manage 操作不可"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/suspend" -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "非主催者の suspend は 403" "403" "$CODE"

echo "== 5. open 中: 日時変更は不可、中止・復活は可能"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/updateSlot" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S1" \
  --data-urlencode 'date=2026-08-09' --data-urlencode 'start_time=14:00' --data-urlencode 'label=昼の部')
check "open 中の updateSlot は 409" "409" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/cancelSlot" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S3")
check "open 中の cancelSlot は成功" "200" "$CODE"
CC=$(d1_json "SELECT is_cancelled c FROM slots WHERE id='$S3'" "r[0].c")
check "スロットが中止状態" "1" "$CC"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/restoreSlot" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S3")
check "open 中の restoreSlot は成功" "200" "$CODE"

echo "== 6. 募集停止 → 回答ブロック"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/suspend" -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "suspend 成功" "200" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_$S1=yes")
check "suspended 中の回答は 409" "409" "$CODE"

echo "== 7. suspended 中にスロット変更・中止"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/updateSlot" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S1" \
  --data-urlencode 'date=2026-08-08' --data-urlencode 'start_time=13:30' --data-urlencode 'label=昼の部')
check "日時変更成功" "200" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/cancelSlot" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S3")
check "スロット中止成功" "200" "$CODE"

echo "== 8. 再開 → 中止スロットへの回答は保存されない"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/reopen" -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "reopen 成功" "200" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_$S3=yes" --data-urlencode "slot_$S1=yes")
check "回答 POST 自体は成功" "200" "$CODE"
MARK=$(d1_json "SELECT mark FROM answers a JOIN participants p ON a.participant_id=p.id WHERE p.user_id='u_bob' AND a.slot_id='$S3'" "r[0].mark")
check "中止スロットの回答は no のまま(無視)" "no" "$MARK"

echo "== 9. 中止スロットは確定不可"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/confirm" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S3")
check "中止スロットの confirm は 409" "409" "$CODE"

echo "== 10. 確定はステータスと独立(確定後も回答できる)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/confirm" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S1")
check "confirm 成功" "200" "$CODE"
ST=$(d1_json "SELECT status, confirmed_slot_id FROM events WHERE id='$EID'" "r[0].status+':'+(r[0].confirmed_slot_id?'set':'null')")
check "status は open のまま・確定記録" "open:set" "$ST"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_$S1=no")
check "確定後も既存参加者は回答変更できる" "200" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $CAROL" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_$S1=yes")
check "確定後も新規参加できる" "200" "$CODE"
CNT=$(d1_json "SELECT COUNT(*) c FROM participants WHERE event_id='$EID' AND user_id='u_carol'" "r[0].c")
check "新規参加者の participant 行が作られる" "1" "$CNT"

echo "== 11. 確定の保護と変更・解除"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/cancelSlot" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S1")
check "確定中スロットの中止は 409" "409" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/confirm" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=$S2")
check "別候補への確定変更は 200" "200" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/unconfirm" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "確定解除は 200" "200" "$CODE"
CF=$(d1_json "SELECT confirmed_slot_id cf FROM events WHERE id='$EID'" "r[0].cf ?? 'null'")
check "confirmed_slot_id が null に戻る" "null" "$CF"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/unconfirm" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "未確定での解除は 409" "409" "$CODE"

echo "== 12. ステータストグルの二重適用防止"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/reopen" -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "open 中の reopen は 409" "409" "$CODE"

echo "== 13. 未ログインティーザー(情報リークなし)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/e/$EID")
check "未ログイン GET は 200(ティーザー)" "200" "$CODE"
BODY=$(curl -s "$BASE/e/$EID")
check "OGP タグが出る" "yes" "$(echo "$BODY" | grep -q 'og:title' && echo yes || echo no)"
check "参加者名がリークしない" "yes" "$(echo "$BODY" | grep -q 'ボブ' && echo no || echo yes)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/e/xxxxxxxxxxxxxxxxxxxxx")
check "存在しない ID は 404" "404" "$CODE"

echo
echo "=== ダッシュボード編 ==="
A=$(create_event 'ダッシュ検証A 部分回答' 2026-09-01 2026-09-01 2026-09-02)
read -r -a AS <<< "$(slots_of "$A")"
C=$(create_event 'ダッシュ検証C 確定済み' 2026-10-01 2026-10-01 2026-10-02)
read -r -a CS <<< "$(slots_of "$C")"
D=$(create_event 'ダッシュ検証D 過去分' 2026-01-10 2026-01-10 2026-01-11)
read -r -a DS <<< "$(slots_of "$D")"

curl -s -o /dev/null -X POST "$BASE/e/$A?/answer" -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_${AS[0]}=yes"
curl -s -o /dev/null -X POST "$BASE/e/$C?/answer" -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" \
  --data-urlencode "slot_${CS[0]}=yes" --data-urlencode "slot_${CS[1]}=no" --data-urlencode "slot_${CS[2]}=no"
curl -s -o /dev/null -X POST "$BASE/e/$D?/answer" -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_${DS[0]}=maybe"
curl -s -o /dev/null -X POST "$BASE/e/$C/manage?/confirm" -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=${CS[0]}"
curl -s -o /dev/null -X POST "$BASE/e/$D/manage?/confirm" -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_id=${DS[0]}"

echo "== 14. 参加者のダッシュボード"
DASH=$(curl -s "$BASE/" -H "Cookie: $BOB")
check "参加予定に将来確定+○" "yes" "$(echo "$DASH" | grep -q '参加予定' && echo "$DASH" | grep -q 'ダッシュ検証C' && echo yes || echo no)"
check "確定日時が出る" "yes" "$(echo "$DASH" | grep -q '10/1(木) 13:00' && echo yes || echo no)"
check "未回答バッジ(未回答 2)" "yes" "$(echo "$DASH" | grep -q '未回答 2' && echo yes || echo no)"
check "クイック回答フォーム" "yes" "$(echo "$DASH" | grep -q "action=\"/e/$A?/answer\"" && echo yes || echo no)"
check "過去のイベントに過去分" "yes" "$(echo "$DASH" | grep -q '過去のイベント' && echo "$DASH" | grep -q 'ダッシュ検証D' && echo yes || echo no)"

echo "== 15. クイック回答 → バッジ解消"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$A?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" \
  --data-urlencode "slot_${AS[1]}=maybe" --data-urlencode "slot_${AS[2]}=no")
check "回答 POST 成功" "200" "$CODE"
DASH2=$(curl -s "$BASE/" -H "Cookie: $BOB")
check "未回答バッジが消える" "yes" "$(echo "$DASH2" | grep -q '未回答 ' && echo no || echo yes)"

echo "== 16. 主催者のダッシュボード"
ADASH=$(curl -s "$BASE/" -H "Cookie: $ALICE")
check "主催チップ" "yes" "$(echo "$ADASH" | grep -q '>主催<' && echo yes || echo no)"
check "進行中に🎫確定チップ" "yes" "$(echo "$ADASH" | grep -q 'chip-confirmed' && echo yes || echo no)"
check "参加予定は出ない(○回答なし)" "yes" "$(echo "$ADASH" | grep -q '参加予定' && echo no || echo yes)"

echo
echo "=== 参加者操作編(#6) ==="

echo "== 17. 回答の取り消し(未回答に戻す)"
CNT_BEFORE=$(d1_json "SELECT COUNT(*) c FROM answers a JOIN participants p ON a.participant_id=p.id WHERE p.event_id='$EID' AND p.user_id='u_bob'" "r[0].c")
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_$S1=clear")
check "clear の POST が成功" "200" "$CODE"
CNT_AFTER=$(d1_json "SELECT COUNT(*) c FROM answers a JOIN participants p ON a.participant_id=p.id WHERE p.event_id='$EID' AND p.user_id='u_bob'" "r[0].c")
check "回答行が1減る" "$((CNT_BEFORE - 1))" "$CNT_AFTER"

echo "== 18. イベントごとの表示名"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" \
  --data-urlencode "display_name=遠征のボブ" --data-urlencode "slot_$S2=maybe")
check "表示名つき回答が成功" "200" "$CODE"
BODY=$(curl -s "$BASE/e/$EID" -H "Cookie: $ALICE")
check "マトリクスに表示名が出る" "yes" "$(echo "$BODY" | grep -q '遠征のボブ' && echo yes || echo no)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/answer" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" \
  --data-urlencode "display_name=" --data-urlencode "slot_$S2=maybe")
check "空欄で元の名前に戻せる" "200" "$CODE"
BODY=$(curl -s "$BASE/e/$EID" -H "Cookie: $ALICE")
check "表示名がリセットされる" "yes" "$(echo "$BODY" | grep -q '遠征のボブ' && echo no || echo yes)"

echo "== 19. イベントから退出"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/leave" \
  -H "Cookie: $CAROL" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "退出 POST が成功" "200" "$CODE"
CNT=$(d1_json "SELECT COUNT(*) c FROM participants WHERE event_id='$EID' AND user_id='u_carol'" "r[0].c")
check "participant 行が消える" "0" "$CNT"
CNT=$(d1_json "SELECT COUNT(*) c FROM answers a WHERE a.participant_id NOT IN (SELECT id FROM participants)" "r[0].c")
check "回答の孤児行がない(cascade)" "0" "$CNT"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID?/leave" \
  -H "Cookie: $CAROL" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "未参加での退出は 409" "409" "$CODE"

echo "== 20. イベント削除"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/deleteEvent" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "非主催者の削除は 403" "403" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/e/$EID/manage?/deleteEvent" \
  -H "Cookie: $ALICE" -H "$ORIGIN" -H "$ACCEPT" --data "")
check "主催者の削除は 303 リダイレクト" "303" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/e/$EID" -H "Cookie: $ALICE")
check "削除後の GET は 404" "404" "$CODE"
CNT=$(d1_json "SELECT (SELECT COUNT(*) FROM slots WHERE event_id='$EID') + (SELECT COUNT(*) FROM participants WHERE event_id='$EID') c" "r[0].c")
check "候補・参加者も cascade で消える" "0" "$CNT"

echo
echo "=== NGルール編(#3) ==="

echo "== 21. ルールの登録と一覧"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/settings/rules?/add" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" \
  --data-urlencode 'day=1' --data-urlencode 'day=2' --data-urlencode 'day=3' \
  --data-urlencode 'day=4' --data-urlencode 'day=5' \
  --data-urlencode 'start_time=09:00' --data-urlencode 'end_time=18:00')
check "ルール追加が成功" "200" "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/settings/rules?/add" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" \
  --data-urlencode 'day=1' --data-urlencode 'start_time=18:00' --data-urlencode 'end_time=09:00')
check "開始>=終了のルールは 400" "400" "$CODE"
RPAGE=$(curl -s "$BASE/settings/rules" -H "Cookie: $BOB")
check "一覧に表示される" "yes" "$(echo "$RPAGE" | grep -q '月・火・水・木・金 の 09:00〜18:00' && echo yes || echo no)"

echo "== 22. イベントページで下書き提案(平日昼=×、土曜=○)"
# 2026-08-03(月)13:00 / 2026-08-01(土)13:00 / 2026-08-08(土)18:00
R=$(create_event 'ルール検証' 2026-08-03 2026-08-01 2026-08-08)
read -r -a RS <<< "$(slots_of "$R")"
MON=${RS[1]}; SAT=${RS[0]}  # date順: 08-01(土)が先、08-03(月)が2番目
RBODY=$(curl -s "$BASE/e/$R" -H "Cookie: $BOB")
check "下書きバナーが出る" "yes" "$(echo "$RBODY" | grep -q '下書きしました' && echo yes || echo no)"
check "平日昼スロットは × がプリセット" "yes" "$(echo "$RBODY" | grep -o "name=\"slot_$MON\" value=\"no\"[^>]*" | grep -q checked && echo yes || echo no)"
check "土曜スロットは ○ がプリセット" "yes" "$(echo "$RBODY" | grep -o "name=\"slot_$SAT\" value=\"yes\"[^>]*" | grep -q checked && echo yes || echo no)"
CNT=$(d1_json "SELECT COUNT(*) c FROM answers a JOIN participants p ON a.participant_id=p.id WHERE p.event_id='$R'" "r[0].c")
check "提案だけでは回答は保存されない" "0" "$CNT"

echo "== 23. 回答済みスロットには提案しない"
curl -s -o /dev/null -X POST "$BASE/e/$R?/answer" -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "slot_$MON=yes"
RBODY2=$(curl -s "$BASE/e/$R" -H "Cookie: $BOB")
check "手動回答(○)がルール(×)より優先" "yes" "$(echo "$RBODY2" | grep -o "name=\"slot_$MON\" value=\"yes\"[^>]*" | grep -q checked && echo yes || echo no)"

echo "== 24. ルールなしユーザー・削除"
ABODY=$(curl -s "$BASE/e/$R" -H "Cookie: $ALICE")
check "ルールなしのアリスには提案が出ない" "yes" "$(echo "$ABODY" | grep -q '下書きしました' && echo no || echo yes)"
RID=$(d1_json "SELECT id FROM ng_rules WHERE user_id='u_bob' LIMIT 1" "r[0].id")
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/settings/rules?/remove" \
  -H "Cookie: $BOB" -H "$ORIGIN" -H "$ACCEPT" --data-urlencode "rule_id=$RID")
check "ルール削除が成功" "200" "$CODE"
CNT=$(d1_json "SELECT COUNT(*) c FROM ng_rules WHERE user_id='u_bob'" "r[0].c")
check "ルールが消えている" "0" "$CNT"

echo
echo "RESULT: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
