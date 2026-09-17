// ─── Auth ───────────────────────────────────────────────────────────────────

export interface SignUpBody {
  email: string;
  password: string;
  name: string;
}

export interface SignInBody {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// ─── Tournament ──────────────────────────────────────────────────────────────

export type TournamentStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface CreateTournamentBody {
  name: string;
  sport: string;
  timezone?: string;
}

export interface UpdateTournamentBody {
  name?: string;
  sport?: string;
  timezone?: string;
  status?: TournamentStatus;
}

export interface TournamentSummary {
  id: string;
  name: string;
  sport: string;
  slug: string;
  status: TournamentStatus;
  timezone: string;
  createdAt: string;
  divisionCount: number;
  teamCount: number;
}

export interface TournamentDetail extends TournamentSummary {
  divisions: DivisionSummary[];
  teams: TeamSummary[];
  fields: FieldSummary[];
  branding: BrandingConfig | null;
}

// ─── Division ────────────────────────────────────────────────────────────────

export interface CreateDivisionBody {
  name: string;
  orderIndex?: number;
  teamLimit?: number;
}

export interface DivisionSummary {
  id: string;
  name: string;
  orderIndex: number;
  teamLimit: number | null;
  phases: PhaseSummary[];
}

// ─── Phase ───────────────────────────────────────────────────────────────────

export type PhaseType = "GROUP_STAGE" | "KNOCKOUT";
export type PhaseStatus = "PENDING" | "ACTIVE" | "COMPLETED";

export interface CreatePhaseBody {
  name: string;
  type: PhaseType;
  orderIndex?: number;
}

export interface PhaseSummary {
  id: string;
  name: string;
  type: PhaseType;
  status: PhaseStatus;
  orderIndex: number;
}

// ─── Group ───────────────────────────────────────────────────────────────────

export interface CreateGroupBody {
  name: string;
  legs?: 1 | 2;
  pointsWin?: number;
  pointsDraw?: number;
  pointsLoss?: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  legs: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  teams: TeamSummary[];
  matches: MatchSummary[];
  standings: StandingRow[];
}

// ─── Bracket ─────────────────────────────────────────────────────────────────

export interface CreateBracketBody {
  size: 2 | 4 | 8 | 16 | 32;
  hasConsolation?: boolean;
  thirdPlaceMatch?: boolean;
}

export interface BracketSlotData {
  id: string;
  roundNumber: number;
  position: number;
  side: "HOME" | "AWAY";
  teamId: string | null;
  teamName: string | null;
  isBye: boolean;
}

export interface BracketTree {
  id: string;
  size: number;
  hasConsolation: boolean;
  slots: BracketSlotData[];
  matches: MatchSummary[];
}

// ─── Teams & Players ─────────────────────────────────────────────────────────

export interface CreateTeamBody {
  name: string;
  logoUrl?: string;
  country?: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  country: string | null;
}

export interface TeamDetail extends TeamSummary {
  players: PlayerSummary[];
}

export interface CreatePlayerBody {
  name: string;
  number?: number;
  position?: string;
  dateOfBirth?: string;
}

export interface PlayerSummary {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export type MatchStatus = "PENDING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface MatchSummary {
  id: string;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  scheduledStart: string | null;
  fieldName: string | null;
  roundNumber: number | null;
}

export interface SubmitScoreBody {
  homeScore: number;
  awayScore: number;
  sets?: { setNumber: number; homePoints: number; awayPoints: number }[];
  playerStats?: { playerId: string; statDefId: string; value: number; minute?: number }[];
}

export interface OverrideScoreBody extends SubmitScoreBody {
  reason?: string;
}

// ─── Standings ───────────────────────────────────────────────────────────────

export interface StandingRow {
  position: number;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export interface FieldSummary {
  id: string;
  name: string;
  orderIndex: number;
}

export interface CreateFieldBody {
  name: string;
  orderIndex?: number;
}

export interface AutoScheduleBody {
  groupIds?: string[];
  bracketIds?: string[];
  matchDay: string;
  startTime: string;
  slotDurationMinutes: number;
  restMinutesBetweenSameTeam?: number;
}

export interface MoveMatchBody {
  fieldId: string;
  startTime: string;
}

export interface ScheduleSlot {
  matchId: string;
  fieldId: string;
  fieldName: string;
  startTime: string;
  endTime: string;
  homeTeamName: string | null;
  awayTeamName: string | null;
  status: MatchStatus;
}

// ─── Real-time Events ────────────────────────────────────────────────────────

export interface ScoreUpdatedEvent {
  matchId: string;
  homeScore: number;
  awayScore: number;
  homeTeamId: string;
  awayTeamId: string;
  status: MatchStatus;
}

export interface StandingsUpdatedEvent {
  groupId: string;
  standings: StandingRow[];
}

export interface BracketUpdatedEvent {
  bracketId: string;
  slots: BracketSlotData[];
}

export interface MatchScheduledEvent {
  matchId: string;
  fieldId: string;
  startTime: string;
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
