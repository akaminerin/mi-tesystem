export const MEETING_STATUSES = ["未着手", "対応中", "確認待ち", "保留", "完了"] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export type MeetingTodo = {
  task: string;
  owner: string;
  deadline: string;
  status: string;
};

export type MeetingAIResult = {
  summary: string;
  current_status: string;
  progress: string;
  decisions: string[];
  issues: string[];
  todos: MeetingTodo[];
  next_confirmation: string[];
};

export type PreviousProjectState = {
  projectId: string;
  municipality: string;
  projectName: string;
  status: string;
  progress: string;
  owner: string;
  deadline: string;
  nextConfirmation: string;
  updatedAt: string;
};

export function normalizeMeetingResult(value: unknown): MeetingAIResult {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const strings = (item: unknown) => Array.isArray(item) ? item.filter((x): x is string => typeof x === "string") : [];
  const todos = Array.isArray(source.todos)
    ? source.todos.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const todo = item as Record<string, unknown>;
        return [{
          task: typeof todo.task === "string" ? todo.task : "",
          owner: typeof todo.owner === "string" ? todo.owner : "",
          deadline: typeof todo.deadline === "string" ? todo.deadline : "",
          status: typeof todo.status === "string" ? todo.status : "未着手",
        }];
      })
    : [];

  return {
    summary: typeof source.summary === "string" ? source.summary : "",
    current_status: typeof source.current_status === "string" ? source.current_status : "",
    progress: typeof source.progress === "string" ? source.progress : "",
    decisions: strings(source.decisions),
    issues: strings(source.issues),
    todos,
    next_confirmation: strings(source.next_confirmation),
  };
}

