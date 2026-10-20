"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, ClipboardCheck, Clock3, Copy, Mic, RotateCcw, Save, Sparkles, Square } from "lucide-react";
import { MEETING_STATUSES, type MeetingAIResult, type MeetingStatus, type MeetingTodo, type PreviousProjectState } from "../lib/meeting-types";

type Stage = "ready" | "processing" | "review" | "done";
const tone: Record<string, string> = { 未着手: "neutral", 対応中: "blue", 確認待ち: "amber", 保留: "gray", 完了: "green" };

function Badge({ status }: { status: string }) {
  return <span className={`status ${tone[status] ?? "neutral"}`}><i />{status}</span>;
}

export default function Home() {
  const [projects, setProjects] = useState<PreviousProjectState[]>([]);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [stage, setStage] = useState<Stage>("ready");
  const [toast, setToast] = useState("");
  const [loadingError, setLoadingError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [aiResult, setAiResult] = useState<MeetingAIResult | null>(null);
  const [results, setResults] = useState<Record<string, MeetingAIResult>>({});
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const cases = useMemo(() => projects.filter((project) => project.municipality === city), [projects, city]);
  const item = cases[selected];

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { error?: string; municipalities?: string[]; projects?: PreviousProjectState[] };
        if (!response.ok) throw new Error(body.error);
        return { municipalities: body.municipalities ?? [], projects: body.projects ?? [] };
      })
      .then((body) => {
        setProjects(body.projects);
        setMunicipalities(body.municipalities);
        setCity(body.municipalities[0] ?? "");
      })
      .catch((error) => setLoadingError(error instanceof Error ? error.message : "案件を取得できませんでした。"));
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const nextRecorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunks.current = [];
      nextRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      nextRecorder.onstop = () => processAudio(new Blob(chunks.current, { type: nextRecorder.mimeType || "audio/webm" }));
      recorder.current = nextRecorder;
      nextRecorder.start(1000);
      setSeconds(0);
      setRecording(true);
      setTranscript("");
      setAiResult(null);
    } catch {
      setToast("マイクを使用できません。ブラウザの権限設定を確認してください。");
    }
  }

  function stopRecording() {
    const active = recorder.current;
    if (!active || active.state === "inactive") return;
    active.stop();
    active.stream.getTracks().forEach((track) => track.stop());
    setRecording(false);
    setStage("processing");
  }

  async function processAudio(audio: Blob) {
    if (!item) return;
    try {
      const form = new FormData();
      form.append("audio", audio, "meeting-audio.webm");
      form.append("projectId", item.projectId);
      const response = await fetch("/api/ai/process", { method: "POST", body: form });
      const body = await response.json() as { error?: string; transcript?: string; result?: MeetingAIResult };
      if (!response.ok) throw new Error(body.error);
      if (!body.transcript || !body.result) throw new Error("AI処理結果が不正です。");
      setTranscript(body.transcript);
      setAiResult(body.result);
      setStage("review");
      setToast("AI整理が完了しました。内容を確認してください。");
    } catch (error) {
      setStage("ready");
      setToast(error instanceof Error ? error.message : "AI処理に失敗しました。");
    } finally {
      chunks.current = [];
      recorder.current = null;
    }
  }

  function finishCase(result: MeetingAIResult) {
    setResults((current) => ({ ...current, [item.projectId]: result }));
    if (selected < cases.length - 1) {
      setSelected((value) => value + 1);
      setStage("ready");
      setSeconds(0);
      setTranscript("");
      setAiResult(null);
    } else {
      setStage("done");
    }
  }

  if (loadingError || (!item && municipalities.length === 0)) {
    return <div className="connection"><div className="brand"><b>進</b><div><strong>進む君</strong><small>定例会議パートナー</small></div></div>{loadingError ? <><h1>スプレッドシートへ接続できません</h1><p>{loadingError}</p><button onClick={() => location.reload()}>再読み込み</button></> : <><h1>案件を読み込んでいます</h1><p>Googleスプレッドシートから自治体と案件を取得しています。</p></>}</div>;
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><b>進</b><div><strong>進む君</strong><small>定例会議パートナー</small></div></div>
      <div className="label">今日の定例</div>
      <button className="nav active"><ClipboardCheck />会議を進める</button>
      <button className="nav"><Clock3 />会議履歴</button>
      <div className="label citylabel">自治体</div>
      <select value={city} onChange={(event) => { setCity(event.target.value); setSelected(0); setStage("ready"); }}>{municipalities.map((name) => <option key={name}>{name}</option>)}</select>
      <div className="caseNav">{cases.map((current, index) => <button key={current.projectId} className={index === selected ? "current" : ""} onClick={() => { setSelected(index); setStage("ready"); }}><span>{index + 1}</span><div><b>{current.projectName}</b><small>{current.status}</small></div>{index === selected && <ChevronRight />}</button>)}</div>
      <div className="sync"><b><i />Google Sheets</b><small>正本データから取得</small></div>
    </aside>
    <main>
      <header><div><p>{city} 定例会</p><h1>{stage === "done" ? "本日の定例まとめ" : item.projectName}</h1></div><div className="position"><b>{Math.min(selected + 1, cases.length)}</b> / {cases.length} 件目</div></header>
      <div className="line"><i style={{ width: `${stage === "done" ? 100 : (selected + 1) / cases.length * 100}%` }} /></div>
      {stage === "done" ? <Summary results={results} /> : <div className="workspace">
        <section>
          <div className="eyebrow">Googleスプレッドシートの前回記録</div>
          <div className="previous"><div className="prevtop"><Badge status={item.status} /><span>最終更新 {item.updatedAt || "—"}</span></div><h2>{item.progress || "前回進捗は未登録です"}</h2><div className="meta"><span><b>担当</b>{item.owner || "未設定"}</span><span><b>期限</b>{item.deadline || "未設定"}</span></div></div>
          <div className="focus"><Sparkles /><div><span>今回、確認すること</span><b>{item.nextConfirmation || "確認事項は未登録です"}</b></div></div>
          {stage === "ready" && <div className={`record ${recording ? "on" : ""}`}><i /><p>{recording ? "この案件を録音しています" : "案件ごとに会話を記録"}</p><h3>{recording ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "準備ができたら録音を始めましょう"}</h3>{recording ? <button className="stop" onClick={stopRecording}><Square />録音を停止して整理</button> : <button onClick={startRecording}><Mic />録音を開始</button>}<small>音声は処理中だけ使用し、CloudflareやGoogleへ保存しません</small></div>}
          {stage === "processing" && <div className="record processing"><span className="spinner" /><p>進む君が整理しています</p><h3>文字起こしと要約を処理中です</h3><small>この画面を閉じずにお待ちください</small></div>}
          {stage === "review" && aiResult && <Review key={item.projectId} item={item} initial={aiResult} transcript={transcript} onSaved={finishCase} onError={setToast} />}
        </section>
        <aside className="agent"><div className="glow" /><Image src="/susumu-kun.png" width={250} height={320} alt="会議を前へ進めるパートナー 進む君" priority /><div className="bubble"><span>進む君</span><b>{recording ? "はい、しっかり聞いていますよ。" : stage === "processing" ? "大事な点を整理しています。" : "前回の宿題、一緒に確認しましょう。"}</b><p>AI結果は自動確定しません。内容を確認してから保存できます。</p></div><div className="stats"><div><small>今回の進行</small><b>{selected + 1} / {cases.length}</b></div><div><small>残り案件</small><b>{Math.max(0, cases.length - selected - 1)}</b></div></div></aside>
      </div>}
    </main>
    {toast && <button className="toast" onClick={() => setToast("")}><Check />{toast}</button>}
  </div>;
}

