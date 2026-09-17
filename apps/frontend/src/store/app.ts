// ============================================================
// App Store — Zustand (global app state)
// ============================================================
import { create } from 'zustand';
import type { Instrument, ProviderStatusInfo } from '@trading/shared';

interface PaperAccount {
  id: string;
  balance: number;
  initialBalance: number;
  totalPnl: number;
}

interface AppState {
  instruments: Instrument[];
  providerStatuses: ProviderStatusInfo[];
  paperAccount: PaperAccount | null;
  isPaperMode: boolean;
  setInstruments: (instruments: Instrument[]) => void;
  setProviderStatuses: (statuses: ProviderStatusInfo[]) => void;
  setPaperAccount: (account: PaperAccount | null) => void;
  setIsPaperMode: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  instruments: [],
  providerStatuses: [],
  paperAccount: null,
  isPaperMode: true, // always paper mode in this version

  setInstruments: (instruments) => set({ instruments }),
  setProviderStatuses: (statuses) => set({ providerStatuses: statuses }),
  setPaperAccount: (account) => set({ paperAccount: account }),
  setIsPaperMode: (val) => set({ isPaperMode: val }),
}));
