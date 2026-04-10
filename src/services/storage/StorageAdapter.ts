import type { WorkEntry, WageRate, PayrollSettings } from '../../types';

export interface StorageAdapter {
  getEntries(): Promise<WorkEntry[]>;
  saveEntry(entry: WorkEntry): Promise<void>;
  updateEntry(entry: WorkEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  getWageRates(): Promise<WageRate[]>;
  saveWageRate(rate: WageRate): Promise<void>;
  deleteWageRate(year: number): Promise<void>;

  getSettings(): Promise<PayrollSettings>;
  saveSettings(settings: PayrollSettings): Promise<void>;
}
