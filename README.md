# 定例会議AIエージェント「進む君」

自治体ごとの案件を1件ずつ確認し、ブラウザ録音・文字起こし・AI整理・人による修正・Google Sheets保存までを支援するWebアプリです。Googleスプレッドシートを唯一の正本とし、アプリ自身は案件や会議履歴を永続保存しません。

「進む君」は、会議を話すだけで終わらせず、決定事項と次の行動をやさしく整理して前へ進める会議パートナーです。親しみやすく頼れる“少しおじさん”のキャラクターと、木目・付箋を取り入れた温かいUIを採用しています。

## 使用技術

- Next.js / React / TypeScript / Vinext（Cloudflare Worker）
- MediaRecorder API（案件単位のブラウザ録音）
- Cloudflare Workers AI binding（文字起こし、構造化要約）
- `@cf/openai/whisper-large-v3-turbo`（日本語文字起こし）
- `@cf/meta/llama-3.1-8b-instruct-fast`（JSON要約）
- Google Sheets API（読込・更新・履歴追加）

## 構成と保存方針

```text
Webブラウザ → Webアプリ → Cloudflare Worker → Workers AI → Googleスプレッドシート
```

- ユーザーPCへのPython、Whisper、Ollama、Node.js、AIモデルのインストールは不要です。
- R2、KV、Durable Objects、D1、Vectorizeを使用しません。
- AI Gatewayを使用しません。プロンプト／レスポンスのキャッシュやログも作成しません。
- 音声はブラウザメモリと1回のHTTPリクエスト内だけで扱い、処理完了後に破棄します。
- AI結果は自動確定せず、ユーザーが確認した後だけGoogleスプレッドシートへ保存します。
- アプリログには処理時刻、成否、HTTPステータス、処理時間だけを出します。

## 無料運用の必須条件

Cloudflareアカウントは **Workers Free Planのまま** 使用してください。Workers Paid、AI GatewayのUnified Billing、プリペイドクレジットを有効にしないでください。Free Planの1日10,000 Neuronsを使い切るとWorkers AIがHTTP 429（内部コード3036）を返し、アプリは「本日のAI無料利用枠を超えました。翌日以降に再度お試しください。」と表示して停止します。有料AIへのフォールバックは実装していません。

通常のWorkers AI推論のみを使用します。CloudflareのWorkers AIデータ利用方針ではCustomer Contentをモデル学習に使用せず、標準推論の入力・出力は処理に必要な期間を超えて保持しないとされています。状態を保存するCloudflare機能は構成に含めていません。

## セットアップ

1. `npm install`
2. `.env.example` を `.env.local` にコピー
3. `GOOGLE_SERVICE_ACCOUNT_JSON`、案件別の `SHEET_ID_*` を設定
4. Cloudflare Workers AI binding名を `AI` にしてWorkers Free Planへデプロイ
5. `npm run dev`

サービスアカウント情報をクライアントコードへ記載しないでください。`.env*` はGit対象外です。本番ではCloudflare Worker secret `GOOGLE_SERVICE_ACCOUNT_JSON` と案件別 `SHEET_ID_*` を設定します。Googleサービスアカウントには対象スプレッドシートの編集権限だけを共有します。

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

接続情報がない場合は案件データを表示せず、設定エラー画面になります。デモデータを本番データの代わりに保存することはありません。

