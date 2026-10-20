type SafeLog = {
  event: string;
  outcome: "started" | "succeeded" | "failed";
  status?: number;
  elapsedMs?: number;
};

// Never add arbitrary payloads here. Business data and AI content are intentionally excluded.
export function logOperation(entry: SafeLog) {
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
}

