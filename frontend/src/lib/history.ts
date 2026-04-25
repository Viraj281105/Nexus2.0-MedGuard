interface HistoryEntry {
  id: string;
  type: "bill" | "insurance";
  patientName: string;
  insurerName: string;
  procedureOrIssue: string;
  date: string;
  savings: number;
  findingsCount: number;
  confidence: number;
  createdAt: string;
}

export function saveToHistory(entry: Omit<HistoryEntry, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  
  const stored = localStorage.getItem("medguard_history");
  const history: HistoryEntry[] = stored ? JSON.parse(stored) : [];
  
  const newEntry: HistoryEntry = {
    ...entry,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  
  history.unshift(newEntry);
  
  if (history.length > 20) {
    history.pop();
  }
  
  localStorage.setItem("medguard_history", JSON.stringify(history));
}