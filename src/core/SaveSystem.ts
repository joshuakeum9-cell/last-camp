import {
  SAVE_VERSION,
  newGameState,
  setState,
  snapshot,
  state,
  type GameState,
} from './GameState';

const KEY = 'lastcamp.save.v1';
const BACKUP_KEY = 'lastcamp.save.backup';

function canStore(): boolean {
  try {
    const probe = '__lc__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export const SaveSystem = {
  available: canStore(),

  hasSave(): boolean {
    if (!this.available) return false;
    try {
      return localStorage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  },

  save(): boolean {
    if (!this.available) return false;
    try {
      state.lastSeenAt = Date.now();
      const json = JSON.stringify(snapshot(state));
      // Keep the previous good save as a backup before overwriting.
      const prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(BACKUP_KEY, prev);
      localStorage.setItem(KEY, json);
      return true;
    } catch (err) {
      console.warn('[SaveSystem] save failed:', err);
      return false;
    }
  },

  /** Load into the live state. Returns true when an existing save was restored. */
  load(): boolean {
    if (!this.available) return false;
    const raw = this.readRaw(KEY) ?? this.readRaw(BACKUP_KEY);
    if (!raw) return false;
    const migrated = migrate(raw);
    if (!migrated) {
      console.warn('[SaveSystem] save could not be migrated, starting a new camp');
      return false;
    }
    setState(migrated);
    return true;
  },

  readRaw(key: string): GameState | null {
    try {
      const text = localStorage.getItem(key);
      if (!text) return null;
      const parsed = JSON.parse(text) as GameState;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      console.warn(`[SaveSystem] could not parse "${key}":`, err);
      return null;
    }
  },

  /** Wipe the save and start fresh. Used by New Camp and the dev screen. */
  reset(): void {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(BACKUP_KEY);
    } catch {
      /* ignore */
    }
    setState(newGameState());
  },

  exportJson(): string {
    return JSON.stringify(snapshot(state), null, 2);
  },
};

/**
 * Bring an older or partial save up to the current shape. Anything missing is filled in
 * from a fresh state, so adding a field never breaks an existing player's camp.
 */
function migrate(raw: GameState): GameState | null {
  if (typeof raw.version !== 'number') return null;
  if (raw.version > SAVE_VERSION) return null;

  const base = newGameState();
  const merged = deepFill(raw as unknown as Record<string, unknown>, base as unknown as Record<string, unknown>);
  const out = merged as unknown as GameState;
  out.version = SAVE_VERSION;

  // A save written mid-expedition resumes at camp rather than in a half-built world.
  if (out.run && (typeof out.run.timeSec !== 'number' || Number.isNaN(out.run.timeSec))) {
    out.run = null;
  }
  return out;
}

/** Copy `src` over `template`, keeping template values for anything missing or mistyped. */
function deepFill(
  src: Record<string, unknown>,
  template: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(template)) {
    const t = template[key];
    const s = src ? src[key] : undefined;
    if (s === undefined || s === null) {
      out[key] = t;
    } else if (Array.isArray(t)) {
      out[key] = Array.isArray(s) ? s : t;
    } else if (typeof t === 'object' && typeof s === 'object') {
      out[key] = deepFill(s as Record<string, unknown>, t as Record<string, unknown>);
    } else if (typeof t === typeof s) {
      out[key] = s;
    } else {
      out[key] = t;
    }
  }
  // Keep extra keys the template does not know about, e.g. maps keyed by id.
  for (const key of Object.keys(src ?? {})) {
    if (!(key in out)) out[key] = src[key];
  }
  return out;
}
