type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getGoogleAccessToken(rawCredentials: string) {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const credentials = JSON.parse(rawCredentials) as ServiceAccount;
  if (!credentials.client_email || !credentials.private_key) throw new Error("Googleサービスアカウント設定が不正です。");
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = credentials.token_uri ?? "https://oauth2.googleapis.com/token";
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Google認証に失敗しました (${response.status})`);
  const result = await response.json() as { access_token: string; expires_in?: number };
  tokenCache = { token: result.access_token, expiresAt: Date.now() + Math.max(60, (result.expires_in ?? 3600) - 120) * 1000 };
  return result.access_token;
}

function pemToArrayBuffer(pem: string) {
  const binary = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}

function base64Url(text: string) { return base64UrlBytes(new TextEncoder().encode(text)); }
function base64UrlBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

