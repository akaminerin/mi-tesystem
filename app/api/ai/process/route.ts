import { env } from "cloudflare:workers";
import { CloudflareWorkersAIService } from "../../../../lib/ai/cloudflare-workers-ai-service";
import { AIFreeLimitExceededError } from "../../../../lib/ai/ai-service";
import { GoogleSheetsService } from "../../../../lib/google-sheets-service";
import { logOperation } from "../../../../lib/privacy-safe-logger";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const started = Date.now();
  logOperation({ event: "meeting.ai", outcome: "started" });
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const projectId = form.get("projectId");
    if (!(audio instanceof File) || typeof projectId !== "string") return Response.json({ error: "録音データが不正です。" }, { status: 400 });
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES || !audio.type.startsWith("audio/")) return Response.json({ error: "録音データの形式またはサイズが不正です。" }, { status: 400 });
    const previous = await new GoogleSheetsService(env as unknown as Record<string, string | undefined>).getProject(projectId);
    const service = new CloudflareWorkersAIService((env as unknown as { AI: { run(model: string, input: unknown): Promise<unknown> } }).AI);
    const transcript = await service.transcribeAudio(await audio.arrayBuffer(), audio.type);
    if (!transcript) return Response.json({ error: "音声から発言を認識できませんでした。" }, { status: 422, headers: { "cache-control": "no-store" } });
    const result = await service.summarizeMeeting({ transcript, previous });
    logOperation({ event: "meeting.ai", outcome: "succeeded", status: 200, elapsedMs: Date.now() - started });
    return Response.json({ transcript, result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const limited = error instanceof AIFreeLimitExceededError;
    const status = limited ? 429 : 500;
    logOperation({ event: "meeting.ai", outcome: "failed", status, elapsedMs: Date.now() - started });
    return Response.json({ code: limited ? "AI_FREE_LIMIT" : "AI_PROCESSING_FAILED", error: limited ? error.message : "AI処理に失敗しました。時間をおいて再度お試しください。" }, { status, headers: { "cache-control": "no-store" } });
  }
}

