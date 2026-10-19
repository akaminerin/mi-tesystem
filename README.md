# 定例会議AIエージェント「ミーテ」

自治体ごとの案件を1件ずつ確認し、録音・文字起こし・AI整理・人による修正・Google Sheets保存までを支援するWebアプリです。Googleスプレッドシートを唯一の正本とし、アプリ自身は案件や会議履歴を永続保存しません。

## 使用技術

- Next.js / React / TypeScript / Vinext (Cloudflare Workers)
- MediaRecorder API（案件単位の録音）
- OpenAI API（文字起こし、構造化要約）
- Google Sheets API（読込・更新・履歴追加）

## セットアップ

1. `npm install`
2. `.env.example` を `.env.local` にコピー
3. `OPENAI_API_KEY`、`GOOGLE_SERVICE_ACCOUNT_JSON`、案件別の `SHEET_ID_*` を設定
4. `npm run dev`

APIキーやサービスアカウント情報をクライアントコードへ記載しないでください。`.env*` はGit対象外です。Googleサービスアカウントには対象スプレッドシートの編集権限を共有します。

## 案件ごとの接続先設定（ここを編集）

接続先は [`config/project-sheet-map.json`](config/project-sheet-map.json) にまとめています。

1. `projects` に案件IDを追加します。
2. `spreadsheetIdEnv` に、その案件が使う環境変数名を書きます。
3. `.env.local` に実際のスプレッドシートIDを設定します。

```json
"GIN-002": {
  "municipality": "宜野湾市",
  "name": "RDS再構築",
  "spreadsheetIdEnv": "SHEET_ID_GINOWAN"
}
```

```dotenv
SHEET_ID_GINOWAN=1AbCdEf...your-sheet-id
```

同じ自治体の案件を同じスプレッドシートへ接続する場合は同じ `spreadsheetIdEnv` を指定します。案件ごとに別スプレッドシートを使う場合は、案件専用の環境変数名（例: `SHEET_ID_GIN_002`）へ変更してください。実際のIDは設定ファイルへ直接書かず、必ず環境変数へ置いてください。

## スプレッドシート

次の3シートを作成し、1行目に列を順番どおり用意してください。

- `案件マスタ`: 自治体 / 案件ID / 案件名 / ステータス / 最新進捗 / 担当者 / 期限 / 次回確認事項 / 最終更新日 / 表示順 / 有効フラグ
- `定例履歴`: 定例日 / 自治体 / 案件ID / 案件名 / 前回ステータス / 今回ステータス / 前回進捗 / 今回進捗 / 決定事項 / 課題・懸念事項 / 次回対応 / 次回確認事項 / AI要約 / 文字起こし全文 / 登録日時
- `ToDo`: ToDoID / 自治体 / 案件ID / 案件名 / ToDo / 担当者 / 期限 / 状態 / 発生日 / 完了日 / 発生定例日

## 操作方法

自治体と案件を選び、前回情報と今回の確認事項を確認します。「録音を開始」から案件単位で会話を記録し、停止後のAI整理結果を修正して「確定して次の案件へ」を押します。確定前はGoogle Sheetsを更新しません。全案件終了後は会議全体のまとめをコピーできます。

## テスト

- `npm run build` で型・ビルドを確認
- マイク許可、録音開始・停止、文字起こし全文の開閉、編集、次案件遷移、最終サマリーを確認
- Sheets接続失敗、OpenAI失敗、保存失敗時に次案件へ進まないことを確認

現在のUIは、接続情報がない環境でも操作確認できるデモデータを表示します。本番接続時はサーバー側APIから同じ型のデータを渡してください。

