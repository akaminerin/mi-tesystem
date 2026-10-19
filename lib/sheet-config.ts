Attempting to perform the InitializeDefaultDrives operation on the 'FileSystem' provider failed.
import mapping from "../config/project-sheet-map.json";

export type ProjectSheetTarget = {
  municipality: string;
  name: string;
  spreadsheetIdEnv: string;
  masterSheet?: string;
  historySheet?: string;
  todoSheet?: string;
};

export function getProjectSheetTarget(projectId: string) {
  const target = mapping.projects[projectId as keyof typeof mapping.projects] as ProjectSheetTarget | undefined;
  if (!target) throw new Error(`案件 ${projectId} のスプレッドシート設定がありません。`);
  const spreadsheetId = process.env[target.spreadsheetIdEnv];
  if (!spreadsheetId) throw new Error(`環境変数 ${target.spreadsheetIdEnv} が未設定です。`);
  return {
    spreadsheetId,
    masterSheet: target.masterSheet ?? mapping.defaults.masterSheet,
    historySheet: target.historySheet ?? mapping.defaults.historySheet,
    todoSheet: target.todoSheet ?? mapping.defaults.todoSheet,
    municipality: target.municipality,
    projectName: target.name
  };
}

