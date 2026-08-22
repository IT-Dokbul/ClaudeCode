export type ShiftType = 'off' | 'solo' | 'early' | 'closing' | 'conflict';
export type ScheduleStatus = 'none' | 'generated' | 'manager_approved' | 'approved' | 'rejected';

export interface ScheduleDay {
  day: number;
  a: ShiftType;
  b: ShiftType;
  aEnd: string | null;
  bEnd: string | null;
  aAdj?: boolean;
  bAdj?: boolean;
}

export interface MonthData {
  aOff: number[];
  bOff: number[];
  aSub: boolean;
  bSub: boolean;
  sch: ScheduleDay[] | null;
  status: ScheduleStatus;
  comment: string;
}

export interface StoreConfig {
  id: string;
  name: string;
  operatingStart: string;
  operatingEnd: string;
  nameA: string;
  nameB: string;
}
