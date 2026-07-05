-- 「募集終了(closed)」ステータスの廃止(#14)。
-- ステータスは open ⇄ suspended の2値になり、確定(confirmed_slot_id)は独立属性として残る。
-- 既存の closed イベントは suspended(募集停止)へ移行する。確定情報はそのまま保持。
UPDATE events SET status = 'suspended' WHERE status = 'closed';
