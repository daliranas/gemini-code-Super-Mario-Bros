'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Biome,
  BowserFlame,
  Chunk,
  DEFAULT_SETTINGS,
  Enemy,
  Fireball,
  FloatingText,
  GameMode,
  GameSettings,
  KeysState,
  MARIO_HIGHSCORE_STORAGE_KEY,
  MARIO_SETTINGS_STORAGE_KEY,
  Particle,
  Player,
  PowerUp,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  ScreenState,
  TILE_BRICK,
  TILE_CASTLE_AXE,
  TILE_CASTLE_BRIDGE,
  TILE_CASTLE_WALL,
  TILE_GROUND,
  TILE_HARD_BLOCK,
  TILE_LAVA_TOP,
  TILE_PIPE_BODY_LEFT,
  TILE_PIPE_BODY_RIGHT,
  TILE_PIPE_TOP_LEFT,
  TILE_PIPE_TOP_RIGHT,
  TILE_QUESTION_COIN,
  TILE_QUESTION_POWERUP,
  TILE_QUESTION_STAR,
  TILE_SIZE,
  TILE_USED_BLOCK,
} from './MarioTypes';
import { generateChunk, getBiomeForChunk, pruneFarObjects } from './MarioGenerator';
import { updateEngine } from './MarioEngine';
import { soundEngine } from './MarioAudio';

