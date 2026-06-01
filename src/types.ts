export type HealthType = 'Gesund' | 'Mix' | 'Chronisch';

export type FranchiseType = 300 | 2500;

export interface MedicalScenario {
  title: string;
  costs: number;
  desc: string;
}

export interface GameState {
  gameProgress: 1 | 2 | 3; // 3 represents fully completed path
  healthType: HealthType | null;
  selectedFranchise: FranchiseType | null;
  selected3a: number | null;
  currentBadge: string;
}

export type GameScreen = 
  | 'map' 
  | 'l1-setup' 
  | 'l1-result' 
  | 'l1-quiz' 
  | 'l2-setup' 
  | 'l2-result' 
  | 'l2-quiz' 
  | 'l2-complete';
