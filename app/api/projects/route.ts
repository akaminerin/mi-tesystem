import { env } from "cloudflare:workers";
import { GoogleSheetsService } from "../../../lib/google-sheets-service";
import { logOperation } from "../../../lib/privacy-safe-logger";

export async function GET() {
  const started = Date.now();
  logOperation({ event: "projects.bootstrap", outcome: "started" });
  try {
    const data = await new GoogleSheetsService(env as unknown as Record<string, string | undefined>).bootstrap();
    logOperation({ event: "projects.bootstrap", outcome: "succeeded", status: 200, elapsedMs: Date.now() - started });
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  } catch {
    logOperation({ event: "projects.bootstrap", outcome: "failed", status: 503, elapsedMs: Date.now() - started });
    return Response.json({ error: "Googleスプレッドシートから案件を取得できませんでした。接続設定を確認してください。" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

