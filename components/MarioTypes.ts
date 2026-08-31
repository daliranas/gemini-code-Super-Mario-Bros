export type Biome = 'overworld' | 'underground' | 'castle';

export type MarioState = 'small' | 'super' | 'fire';

export type EnemyType =
  | 'goomba'
  | 'koopa_green'
  | 'koopa_red'
  | 'piranha'
  | 'spiny'
  | 'buzzy_beetle'
  | 'lakitu'
  | 'bowser';

export type EnemyState =
  | 'walking'
  | 'shell_idle'
  | 'shell_moving'
  | 'squished'
  | 'dead';

export type PowerUpType = 'mushroom' | 'flower' | 'star';

export type ScreenState =
  | 'menu'
  | 'stage_intro'
  | 'playing'
  | 'paused'
  | 'game_over'
  | 'settings'
  | 'controls';

export type GameMode = 'classic' | 'endless';

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const TILE_SIZE = 16;
export const CHUNK_WIDTH = 16; // 16 tiles = 256px wide chunk
export const CHUNK_HEIGHT = 15; // 15 tiles = 240px tall chunk

// Tile ID constants
export const TILE_EMPTY = 0;
export const TILE_GROUND = 1;
export const TILE_BRICK = 2;
export const TILE_QUESTION_COIN = 3;
export const TILE_QUESTION_POWERUP = 4;
export const TILE_QUESTION_STAR = 5;
export const TILE_USED_BLOCK = 6;
export const TILE_HARD_BLOCK = 7;
export const TILE_PIPE_TOP_LEFT = 8;
export const TILE_PIPE_TOP_RIGHT = 9;
export const TILE_PIPE_BODY_LEFT = 10;
export const TILE_PIPE_BODY_RIGHT = 11;
export const TILE_CASTLE_WALL = 12;
export const TILE_CASTLE_AXE = 13;
export const TILE_CASTLE_BRIDGE = 14;
export const TILE_LAVA_TOP = 15;

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  direction: 1 | -1;
  state: MarioState;
  starTimer: number; // ms remaining of star invincibility
  iframeTimer: number; // ms remaining of damage invincibility
  crouching: boolean;
  score: number;
  coins: number;
  lives: number;
  distance: number;
  dead: boolean;
  deathTimer: number;
  animFrame: number;
  animTimer: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  direction: 1 | -1;
  state: EnemyState;
  deadTimer: number;
  animTimer: number;
  // Specific enemy properties
  pipeX?: number;
  pipeY?: number;
  piranhaOffset?: number; // 0 to 24 (px out of pipe)
  piranhaState?: 'up' | 'down' | 'waiting';
  piranhaTimer?: number;
  hp?: number; // Bowser hp (5)
  shootTimer?: number; // Bowser flame / Lakitu spiny timer
  jumpTimer?: number; // Bowser jump timer
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  spawnY: number;
  emerging: boolean;
}

export interface Fireball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

export interface BowserFlame {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
}

export interface Chunk {
  index: number;
  biome: Biome;
  tiles: number[][]; // 15 rows x 16 cols
  startX: number; // chunk index * CHUNK_WIDTH * TILE_SIZE
  hasBowserAxe?: boolean;
}

export interface KeysState {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  run: boolean;
  fire: boolean;
}

export interface KeyBindings {
  left: string[];
  right: string[];
  down: string[];
  jump: string[];
  run: string[];
  pause: string[];
  fullscreen: string[];
}

export interface GameSettings {
  masterVolume: number; // 0.0 - 1.0
  musicVolume: number;  // 0.0 - 1.0
  sfxVolume: number;    // 0.0 - 1.0
  muted: boolean;
  aspectRatio: 'auto' | '16_9' | '4_3';
  crtFilter: boolean;
  showFPS: boolean;
  touchControls: 'auto' | 'always' | 'never';
  controls: KeyBindings;
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['ArrowUp', 'KeyW', 'Space'],
  run: ['ShiftLeft', 'ShiftRight', 'KeyK'],
  pause: ['Escape', 'KeyP'],
  fullscreen: ['KeyF'],
};

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  muted: false,
  aspectRatio: 'auto',
  crtFilter: true,
  showFPS: false,
  touchControls: 'auto',
  controls: DEFAULT_KEY_BINDINGS,
};

export const MARIO_SETTINGS_STORAGE_KEY = 'super_mario_retro_settings';
export const MARIO_HIGHSCORE_STORAGE_KEY = 'super_mario_retro_highscore';
