// better-call の signCookieValue と同一の署名を計算する
import { webcrypto } from 'node:crypto';

const [, , secret, token] = process.argv;
const key = await webcrypto.subtle.importKey(
	'raw',
	new TextEncoder().encode(secret),
	{ name: 'HMAC', hash: 'SHA-256' },
	false,
	['sign']
);
const sig = await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
console.log(encodeURIComponent(`${token}.${b64}`));
