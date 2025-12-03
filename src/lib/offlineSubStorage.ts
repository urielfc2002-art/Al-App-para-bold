// src/lib/offlineSubStorage.ts
export type OfflineSubState = {
  expiryTimeMillis: number;
  subscriptionState?: string; // SUBSCRIBED, CANCELED, ON_HOLD, ...
  label?: string;             // "Fecha de renovación automática:" | "Fecha de fin de suscripción:"
  lastUpdated: number;
};

type OfflineSubMap = Record<string, OfflineSubState>; // clave = email en minúsculas
const KEY = "alcalc.offlineSubMap.v1";

/** Lee el mapa completo desde localStorage (tolerante a errores). */
function readMap(): OfflineSubMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as OfflineSubMap) : {};
  } catch {
    return {};
  }
}
/** Escribe el mapa completo. */
function writeMap(map: OfflineSubMap) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

/** Carga la suscripción guardada para un email (o null). */
export function loadOfflineSubFor(email: string | null | undefined): OfflineSubState | null {
  if (!email) return null;
  const map = readMap();
  return map[email.toLowerCase()] ?? null;
}

/** Guarda (merge) campos de suscripción para un email. */
export function saveOfflineSubFor(email: string, patch: Partial<OfflineSubState>): void {
  if (!email) return;
  const key = email.toLowerCase();
  const map = readMap();
  const prev = map[key] ?? ({ expiryTimeMillis: 0, lastUpdated: 0 } as OfflineSubState);
  map[key] = {
    ...prev,
    ...patch,
    lastUpdated: Date.now(),
  };
  writeMap(map);
}

/** Borra la info guardada para un email. */
export function clearOfflineSubFor(email: string): void {
  if (!email) return;
  const key = email.toLowerCase();
  const map = readMap();
  delete map[key];
  writeMap(map);
}

/** Activa si NO está cancelada/expirada y la fecha es futura respecto al teléfono. */
export function isOfflineSubActive(s: OfflineSubState | null): boolean {
  if (!s) return false;
  const now = Date.now();

  const label = (s.label || "").toLowerCase();
  const isEndLabel = label.includes("fin de suscripción");

  const state = (s.subscriptionState || "").toUpperCase();
  const canceledLike = /(CANCEL|EXPIRE|ON_HOLD|PAUSE)/.test(state);

  if (isEndLabel || canceledLike) return false;
  return Number.isFinite(s.expiryTimeMillis) && s.expiryTimeMillis > now;
}
