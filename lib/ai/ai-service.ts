import type { MeetingAIResult, PreviousProjectState } from "../meeting-types";

export type SummarizeMeetingInput = {
  transcript: string;
  previous: PreviousProjectState;
};

export interface AIService {
  transcribeAudio(audio: ArrayBuffer, mimeType: string): Promise<string>;
  summarizeMeeting(input: SummarizeMeetingInput): Promise<MeetingAIResult>;
  extractProgress(input: SummarizeMeetingInput): Promise<MeetingAIResult>;
}

export class AIFreeLimitExceededError extends Error {
  constructor() {
    super("本日のAI無料利用枠を超えました。翌日以降に再度お試しください。");
    this.name = "AIFreeLimitExceededError";
  }
}

