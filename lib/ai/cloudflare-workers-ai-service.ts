import { AIFreeLimitExceededError, type AIService, type SummarizeMeetingInput } from "./ai-service";
import { normalizeMeetingResult, type MeetingAIResult } from "../meeting-types";

type WorkersAI = { run(model: string, input: unknown): Promise<unknown> };

const TRANSCRIPTION_MODEL = "@cf/openai/whisper-large-v3-turbo";
const SUMMARY_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const resultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    current_status: { type: "string" },
    progress: { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
    issues: { type: "array", items: { type: "string" } },
    todos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          task: { type: "string" }, owner: { type: "string" }, deadline: { type: "string" }, status: { type: "string" },
        },
        required: ["task", "owner", "deadline", "status"],
      },
    },
    next_confirmation: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "current_status", "progress", "decisions", "issues", "todos", "next_confirmation"],
};

export class CloudflareWorkersAIService implements AIService {
  constructor(private readonly ai: WorkersAI) {}

  async transcribeAudio(audio: ArrayBuffer, mimeType: string): Promise<string> {
    try {
      const response = await this.ai.run(TRANSCRIPTION_MODEL, {
        audio: Array.from(new Uint8Array(audio)),
        task: "transcribe",
        language: "ja",
        vad_filter: true,
        condition_on_previous_text: false,
        no_speech_threshold: 0.6,
        content_type: mimeType,
      }) as { text?: string };
      return typeof response?.text === "string" ? response.text.trim() : "";
    } catch (error) {
      throw normalizeAIError(error);
    }
  }

  async summarizeMeeting(input: SummarizeMeetingInput): Promise<MeetingAIResult> {
    const system = [
      "あなたは定例会議の記録補助です。会話と前回情報に存在する事実だけを抽出してください。",
      "会話にない内容を追加しない。担当者・期限が不明なら空欄。曖昧な期限を日付へ変換しない。",
      "完了が明確でない限り完了にしない。前回と今回を比較し、未解決事項は次回確認へ入れる。",
      "ToDoは今回新しく発生したものだけ。判断できない項目は空文字または空配列にする。",
      "JSON以外を出力しない。",
    ].join("\n");
    const user = JSON.stringify({ previous: input.previous, transcript: input.transcript });

    try {
      const response = await this.ai.run(SUMMARY_MODEL, {
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0,
        max_tokens: 1400,
        response_format: { type: "json_schema", json_schema: resultSchema },
      }) as { response?: unknown };
      const raw = typeof response?.response === "string" ? JSON.parse(response.response) : response?.response;
      return normalizeMeetingResult(raw);
    } catch (error) {
      throw normalizeAIError(error);
    }
  }

  extractProgress(input: SummarizeMeetingInput) {
    return this.summarizeMeeting(input);
  }
}

function normalizeAIError(error: unknown): Error {
  const value = error as { status?: number; code?: number | string; message?: string };
  const message = `${value?.message ?? ""}`;
  if (value?.status === 429 || `${value?.code}` === "3036" || /free allocation|neuron|daily limit/i.test(message)) {
    return new AIFreeLimitExceededError();
  }
  return error instanceof Error ? error : new Error("AI処理に失敗しました。");
}

