import type { PublicTable } from "./types";

type Listener = { userId: string; fn: (table: PublicTable) => void };

const g = globalThis as unknown as {
  __royaleListeners?: Map<string, Map<string, Listener>>;
};

function bucket() {
  if (!g.__royaleListeners) g.__royaleListeners = new Map();
  return g.__royaleListeners;
}

export function subscribe(
  tableId: string,
  clientId: string,
  userId: string,
  fn: Listener["fn"],
) {
  const tables = bucket();
  if (!tables.has(tableId)) tables.set(tableId, new Map());
  tables.get(tableId)!.set(clientId, { userId, fn });
  return () => {
    tables.get(tableId)?.delete(clientId);
  };
}

export function notifyListeners(
  tableId: string,
  build: (userId: string) => PublicTable,
) {
  const listeners = bucket().get(tableId);
  if (!listeners) return;
  for (const listener of listeners.values()) {
    try {
      listener.fn(build(listener.userId));
    } catch {
      // drop broken listeners
    }
  }
}

export function encodeSse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}
