import { env } from "cloudflare:workers";
import { GoogleSheetsService } from "../../../../lib/google-sheets-service";
import { normalizeMeetingResult } from "../../../../lib/meeting-types";
import { logOperation } from "../../../../lib/privacy-safe-logger";

export async function POST(request: Request) {
  const started = Date.now();
  logOperation({ event: "meeting.confirm", outcome: "started" });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.projectId !== "string" || typeof body.previousStatus !== "string" || typeof body.transcript !== "string") return Response.json({ error: "確定データが不正です。" }, { status: 400 });
    await new GoogleSheetsService(env as unknown as Record<string, string | undefined>).confirm({
      projectId: body.projectId,
      previousStatus: body.previousStatus,
      transcript: body.transcript,
      result: normalizeMeetingResult(body.result),
    });
    logOperation({ event: "meeting.confirm", outcome: "succeeded", status: 200, elapsedMs: Date.now() - started });
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    logOperation({ event: "meeting.confirm", outcome: "failed", status: 503, elapsedMs: Date.now() - started });
    return Response.json({ error: "Googleスプレッドシートへ保存できませんでした。内容は確定されていません。" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

