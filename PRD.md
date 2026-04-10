# PRD: 유연한 근무시간·급여 계산기 (Flexible Wage Calculator)

> Claude Code 작업 지시서. 이 문서를 읽고 Phase 1부터 순서대로 구현할 것.

## 1. 제품 개요
사용자가 **날짜 범위(며칠~며칠)와 시간대(몇 시~몇 시)** 를 입력하면 근무시간을 집계하고, **연도별 최저시급**을 자동 적용해 급여를 계산하는 웹 앱. 최저시급은 매년 변경되므로 사용자가 직접 수정 가능해야 하며, 기능 확장이 쉬운 구조여야 한다.

## 2. 핵심 요구사항
- 며칠~며칠, 몇 시~몇 시 입력 → 자동으로 일자별 분할·집계
- 연도별 최저시급 테이블 (사용자 편집 가능, 한국 기본값 제공)
- 일자가 여러 연도에 걸치면 **각 연도 시급을 자동 적용**
- 야간(22~06시) 1.5배, 연장(8h 초과) 1.5배, 주휴수당 토글
- 결과: 일자별/월별 표 + 총합 + CSV 내보내기
- 데이터는 브라우저 로컬(MVP)에서 시작, 추후 백엔드 교체 가능하도록 추상화

## 3. 기술 스택
- **언어/빌드**: TypeScript + Vite + React 18
- **스타일**: TailwindCSS
- **상태관리**: Zustand
- **날짜**: date-fns
- **테스트**: Vitest + React Testing Library
- **포맷/린트**: Prettier + ESLint
- **저장소**: 초기에는 메모리/로컬 어댑터, 인터페이스로 추상화

## 4. 폴더 구조
```
src/
  app/                 # 라우팅, 레이아웃
  components/          # 재사용 UI
  features/
    work-entry/        # 근무 입력
    payroll/           # 급여 계산 결과
    wage-rates/        # 최저시급 관리
    settings/          # 가산율 등 설정
  services/
    payroll/
      calculator.ts    # 순수 계산 로직 (UI 독립)
      rules/           # 야간/연장/주휴 규칙
      index.ts
    storage/
      StorageAdapter.ts
      LocalAdapter.ts
  store/               # Zustand 스토어
  types/               # 공용 타입
  utils/               # 날짜/포맷 헬퍼
  tests/
```

## 5. 데이터 모델 (TypeScript)
```ts
type ID = string;

interface WorkEntry {
  id: ID;
  startDate: string;        // 'YYYY-MM-DD'
  endDate: string;
  startTime: string;        // 'HH:mm'
  endTime: string;          // 'HH:mm' (다음날로 넘어갈 수 있음)
  breakMinutes: number;     // 휴게시간
  daysOfWeek?: number[];    // 0=일~6=토, 비어있으면 매일
  memo?: string;
}

interface WageRate {
  year: number;             // 2025
  hourlyWage: number;       // 10030 (KRW)
}

interface PayrollSettings {
  nightBonusRate: number;     // 0.5 = 50% 가산
  overtimeBonusRate: number;  // 0.5
  weeklyHolidayPay: boolean;  // 주휴수당 적용 여부
  nightStartHour: number;     // 22
  nightEndHour: number;       // 6
  dailyWorkLimit: number;     // 8
  currency: string;           // 'KRW'
}

interface DailyResult {
  date: string;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  hourlyWage: number;
  pay: number;
}

interface PayrollResult {
  daily: DailyResult[];
  monthly: { yearMonth: string; pay: number; minutes: number }[];
  totalPay: number;
  totalMinutes: number;
}
```

## 6. 핵심 계산 로직 (services/payroll/calculator.ts)
입력: `WorkEntry[]`, `WageRate[]`, `PayrollSettings` → 출력: `PayrollResult`

알고리즘:
1. 각 WorkEntry를 일자 단위로 펼친다 (daysOfWeek 필터 적용).
2. 각 일자의 시작/종료 시각에서 휴게시간을 빼고 분 단위 구간을 만든다.
3. 종료시각 < 시작시각이면 다음날로 넘어간 것으로 처리.
4. 각 분(혹은 시간 단위)을 순회하며:
   - 22:00~06:00 → night
   - 누적 8시간 초과분 → overtime
   - 그 외 → regular