function Review({ item, initial, transcript, onSaved, onError }: { item: PreviousProjectState; initial: MeetingAIResult; transcript: string; onSaved: (result: MeetingAIResult) => void; onError: (message: string) => void }) {
  const [status, setStatus] = useState<MeetingStatus>((MEETING_STATUSES.includes(initial.current_status as MeetingStatus) ? initial.current_status : "対応中") as MeetingStatus);
  const [progress, setProgress] = useState(initial.progress);
  const [summary, setSummary] = useState(initial.summary);
  const [decisions, setDecisions] = useState(initial.decisions.join("\n"));
  const [issues, setIssues] = useState(initial.issues.join("\n"));
  const [nextConfirmation, setNextConfirmation] = useState(initial.next_confirmation.join("\n"));
  const [todos, setTodos] = useState<MeetingTodo[]>(initial.todos);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
  const result = (): MeetingAIResult => ({ summary, current_status: status, progress, decisions: lines(decisions), issues: lines(issues), todos: todos.filter((todo) => todo.task.trim()), next_confirmation: lines(nextConfirmation) });

  async function confirm() {
    setSaving(true);
    try {
      const finalResult = result();
      const response = await fetch("/api/meetings/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: item.projectId, previousStatus: item.status, transcript, result: finalResult }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error);
      onSaved(finalResult);
    } catch (error) {
      onError(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function updateTodo(index: number, field: keyof MeetingTodo, value: string) {
    setTodos((current) => current.map((todo, todoIndex) => todoIndex === index ? { ...todo, [field]: value } : todo));
  }

  return <div className="review"><div className="reviewHead"><Sparkles /><div><span>Cloudflare Workers AIが整理しました</span><h2>内容を確認・修正してから確定してください</h2></div></div>
    <label>今回の進捗<textarea value={progress} onChange={(event) => setProgress(event.target.value)} /></label>
    <label>ステータス<div className="picker">{MEETING_STATUSES.map((value) => <button key={value} className={status === value ? "selected" : ""} onClick={() => setStatus(value)}>{value}</button>)}</div></label>
    <div className="cols"><label>決定事項<textarea value={decisions} onChange={(event) => setDecisions(event.target.value)} placeholder="1行に1件" /></label><label>課題・懸念事項<textarea value={issues} onChange={(event) => setIssues(event.target.value)} placeholder="1行に1件" /></label></div>
    <div className="todo"><div><b>今回新しく発生したToDo</b><button onClick={() => setTodos((current) => [...current, { task: "", owner: "", deadline: "", status: "未着手" }])}>＋ 追加</button></div>{todos.map((todo, index) => <section key={index}><input value={todo.task} onChange={(event) => updateTodo(index, "task", event.target.value)} placeholder="ToDo" /><input value={todo.owner} onChange={(event) => updateTodo(index, "owner", event.target.value)} placeholder="担当者" /><input value={todo.deadline} onChange={(event) => updateTodo(index, "deadline", event.target.value)} placeholder="期限" /><select value={todo.status} onChange={(event) => updateTodo(index, "status", event.target.value)}>{MEETING_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></section>)}</div>
    <label>次回確認事項<textarea value={nextConfirmation} onChange={(event) => setNextConfirmation(event.target.value)} placeholder="1行に1件" /></label>
    <label>AI要約<textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
    <button className="transcript" onClick={() => setOpen(!open)}>文字起こし全文を見る<ChevronDown className={open ? "up" : ""} /></button>{open && <div className="transcriptText">{transcript}</div>}
    <div className="save"><span><Save />確定するまでGoogleスプレッドシートは更新されません</span><button onClick={confirm} disabled={saving}>{saving ? "保存中…" : "確定して次の案件へ"}<ChevronRight /></button></div>
  </div>;
}

function Summary({ results }: { results: Record<string, MeetingAIResult> }) {
  const values = Object.values(results);
  const counts = MEETING_STATUSES.map((status) => [status, String(values.filter((item) => item.current_status === status).length)]);
  function copy() { navigator.clipboard?.writeText(values.map((item) => item.summary).filter(Boolean).join("\n")); }
  return <div className="summary"><div className="hero"><div><span><Check /></span><p>すべての案件を確認・保存しました</p><h2>おつかれさまでした。<br />今日の定例、まとまっています。</h2><button onClick={copy}><Copy />まとめをコピー</button></div><Image src="/susumu-kun.png" width={220} height={290} alt="進む君" /></div><div className="statgrid"><div><span>確定案件</span><b>{values.length}</b></div>{counts.slice(1).map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><button className="restart" onClick={() => location.reload()}><RotateCcw />新しい定例を開始</button></div>;
}

