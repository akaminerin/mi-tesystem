import mapping from "../config/project-sheet-map.json";
import { getGoogleAccessToken } from "./google-auth";
import type { MeetingAIResult, PreviousProjectState } from "./meeting-types";

type RuntimeEnv = Record<string, string | undefined>;
type SheetTarget = { municipality: string; name: string; spreadsheetIdEnv: string; masterSheet?: string; historySheet?: string; todoSheet?: string };

export class GoogleSheetsService {
  constructor(private readonly runtimeEnv: RuntimeEnv) {}

  async bootstrap(): Promise<{ municipalities: string[]; projects: PreviousProjectState[] }> {
    const targets = Object.entries(mapping.projects) as [string, SheetTarget][];
    const groups = new Map<string, { spreadsheetId: string; sheet: string }>();
    for (const [, target] of targets) {
      const spreadsheetId = this.requireEnv(target.spreadsheetIdEnv);
      groups.set(`${spreadsheetId}:${target.masterSheet ?? mapping.defaults.masterSheet}`, { spreadsheetId, sheet: target.masterSheet ?? mapping.defaults.masterSheet });
    }
    const rows = (await Promise.all([...groups.values()].map((group) => this.getValues(group.spreadsheetId, `${quoteSheet(group.sheet)}!A2:K`)))).flat();
    const configuredIds = new Set(targets.map(([id]) => id));
    const projects = rows.filter((row) => configuredIds.has(row[1] ?? "") && row[10] !== "FALSE").map(rowToProject);
    return { municipalities: [...new Set(projects.map((item) => item.municipality))], projects };
  }

  async getProject(projectId: string): Promise<PreviousProjectState> {
    const target = this.target(projectId);
    const spreadsheetId = this.requireEnv(target.spreadsheetIdEnv);
    const masterSheet = target.masterSheet ?? mapping.defaults.masterSheet;
    const rows = await this.getValues(spreadsheetId, `${quoteSheet(masterSheet)}!A2:K`);
    const row = rows.find((candidate) => candidate[1] === projectId);
    if (!row) throw new Error("案件マスタに対象案件がありません。");
    return rowToProject(row);
  }

  async confirm(input: { projectId: string; previousStatus: string; transcript: string; result: MeetingAIResult }) {
    const target = this.target(input.projectId);
    const spreadsheetId = this.requireEnv(target.spreadsheetIdEnv);
    const masterSheet = target.masterSheet ?? mapping.defaults.masterSheet;
    const historySheet = target.historySheet ?? mapping.defaults.historySheet;
    const todoSheet = target.todoSheet ?? mapping.defaults.todoSheet;
    const masterRows = await this.getValues(spreadsheetId, `${quoteSheet(masterSheet)}!A2:K`);
    const index = masterRows.findIndex((row) => row[1] === input.projectId);
    if (index < 0) throw new Error("案件マスタに対象案件がありません。");
    const old = [...masterRows[index]];
    while (old.length < 11) old.push("");
    old[3] = input.result.current_status;
    old[4] = input.result.progress;
    old[5] = input.result.todos.find((todo) => todo.owner)?.owner ?? old[5] ?? "";
    old[6] = input.result.todos.find((todo) => todo.deadline)?.deadline ?? old[6] ?? "";
    old[7] = input.result.next_confirmation.join("\n");
    old[8] = new Date().toISOString();
    await this.updateValues(spreadsheetId, `${quoteSheet(masterSheet)}!A${index + 2}:K${index + 2}`, [old]);
    const meetingDate = new Date().toISOString().slice(0, 10);
    await this.appendValues(spreadsheetId, `${quoteSheet(historySheet)}!A:O`, [[
      meetingDate, target.municipality, input.projectId, target.name, input.previousStatus, input.result.current_status,
      masterRows[index][4] ?? "", input.result.progress, input.result.decisions.join("\n"), input.result.issues.join("\n"),
      input.result.todos.map((todo) => todo.task).join("\n"), input.result.next_confirmation.join("\n"), input.result.summary,
      input.transcript, new Date().toISOString(),
    ]]);
    if (input.result.todos.length) {
      await this.appendValues(spreadsheetId, `${quoteSheet(todoSheet)}!A:J`, input.result.todos.map((todo, todoIndex) => [
        `${input.projectId}-${Date.now()}-${todoIndex + 1}`, target.municipality, input.projectId, target.name, todo.task,
        todo.owner, todo.deadline, todo.status || "未着手", meetingDate, "",
      ]));
    }
  }

  private target(projectId: string) {
    const target = (mapping.projects as Record<string, SheetTarget>)[projectId];
    if (!target) throw new Error("案件の接続先設定がありません。");
    return target;
  }

  private requireEnv(name: string) {
    const value = this.runtimeEnv[name];
    if (!value) throw new Error(`環境変数 ${name} が未設定です。`);
    return value;
  }

  private async request(path: string, init?: RequestInit) {
    const credentials = this.requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
    const token = await getGoogleAccessToken(credentials);
    const response = await fetch(`https://sheets.googleapis.com/v4/${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`Google Sheets APIエラー (${response.status})`);
    return response.json() as Promise<{ values?: string[][] }>;
  }

  private async getValues(spreadsheetId: string, range: string) {
    const result = await this.request(`spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`);
    return result.values ?? [];
  }

  private async updateValues(spreadsheetId: string, range: string, values: string[][]) {
    await this.request(`spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values }) });
  }

  private async appendValues(spreadsheetId: string, range: string, values: string[][]) {
    await this.request(`spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values }) });
  }
}

function quoteSheet(name: string) { return `'${name.replace(/'/g, "''")}'`; }
function rowToProject(row: string[]): PreviousProjectState {
  return { municipality: row[0] ?? "", projectId: row[1] ?? "", projectName: row[2] ?? "", status: row[3] ?? "未着手", progress: row[4] ?? "", owner: row[5] ?? "", deadline: row[6] ?? "", nextConfirmation: row[7] ?? "", updatedAt: row[8] ?? "" };
}