5. 해당 일자가 속한 연도의 시급을 `wageRates`에서 조회.
   - 없으면 가장 최근 연도 사용 + 경고.
6. `pay = (regular + overtime*(1+overtimeBonus) + night*(1+nightBonus)) * hourlyWage / 60`
7. 일자별 합산 → 월별 합산 → 총합.

**계산 로직은 순수 함수로 작성하고 Vitest 단위 테스트 필수.**

## 7. 화면 구성
1. **대시보드** (`/`): 이번 달 총 근무시간/예상 급여 요약 카드
2. **근무 입력** (`/entries`): 입력 폼 + 입력된 항목 리스트(수정/삭제)
3. **급여 결과** (`/payroll`): 기간 선택 → 일자별 표, 월별 표, 총합, CSV 다운로드
4. **시급 관리** (`/wages`): 연도별 최저시급 테이블 (추가/수정/삭제)
5. **설정** (`/settings`): 야간/연장 가산율, 주휴수당 토글, 야간 시간대 등

## 8. 한국 최저시급 기본값 (시드 데이터)
```ts
[
  { year: 2022, hourlyWage: 9160 },
  { year: 2023, hourlyWage: 9620 },
  { year: 2024, hourlyWage: 9860 },
  { year: 2025, hourlyWage: 10030 },
  // 2026 이후는 사용자가 직접 추가
]
```
> 정확한 값은 구현 시 공식 자료로 재확인할 것.

## 9. 확장성 원칙
- **계산 로직 ↔ UI 완전 분리**: `services/payroll`는 React 의존성 없음
- **저장소 추상화**: `StorageAdapter` 인터페이스 → LocalAdapter 구현 → 추후 ApiAdapter 교체
- **규칙 모듈화**: 야간/연장/주휴를 `rules/` 하위 함수로 분리해 on/off 및 추가 용이
- **다국가 대비**: currency, locale 필드 분리
- **다중 직장 대비**: WorkEntry에 `jobId` 필드 추가 여지 남기기

## 10. 개발 단계 (Phase)
**Phase 1 — 기반 (필수 먼저)**
- 프로젝트 셋업 (Vite + TS + Tailwind + Vitest)
- 타입 정의, 폴더 구조 생성
- `calculator.ts` 구현 + 단위 테스트 (≥10개 케이스: 단일일/다일/야간/연장/연도경계/휴게시간 등)

**Phase 2 — MVP UI**
- 근무 입력 폼 + 리스트
- 급여 결과 표 (일자별/월별/총합)
- Zustand 스토어 + LocalAdapter

**Phase 3 — 시급/설정**
- 시급 관리 화면
- 설정 화면 (가산율, 야간 시간대, 주휴 토글)

**Phase 4 — 부가 기능**
- 야간/연장/주휴 가산 완성
- CSV 내보내기
- 대시보드 요약

**Phase 5 — 확장**
- 차트(Recharts), 다중 직장, PDF 출력, 백엔드 어댑터

## 11. 완료 기준 (Definition of Done)
- 모든 계산 로직 단위 테스트 통과
- 입력 → 결과까지 사용자 시나리오 e2e 동작
- ESLint/Prettier 통과
- README에 실행 방법, 구조 설명 포함
- 시급/설정이 UI에서 수정되고 즉시 결과에 반영됨

## 12. Claude Code 작업 지시
1. Phase 1부터 순서대로 진행. 각 Phase 끝에 커밋.
2. 새로운 외부 패키지 추가 시 이유를 커밋 메시지에 명시.
3. 계산 로직은 **반드시 테스트 먼저** 작성(또는 동시 작성).
4. 불확실한 요구사항은 추정하지 말고 README의 "결정 필요" 섹션에 기록.
5. PR 단위가 아닌 단일 저장소이면 Phase별 커밋으로 분리.
