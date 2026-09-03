'use client';
import { create } from 'zustand';
import type { UiState } from '@/lib/db/schema';
import { debounce } from '@/lib/utils';

export type ModalKind = 'capture' | 'debrief' | 'palette' | 'shortcuts' | 'reset' | null;

interface AppState {
  ui: UiState;
  hydrated: boolean;
  modal: ModalKind;
  captureDraft: string;
  contextObjectId: string | null;
  selection: string[];

  setUi: (patch: Partial<UiState>, persist?: boolean) => void;
  hydrate: (ui: UiState) => void;
  openModal: (kind: ModalKind, draft?: string) => void;
  closeModal: () => void;
  setCaptureDraft: (s: string) => void;
  openContext: (id: string | null) => void;
  setSelection: (ids: string[]) => void;
  toggleSelected: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
}

export const DEFAULT_UI: UiState = {
  sidebar_collapsed: false,
  context_pane_width: 360,
  density: 'comfortable',
  theme: 'system',
  goal_tree_expanded: [],
  last_board_lens: 'all',
  table_sorts: {},
  shortcuts_seen: false,
};

/** Shell state is written to the server on a debounce so it follows the user
 *  between machines. localStorage would lose the goal-tree expansion set, which
 *  encodes which parts of their life they are currently working on. */
const persistUi = debounce((ui: UiState) => {
  void fetch('/api/settings/ui', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ui),
  }).catch(() => {});
}, 800);

export const useApp = create<AppState>()((set, get) => ({
  ui: DEFAULT_UI,
  hydrated: false,
  modal: null,
  captureDraft: '',
  contextObjectId: null,
  selection: [],

  setUi: (patch, persist = true) => {
    const ui = { ...get().ui, ...patch };
    set({ ui });
    applyTheme(ui);
    if (persist && get().hydrated) persistUi(ui);
  },

  hydrate: (ui) => {
    const merged = { ...DEFAULT_UI, ...ui };
    set({ ui: merged, hydrated: true });
    applyTheme(merged);
  },

  openModal: (kind, draft) =>
    set((s) => ({ modal: kind, captureDraft: draft ?? s.captureDraft })),
  closeModal: () => set({ modal: null }),
  setCaptureDraft: (s) => set({ captureDraft: s }),

  openContext: (id) => set({ contextObjectId: id }),

  setSelection: (ids) => set({ selection: ids }),
  toggleSelected: (id, additive) =>
    set((s) => {
      if (!additive) return { selection: s.selection.includes(id) ? [] : [id] };
      return {
        selection: s.selection.includes(id)
          ? s.selection.filter((x) => x !== id)
          : [...s.selection, id],
      };
    }),
  clearSelection: () => set({ selection: [] }),
}));

export function applyTheme(ui: UiState) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved =
    ui.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : ui.theme;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-density', ui.density);
}