export const MarioGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Persistence States
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [highScore, setHighScore] = useState<number>(0);

  // Game Flow States
  const [screenState, setScreenState] = useState<ScreenState>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // HUD & Stats
  const [gameTime, setGameTime] = useState<number>(400);
  const [fps, setFps] = useState<number>(60);
  const [stageIntroTimer, setStageIntroTimer] = useState<number>(2);

  // Key remapping state
  const [remappingAction, setRemappingAction] = useState<keyof GameSettings['controls'] | null>(null);

  // Active Keys state ref
  const keysRef = useRef<KeysState>({
    left: false,
    right: false,
    down: false,
    jump: false,
    run: false,
    fire: false,
  });

  // Game Loop Ref variables
  const gameStateRef = useRef<{
    player: Player;
    cameraX: number;
    chunks: Map<number, Chunk>;
    enemies: Enemy[];
    powerUps: PowerUp[];
    fireballs: Fireball[];
    bowserFlames: BowserFlame[];
    particles: Particle[];
    floatingTexts: FloatingText[];
    highestGeneratedChunk: number;
    gameMode: GameMode;
  }>({
    player: createInitialPlayer(),
    cameraX: 0,
    chunks: new Map(),
    enemies: [],
    powerUps: [],
    fireballs: [],
    bowserFlames: [],
    particles: [],
    floatingTexts: [],
    highestGeneratedChunk: 3,
    gameMode: 'classic',
  });

  function createInitialPlayer(): Player {
    return {
      x: 32,
      y: 176,
      vx: 0,
      vy: 0,
      width: 12,
      height: 16,
      grounded: false,
      direction: 1,
      state: 'small',
      starTimer: 0,
      iframeTimer: 0,
      crouching: false,
      score: 0,
      coins: 0,
      lives: 3,
      distance: 32,
      dead: false,
      deathTimer: 0,
      animFrame: 0,
      animTimer: 0,
    };
  }

  // Ensure Audio Cleanup on React Component Unmount
  useEffect(() => {
    return () => {
      soundEngine.stopBGM();
    };
  }, []);

  // Load Settings and High Score from LocalStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedSettings = localStorage.getItem(MARIO_SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      const savedHighScore = localStorage.getItem(MARIO_HIGHSCORE_STORAGE_KEY);
      if (savedHighScore) {
        setHighScore(parseInt(savedHighScore, 10) || 0);
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage', e);
    }

    const checkMobile = () => {
      setIsMobile(
        'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth <= 768
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('fullscreenchange', handleFSChange);
    };
  }, []);

  // Update sound engine volumes whenever settings change
  useEffect(() => {
    soundEngine.setVolumes({
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      muted: settings.muted,
    });
    try {
      localStorage.setItem(MARIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }, [settings]);

  // Save High Score
  const checkAndSaveHighScore = useCallback((score: number) => {
    setHighScore((prev) => {
      if (score > prev) {
        try {
          localStorage.setItem(MARIO_HIGHSCORE_STORAGE_KEY, score.toString());
        } catch (e) {
          console.error('Failed to save high score', e);
        }
        return score;
      }
      return prev;
    });
  }, []);

  // Native Fullscreen API
  const toggleFullscreen = () => {
    soundEngine.initAudio();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  };

  // Switch Screen State with Clean BGM Shutdown
  const navigateToScreen = (screen: ScreenState) => {
    soundEngine.initAudio();
    if (screen === 'menu' || screen === 'settings' || screen === 'controls') {
      soundEngine.stopBGM();
    }
    setScreenState(screen);
  };

  // Start new game session
  const startNewGame = (mode: GameMode) => {
    soundEngine.initAudio();
    soundEngine.stopBGM();
    setGameMode(mode);
    setGameTime(400);

    const newPlayer = createInitialPlayer();
    const chunks = new Map<number, Chunk>();
    const enemies: Enemy[] = [];

    // Pre-generate 4 chunks
    for (let c = 0; c < 4; c++) {
      const data = generateChunk(c);
      chunks.set(c, data.chunk);
      enemies.push(...data.enemies);
    }

    gameStateRef.current = {
      player: newPlayer,
      cameraX: 0,
      chunks,
      enemies,
      powerUps: [],
      fireballs: [],
      bowserFlames: [],
      particles: [],
      floatingTexts: [],
      highestGeneratedChunk: 3,
      gameMode: mode,
    };

    setStageIntroTimer(2);
    setScreenState('stage_intro');
  };

  // Stage Intro countdown effect
  useEffect(() => {
    if (screenState !== 'stage_intro') return;
    soundEngine.stopBGM();

    const interval = setInterval(() => {
      setStageIntroTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setScreenState('playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screenState]);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      soundEngine.initAudio();

      if (remappingAction) {
        e.preventDefault();
        setSettings((prev) => ({
          ...prev,
          controls: {
            ...prev.controls,
            [remappingAction]: [e.code],
          },
        }));
        setRemappingAction(null);
        return;
      }

      const ctrl = settings.controls;

      if (ctrl.fullscreen.includes(e.code)) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (ctrl.pause.includes(e.code)) {
        e.preventDefault();
        if (screenState === 'playing') {
          soundEngine.playPause();
          soundEngine.stopBGM();
          setScreenState('paused');
        } else if (screenState === 'paused') {
          soundEngine.playPause();
          setScreenState('playing');
        }
        return;
      }

      if (ctrl.left.includes(e.code)) keysRef.current.left = true;
      if (ctrl.right.includes(e.code)) keysRef.current.right = true;
      if (ctrl.down.includes(e.code)) keysRef.current.down = true;
      if (ctrl.jump.includes(e.code)) keysRef.current.jump = true;
      if (ctrl.run.includes(e.code)) {
        keysRef.current.run = true;
        keysRef.current.fire = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const ctrl = settings.controls;
      if (ctrl.left.includes(e.code)) keysRef.current.left = false;
      if (ctrl.right.includes(e.code)) keysRef.current.right = false;
      if (ctrl.down.includes(e.code)) keysRef.current.down = false;
      if (ctrl.jump.includes(e.code)) keysRef.current.jump = false;
      if (ctrl.run.includes(e.code)) {
        keysRef.current.run = false;
        keysRef.current.fire = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [settings.controls, screenState, remappingAction]);

  // Touch control helper
  const setVirtualKey = (key: keyof KeysState, active: boolean) => {
    soundEngine.initAudio();
    keysRef.current[key] = active;
    if (active && key === 'run') {
      keysRef.current.fire = true;
    }
  };

  // Main Canvas Render & Fixed Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;

    let requestRef: number;
    let lastTime = performance.now();
    let frameCounter = 0;
    let fpsTimeCounter = 0;
    let timerCounter = 0;

    const loop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      frameCounter++;
      fpsTimeCounter += dt;
      if (fpsTimeCounter >= 1000) {
        setFps(frameCounter);
        frameCounter = 0;
        fpsTimeCounter = 0;
      }

      if (screenState === 'playing') {
        const state = gameStateRef.current;

        timerCounter += dt;
        if (timerCounter >= 1000) {
          timerCounter -= 1000;
          setGameTime((prev) => {
            if (prev <= 1) {
              state.player.dead = true;
              state.player.deathTimer = 2000;
              state.player.vy = -0.3;
              state.player.lives -= 1;
              soundEngine.playJingle('death');
              return 0;
            }
            return prev - 1;
          });
        }

        const currentMarioChunk = Math.floor(state.player.x / (16 * TILE_SIZE));
        while (state.highestGeneratedChunk < currentMarioChunk + 4) {
          state.highestGeneratedChunk++;
          const data = generateChunk(state.highestGeneratedChunk);
          state.chunks.set(state.highestGeneratedChunk, data.chunk);
          state.enemies.push(...data.enemies);
        }

        const res = updateEngine(
          dt,
          state.player,
          keysRef.current,
          state.chunks,
          state.enemies,
          state.powerUps,
          state.fireballs,
          state.bowserFlames,
          state.particles,
          state.floatingTexts,
          state.cameraX
        );
        state.cameraX = res.cameraX;

        checkAndSaveHighScore(state.player.score);

        if (res.stageCleared) {
          soundEngine.stopBGM();
          soundEngine.playJingle('level_clear', () => {
            startNewGame(gameMode);
          });
        }

        if (state.player.dead && state.player.deathTimer <= 0) {
          if (state.player.lives > 0) {
            state.player.dead = false;
            state.player.x = state.cameraX + 32;
            state.player.y = 176;
            state.player.vx = 0;
            state.player.vy = 0;
            state.player.state = 'small';
            state.player.iframeTimer = 2000;
            setGameTime(400);
            setStageIntroTimer(2);
            setScreenState('stage_intro');
          } else {
            soundEngine.stopBGM();
            soundEngine.playJingle('game_over');
            setScreenState('game_over');
          }
        }

        const pruned = pruneFarObjects(
          state.chunks,
          state.enemies,
          state.powerUps,
          state.cameraX
        );
        state.enemies = pruned.enemies;
        state.powerUps = pruned.powerUps;

        render(
          ctx,
          state.player,
          state.cameraX,
          state.chunks,
          state.enemies,
          state.powerUps,
          state.fireballs,
          state.bowserFlames,
          state.particles,
          state.floatingTexts,
          res.currentBiome,
          gameTime,
          settings.showFPS ? fps : undefined
        );
      } else {
        const state = gameStateRef.current;
        render(
          ctx,
          state.player,
          state.cameraX,
          state.chunks,
          state.enemies,
          state.powerUps,
          state.fireballs,
          state.bowserFlames,
          state.particles,
          state.floatingTexts,
          'overworld',
          gameTime
        );
      }

      requestRef = requestAnimationFrame(loop);
    };

    requestRef = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef);
  }, [screenState, gameTime, settings.showFPS, gameMode, checkAndSaveHighScore]);

  // RENDER CANVAS FUNCTIONS
  const render = (
    ctx: CanvasRenderingContext2D,
    player: Player,
    cameraX: number,
    chunks: Map<number, Chunk>,
    enemies: Enemy[],
    powerUps: PowerUp[],
    fireballs: Fireball[],
    bowserFlames: BowserFlame[],
    particles: Particle[],
    floatingTexts: FloatingText[],
    biome: Biome,
    timeRemaining: number,
    fpsVal?: number
  ) => {
    ctx.imageSmoothingEnabled = false;

    let skyColor = '#5c94fc';
    if (biome === 'underground' || biome === 'castle') skyColor = '#000000';
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (biome === 'overworld') {
      ctx.fillStyle = '#ffffff';
      const cloud1X = (50 - cameraX * 0.3) % 400;
      ctx.fillRect(cloud1X, 30, 32, 12);
      ctx.fillRect(cloud1X + 8, 22, 16, 8);

      const cloud2X = (220 - cameraX * 0.3) % 400;
      ctx.fillRect(cloud2X, 50, 48, 14);
      ctx.fillRect(cloud2X + 12, 40, 24, 10);
    }

    chunks.forEach((chunk) => {
      const chunkX = chunk.startX - cameraX;
      if (chunkX + 256 < 0 || chunkX > SCREEN_WIDTH) return;

      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 16; c++) {
          const tile = chunk.tiles[r][c];
          if (tile !== 0) {
            drawTile(ctx, tile, chunkX + c * TILE_SIZE, r * TILE_SIZE, chunk.biome);
          }
        }
      }
    });

    powerUps.forEach((p) => drawPowerUp(ctx, p, cameraX));
    enemies.forEach((e) => drawEnemy(ctx, e, cameraX));
    fireballs.forEach((fb) => drawFireball(ctx, fb, cameraX));
    bowserFlames.forEach((bf) => drawBowserFlame(ctx, bf, cameraX));

    particles.forEach((pt) => {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - cameraX, pt.y, pt.size, pt.size);
    });

    floatingTexts.forEach((ft) => {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(ft.text, ft.x - cameraX, ft.y);
    });

    drawPlayer(ctx, player, cameraX);
    drawHUD(ctx, player, biome, timeRemaining, fpsVal);
  };

  const drawTile = (
    ctx: CanvasRenderingContext2D,
    type: number,
    x: number,
    y: number,
    biome: Biome
  ) => {
    ctx.save();
    ctx.translate(x, y);

    switch (type) {
      case TILE_GROUND:
      case TILE_BRICK:
        ctx.fillStyle = biome === 'underground' ? '#008888' : '#c84c0c';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, TILE_SIZE, 1);
        ctx.fillRect(0, 8, TILE_SIZE, 1);
        ctx.fillRect(8, 0, 1, 8);
        ctx.fillRect(4, 8, 1, 8);
        break;

      case TILE_QUESTION_COIN:
      case TILE_QUESTION_POWERUP:
      case TILE_QUESTION_STAR:
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(6, 3, 4, 2);
        ctx.fillRect(8, 5, 2, 3);
        ctx.fillRect(6, 8, 4, 2);
        ctx.fillRect(7, 11, 2, 2);
        break;

      case TILE_USED_BLOCK:
        ctx.fillStyle = '#8d7800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        break;

      case TILE_HARD_BLOCK:
      case TILE_CASTLE_WALL:
        ctx.fillStyle = biome === 'castle' ? '#d82800' : '#c84c0c';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
        break;

      case TILE_PIPE_TOP_LEFT:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, TILE_SIZE, 1);
        ctx.fillRect(0, 0, 1, TILE_SIZE);
        ctx.fillStyle = '#b8f818';
        ctx.fillRect(2, 2, 3, TILE_SIZE - 2);
        break;

      case TILE_PIPE_TOP_RIGHT:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, TILE_SIZE, 1);
        ctx.fillRect(TILE_SIZE - 1, 0, 1, TILE_SIZE);
        break;

      case TILE_PIPE_BODY_LEFT:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1, TILE_SIZE);
        ctx.fillStyle = '#b8f818';
        ctx.fillRect(2, 0, 3, TILE_SIZE);
        break;

      case TILE_PIPE_BODY_RIGHT:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(TILE_SIZE - 1, 0, 1, TILE_SIZE);
        break;

      case TILE_CASTLE_BRIDGE:
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(0, 4, TILE_SIZE, 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 4, TILE_SIZE, 1);
        ctx.fillRect(0, 11, TILE_SIZE, 1);
        break;

      case TILE_CASTLE_AXE:
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(4, 2, 8, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, 4, 4, 4);
        break;

      case TILE_LAVA_TOP:
        ctx.fillStyle = '#d82800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(0, 0, TILE_SIZE, 4);
        break;
    }

    ctx.restore();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player, cameraX: number) => {
    if (player.iframeTimer > 0 && Math.floor(player.iframeTimer / 50) % 2 === 0) {
      return;
    }

    const sx = player.x - cameraX;
    const sy = player.y;

    ctx.save();
    ctx.translate(sx + player.width / 2, sy);

    if (player.direction === -1) {
      ctx.scale(-1, 1);
    }
    ctx.translate(-player.width / 2, 0);

    let hatShirtColor = '#ff0000';
    let overallsColor = '#0000ff';

    if (player.state === 'fire') {
      hatShirtColor = '#ffffff';
      overallsColor = '#ff0000';
    } else if (player.starTimer > 0) {
      const starColors = ['#ff0000', '#f8b800', '#00a800', '#5c94fc'];
      const cIdx = Math.floor(Date.now() / 100) % starColors.length;
      hatShirtColor = starColors[cIdx];
      overallsColor = starColors[(cIdx + 1) % starColors.length];
    }

    if (player.state === 'small') {
      ctx.fillStyle = hatShirtColor;
      ctx.fillRect(2, 0, 8, 3);
      ctx.fillRect(0, 3, 12, 1);
      ctx.fillRect(2, 7, 8, 5);

      ctx.fillStyle = '#ffcc99';
      ctx.fillRect(2, 4, 8, 3);
      ctx.fillRect(0, 8, 3, 3);
      ctx.fillRect(9, 8, 3, 3);

      ctx.fillStyle = overallsColor;
      ctx.fillRect(4, 9, 4, 5);
      ctx.fillRect(2, 12, 2, 4);
      ctx.fillRect(8, 12, 2, 4);

      ctx.fillStyle = '#8b4513';
      ctx.fillRect(0, 14, 4, 2);
      ctx.fillRect(8, 14, 4, 2);
    } else {
      ctx.fillStyle = hatShirtColor;
      ctx.fillRect(2, 0, 8, 4);
      ctx.fillRect(0, 4, 12, 2);
      ctx.fillRect(2, 10, 8, 10);

      ctx.fillStyle = '#ffcc99';
      ctx.fillRect(2, 6, 8, 4);
      ctx.fillRect(0, 12, 3, 4);
      ctx.fillRect(9, 12, 3, 4);

      ctx.fillStyle = overallsColor;
      ctx.fillRect(3, 14, 6, 10);
      ctx.fillRect(1, 22, 4, 6);
      ctx.fillRect(7, 22, 4, 6);

      ctx.fillStyle = '#8b4513';
      ctx.fillRect(0, 26, 5, 2);
      ctx.fillRect(7, 26, 5, 2);
    }

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: Enemy, cameraX: number) => {
    const sx = enemy.x - cameraX;
    const sy = enemy.y;

    if (sx < -32 || sx > SCREEN_WIDTH + 32) return;

    ctx.save();
    ctx.translate(sx, sy);

    switch (enemy.type) {
      case 'goomba':
        ctx.fillStyle = '#c84c0c';
        if (enemy.state === 'squished') {
          ctx.fillRect(0, 12, 16, 4);
        } else {
          ctx.fillRect(4, 0, 8, 4);
          ctx.fillRect(2, 4, 12, 8);
          ctx.fillStyle = '#ffcc99';
          ctx.fillRect(4, 8, 8, 4);
          ctx.fillStyle = '#000000';
          ctx.fillRect(3, 12, 4, 4);
          ctx.fillRect(9, 12, 4, 4);
        }
        break;

      case 'koopa_green':
      case 'koopa_red':
        ctx.fillStyle = enemy.type === 'koopa_green' ? '#00a800' : '#d82800';
        if (enemy.state === 'shell_idle' || enemy.state === 'shell_moving') {
          ctx.fillRect(2, 4, 12, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(4, 8, 4, 4);
        } else {
          ctx.fillRect(4, 0, 8, 6);
          ctx.fillRect(2, 6, 12, 10);
        }
        break;

      case 'piranha':
        ctx.fillStyle = '#d82800';
        ctx.fillRect(2, 0, 12, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(4, 4, 2, 4);
        ctx.fillRect(10, 4, 2, 4);
        break;

      case 'spiny':
        ctx.fillStyle = '#d82800';
        ctx.fillRect(2, 4, 12, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(4, 0, 2, 4);
        ctx.fillRect(10, 0, 2, 4);
        break;

      case 'buzzy_beetle':
        ctx.fillStyle = '#5c94fc';
        ctx.fillRect(2, 4, 12, 12);
        break;

      case 'lakitu':
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 12, 16, 12);
        ctx.fillStyle = '#00a800';
        ctx.fillRect(4, 2, 8, 10);
        break;

      case 'bowser':
        ctx.fillStyle = '#00a800';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#d82800';
        ctx.fillRect(4, 0, 8, 8);
        ctx.fillRect(20, 4, 8, 8);
        break;
    }

    ctx.restore();
  };

  const drawPowerUp = (ctx: CanvasRenderingContext2D, p: PowerUp, cameraX: number) => {
    const sx = p.x - cameraX;
    const sy = p.y;

    ctx.save();
    ctx.translate(sx, sy);

    if (p.type === 'mushroom') {
      ctx.fillStyle = '#d82800';
      ctx.fillRect(2, 0, 12, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 2, 4, 4);
      ctx.fillStyle = '#ffcc99';
      ctx.fillRect(4, 8, 8, 8);
    } else if (p.type === 'flower') {
      ctx.fillStyle = '#ff9838';
      ctx.fillRect(2, 0, 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 4, 4, 4);
    } else if (p.type === 'star') {
      ctx.fillStyle = '#f8b800';
      ctx.fillRect(2, 0, 12, 16);
    }

    ctx.restore();
  };

  const drawFireball = (ctx: CanvasRenderingContext2D, fb: Fireball, cameraX: number) => {
    ctx.fillStyle = '#fc9838';
    ctx.fillRect(fb.x - cameraX, fb.y, 8, 8);
  };

  const drawBowserFlame = (ctx: CanvasRenderingContext2D, bf: BowserFlame, cameraX: number) => {
    ctx.fillStyle = '#d82800';
    ctx.fillRect(bf.x - cameraX, bf.y, 24, 12);
    ctx.fillStyle = '#f8b800';
    ctx.fillRect(bf.x - cameraX + 4, bf.y + 2, 16, 8);
  };

  const drawHUD = (
    ctx: CanvasRenderingContext2D,
    player: Player,
    biome: Biome,
    timeRemaining: number,
    fpsVal?: number
  ) => {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';

    ctx.fillText('MARIO', 12, 14);
    ctx.fillText('WORLD', 105, 14);
    ctx.fillText('TIME', 170, 14);
    ctx.fillText('LIVES', 215, 14);

    const scoreStr = player.score.toString().padStart(6, '0');
    const coinsStr = `$x${player.coins.toString().padStart(2, '0')}`;
    const worldStr = biome === 'overworld' ? '1-1' : biome === 'underground' ? '1-2' : '1-4';

    ctx.fillText(scoreStr, 12, 24);
    ctx.fillText(coinsStr, 65, 24);
    ctx.fillText(worldStr, 110, 24);
    ctx.fillText(timeRemaining.toString().padStart(3, '0'), 173, 24);
    ctx.fillText(`x${player.lives}`, 220, 24);

    if (fpsVal !== undefined) {
      ctx.fillStyle = '#00ff00';
      ctx.fillText(`${fpsVal} FPS`, 210, 232);
    }
  };

  const getContainerAspectClass = () => {
    if (settings.aspectRatio === '16_9') return 'aspect-[16/9]';
    if (settings.aspectRatio === '4_3') return 'aspect-[4/3]';
    return 'w-full h-full max-h-screen aspect-[4/3]';
  };

  const showTouch =
    settings.touchControls === 'always' ||
    (settings.touchControls === 'auto' && isMobile);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full h-full min-h-screen bg-black text-white select-none overflow-hidden font-mono"
    >
      <div
        className={`relative flex items-center justify-center bg-black shadow-2xl border-2 border-gray-800 rounded-lg overflow-hidden max-w-6xl w-full ${getContainerAspectClass()}`}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />

        {settings.crtFilter && (
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none z-10 opacity-70" />
        )}

        {/* --- RETRO MAIN MENU OVERLAY --- */}
        {screenState === 'menu' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 z-20 text-center">
            <div className="mb-8 transform hover:scale-105 transition-transform">
              <h1 className="text-4xl sm:text-6xl font-black tracking-widest text-red-600 drop-shadow-[0_4px_0_rgba(255,255,255,0.8)] animate-pulse">
                SUPER MARIO
              </h1>
              <p className="text-yellow-400 text-sm sm:text-lg tracking-wider font-bold mt-2">
                RETRO BROS EDITION
              </p>
            </div>

            <div className="mb-6 bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wider">
              HIGH SCORE - {highScore.toString().padStart(6, '0')}
            </div>

            <div className="flex flex-col space-y-3 w-64">
              <button
                onClick={() => startNewGame('classic')}
                className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white py-3 rounded-lg font-bold tracking-widest shadow-lg border-b-4 border-red-800 transition"
              >
                1 PLAYER GAME
              </button>
              <button
                onClick={() => startNewGame('endless')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white py-3 rounded-lg font-bold tracking-widest shadow-lg border-b-4 border-emerald-800 transition"
              >
                ENDLESS RUNNER
              </button>
              <button
                onClick={() => navigateToScreen('settings')}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3 rounded-lg font-bold tracking-widest shadow-lg border-b-4 border-blue-800 transition"
              >
                SETTINGS
              </button>
              <button
                onClick={() => navigateToScreen('controls')}
                className="w-full bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white py-3 rounded-lg font-bold tracking-widest shadow-lg border-b-4 border-gray-900 transition"
              >
                CONTROLS
              </button>
            </div>
          </div>
        )}

        {/* --- STAGE INTRO SCREEN --- */}
        {screenState === 'stage_intro' && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-20 space-y-4">
            <h2 className="text-yellow-400 text-2xl font-bold tracking-widest">
              {gameMode === 'classic' ? 'WORLD 1-1' : 'ENDLESS RUNNER'}
            </h2>
            <div className="flex items-center space-x-3 text-xl font-bold">
              <span className="text-red-500">MARIO</span>
              <span>x</span>
              <span>{gameStateRef.current.player.lives}</span>
            </div>
          </div>
        )}

        {/* --- PAUSE MENU OVERLAY --- */}
        {screenState === 'paused' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-20">
            <h2 className="text-3xl font-bold text-yellow-400 mb-6 tracking-widest animate-bounce">
              PAUSED
            </h2>
            <div className="flex flex-col space-y-3 w-56">
              <button
                onClick={() => setScreenState('playing')}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded font-bold shadow transition"
              >
                RESUME
              </button>
              <button
                onClick={() => navigateToScreen('settings')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded font-bold shadow transition"
              >
                SETTINGS
              </button>
              <button
                onClick={() => startNewGame(gameMode)}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded font-bold shadow transition"
              >
                RESTART
              </button>
              <button
                onClick={() => navigateToScreen('menu')}
                className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded font-bold shadow transition"
              >
                QUIT TO MENU
              </button>
            </div>
          </div>
        )}

        {/* --- GAME OVER SCREEN --- */}
        {screenState === 'game_over' && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 z-20 space-y-6">
            <h1 className="text-4xl sm:text-5xl font-black text-red-600 tracking-widest animate-pulse">
              GAME OVER
            </h1>
            <p className="text-yellow-400 text-lg font-bold">
              FINAL SCORE: {gameStateRef.current.player.score}
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => startNewGame(gameMode)}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded font-bold shadow transition"
              >
                TRY AGAIN
              </button>
              <button
                onClick={() => navigateToScreen('menu')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2.5 rounded font-bold shadow transition"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        )}

        {/* --- SETTINGS PANEL --- */}
        {screenState === 'settings' && (
          <div className="absolute inset-0 bg-gray-950/95 flex flex-col items-center justify-center p-6 z-30 max-w-lg mx-auto w-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-yellow-400 mb-6 tracking-wider">
              SETTINGS
            </h2>

            <div className="w-full space-y-5 text-sm">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-300">Master Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.masterVolume}
                    onChange={(e) =>
                      setSettings({ ...settings, masterVolume: parseFloat(e.target.value) })
                    }
                    className="w-32 accent-red-500"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-300">Music Volume (BGM)</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.musicVolume}
                    onChange={(e) =>
                      setSettings({ ...settings, musicVolume: parseFloat(e.target.value) })
                    }
                    className="w-32 accent-red-500"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-300">SFX Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.sfxVolume}
                    onChange={(e) =>
                      setSettings({ ...settings, sfxVolume: parseFloat(e.target.value) })
                    }
                    className="w-32 accent-red-500"
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                  <span className="font-bold text-gray-300">Mute Audio</span>
                  <button
                    onClick={() => setSettings({ ...settings, muted: !settings.muted })}
                    className={`px-3 py-1 rounded font-bold text-xs ${
                      settings.muted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {settings.muted ? 'MUTED' : 'ACTIVE'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-300">Aspect Ratio</span>
                  <select
                    value={settings.aspectRatio}
                    onChange={(e) =>
                      setSettings({ ...settings, aspectRatio: e.target.value as any })
                    }
                    className="bg-gray-800 text-white px-2 py-1 rounded text-xs border border-gray-700"
                  >
                    <option value="auto">Auto Fullscreen</option>
                    <option value="4_3">Original 4:3</option>
                    <option value="16_9">Stretch 16:9</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-300">CRT Scanlines Filter</span>
                  <button
                    onClick={() =>
                      setSettings({ ...settings, crtFilter: !settings.crtFilter })
                    }
                    className={`px-3 py-1 rounded font-bold text-xs ${
                      settings.crtFilter ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {settings.crtFilter ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-300">Show FPS / Debug</span>
                  <button
                    onClick={() =>
                      setSettings({ ...settings, showFPS: !settings.showFPS })
                    }
                    className={`px-3 py-1 rounded font-bold text-xs ${
                      settings.showFPS ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {settings.showFPS ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex justify-between items-center">
                <span className="font-bold text-gray-300">Touch Controls</span>
                <select
                  value={settings.touchControls}
                  onChange={(e) =>
                    setSettings({ ...settings, touchControls: e.target.value as any })
                  }
                  className="bg-gray-800 text-white px-2 py-1 rounded text-xs border border-gray-700"
                >
                  <option value="auto">Auto Detect</option>
                  <option value="always">Always On</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => navigateToScreen('menu')}
              className="mt-6 bg-red-600 hover:bg-red-500 text-white px-8 py-2.5 rounded font-bold shadow transition"
            >
              BACK TO MENU
            </button>
          </div>
        )}

        {/* --- CONTROLS REMAPPING PANEL --- */}
        {screenState === 'controls' && (
          <div className="absolute inset-0 bg-gray-950/95 flex flex-col items-center justify-center p-6 z-30 max-w-lg mx-auto w-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4 tracking-wider">
              CONTROLS CONFIG
            </h2>

            {remappingAction && (
              <div className="bg-red-600 text-white px-4 py-2 rounded mb-4 text-xs font-bold animate-bounce">
                PRESS ANY KEY FOR [{remappingAction.toUpperCase()}] ...
              </div>
            )}

            <div className="w-full space-y-2 text-xs">
              {Object.entries(settings.controls).map(([action, keys]) => (
                <div
                  key={action}
                  className="bg-gray-900 p-3 rounded border border-gray-800 flex justify-between items-center"
                >
                  <span className="font-bold text-gray-300 tracking-wider">
                    {action.toUpperCase()}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="bg-gray-800 text-yellow-400 px-2.5 py-1 rounded font-mono border border-gray-700">
                      {keys.join(' / ')}
                    </span>
                    <button
                      onClick={() => setRemappingAction(action as any)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded font-bold text-[10px]"
                    >
                      REMAP
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigateToScreen('menu')}
              className="mt-6 bg-red-600 hover:bg-red-500 text-white px-8 py-2.5 rounded font-bold shadow transition"
            >
              BACK TO MENU
            </button>
          </div>
        )}

        {/* Fullscreen Button Bar */}
        <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
          <button
            onClick={toggleFullscreen}
            className="bg-black/60 hover:bg-black/80 active:bg-black text-white p-2 rounded border border-gray-600 text-xs font-bold backdrop-blur transition"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? '⏹ EXIT FS' : '⛶ FULLSCREEN (F)'}
          </button>
        </div>
      </div>

      {/* --- SEMI-TRANSPARENT TOUCH CONTROLS FOR MOBILE / TOUCH --- */}
      {showTouch && (
        <div className="w-full max-w-4xl flex items-center justify-between p-4 bg-gray-950/80 backdrop-blur text-white border-t border-gray-800 z-20">
          <div className="grid grid-cols-3 gap-2 w-36 h-36">
            <div />
            <button
              onTouchStart={() => setVirtualKey('jump', true)}
              onTouchEnd={() => setVirtualKey('jump', false)}
              onMouseDown={() => setVirtualKey('jump', true)}
              onMouseUp={() => setVirtualKey('jump', false)}
              className="bg-gray-800/80 active:bg-yellow-500/80 rounded flex items-center justify-center text-xl font-bold border border-gray-700 active:text-black"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={() => setVirtualKey('left', true)}
              onTouchEnd={() => setVirtualKey('left', false)}
              onMouseDown={() => setVirtualKey('left', true)}
              onMouseUp={() => setVirtualKey('left', false)}
              className="bg-gray-800/80 active:bg-yellow-500/80 rounded flex items-center justify-center text-xl font-bold border border-gray-700 active:text-black"
            >
              ◀
            </button>
            <button
              onTouchStart={() => setVirtualKey('down', true)}
              onTouchEnd={() => setVirtualKey('down', false)}
              onMouseDown={() => setVirtualKey('down', true)}
              onMouseUp={() => setVirtualKey('down', false)}
              className="bg-gray-800/80 active:bg-yellow-500/80 rounded flex items-center justify-center text-xl font-bold border border-gray-700 active:text-black"
            >
              ▼
            </button>
            <button
              onTouchStart={() => setVirtualKey('right', true)}
              onTouchEnd={() => setVirtualKey('right', false)}
              onMouseDown={() => setVirtualKey('right', true)}
              onMouseUp={() => setVirtualKey('right', false)}
              className="bg-gray-800/80 active:bg-yellow-500/80 rounded flex items-center justify-center text-xl font-bold border border-gray-700 active:text-black"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onTouchStart={() => setVirtualKey('run', true)}
              onTouchEnd={() => setVirtualKey('run', false)}
              onMouseDown={() => setVirtualKey('run', true)}
              onMouseUp={() => setVirtualKey('run', false)}
              className="w-16 h-16 bg-red-600/80 active:bg-red-400 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-red-400"
            >
              B (Run)
            </button>
            <button
              onTouchStart={() => setVirtualKey('jump', true)}
              onTouchEnd={() => setVirtualKey('jump', false)}
              onMouseDown={() => setVirtualKey('jump', true)}
              onMouseUp={() => setVirtualKey('jump', false)}
              className="w-16 h-16 bg-yellow-500/80 active:bg-yellow-300 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-yellow-300 text-black"
            >
              A (Jump)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarioGame;
