'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Biome,
  BowserFlame,
  Chunk,
  Enemy,
  Fireball,
  FloatingText,
  KeysState,
  Particle,
  Player,
  PowerUp,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
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

export const MarioGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [gameTime, setGameTime] = useState<number>(400);

  // Input states ref so event handlers write to it without triggering re-renders
  const keysRef = useRef<KeysState>({
    left: false,
    right: false,
    down: false,
    jump: false,
    run: false,
    fire: false,
  });

  // Touch control handlers
  const setKey = (key: keyof KeysState, active: boolean) => {
    keysRef.current[key] = active;
    if (active && key === 'run') {
      keysRef.current.fire = true;
    }
  };

  useEffect(() => {
    // Mobile touch detection
    const checkMobile = () => {
      setIsMobile(
        'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth <= 768
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed internal resolution canvas scaling setup
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;

    // Game Engine State Initialization
    const player: Player = {
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

    let cameraX = 0;
    const chunks = new Map<number, Chunk>();
    let enemies: Enemy[] = [];
    let powerUps: PowerUp[] = [];
    const fireballs: Fireball[] = [];
    const bowserFlames: BowserFlame[] = [];
    const particles: Particle[] = [];
    const floatingTexts: FloatingText[] = [];

    // Pre-generate initial 4 chunks (0, 1, 2, 3)
    for (let c = 0; c < 4; c++) {
      const data = generateChunk(c);
      chunks.set(c, data.chunk);
      enemies.push(...data.enemies);
    }

    let highestGeneratedChunk = 3;

    // Keydown / Keyup Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') keysRef.current.left = true;
      if (code === 'ArrowRight' || code === 'KeyD') keysRef.current.right = true;
      if (code === 'ArrowDown' || code === 'KeyS') keysRef.current.down = true;
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') keysRef.current.jump = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') {
        keysRef.current.run = true;
        keysRef.current.fire = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') keysRef.current.left = false;
      if (code === 'ArrowRight' || code === 'KeyD') keysRef.current.right = false;
      if (code === 'ArrowDown' || code === 'KeyS') keysRef.current.down = false;
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') keysRef.current.jump = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') {
        keysRef.current.run = false;
        keysRef.current.fire = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Main Game Loop Variables
    let lastTime = performance.now();
    let requestRef: number;
    let timerCounter = 0;

    const gameLoop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      // Update timer countdown
      timerCounter += dt;
      if (timerCounter >= 1000) {
        timerCounter -= 1000;
        setGameTime((prev) => Math.max(0, prev - 1));
      }

      // Check if we need to generate new chunks ahead of Mario
      const currentMarioChunk = Math.floor(player.x / (16 * TILE_SIZE));
      while (highestGeneratedChunk < currentMarioChunk + 4) {
        highestGeneratedChunk++;
        const data = generateChunk(highestGeneratedChunk);
        chunks.set(highestGeneratedChunk, data.chunk);
        enemies.push(...data.enemies);
      }

      // Run Engine Update
      const res = updateEngine(
        dt,
        player,
        keysRef.current,
        chunks,
        enemies,
        powerUps,
        fireballs,
        bowserFlames,
        particles,
        floatingTexts,
        cameraX
      );
      cameraX = res.cameraX;

      // Reset Player on Death & Respawn
      if (player.dead && player.deathTimer <= 0) {
        if (player.lives > 0) {
          // Respawn at current camera start
          player.dead = false;
          player.x = cameraX + 32;
          player.y = 176;
          player.vx = 0;
          player.vy = 0;
          player.state = 'small';
          player.iframeTimer = 2000;
        } else {
          // Reset Game
          player.lives = 3;
          player.score = 0;
          player.coins = 0;
          player.distance = 32;
          player.x = 32;
          player.y = 176;
          player.vx = 0;
          player.vy = 0;
          player.dead = false;
          player.state = 'small';
          cameraX = 0;
          chunks.clear();
          enemies = [];
          powerUps = [];
          for (let c = 0; c < 4; c++) {
            const data = generateChunk(c);
            chunks.set(c, data.chunk);
            enemies.push(...data.enemies);
          }
          highestGeneratedChunk = 3;
          setGameTime(400);
        }
      }

      // Run Memory Pruning
      const pruned = pruneFarObjects(chunks, enemies, powerUps, cameraX);
      enemies = pruned.enemies;
      powerUps = pruned.powerUps;

      // Render Everything
      render(ctx, player, cameraX, chunks, enemies, powerUps, fireballs, bowserFlames, particles, floatingTexts);

      requestRef = requestAnimationFrame(gameLoop);
    };

    requestRef = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(requestRef);
    };
  }, []);

  // --- RENDERING FUNCTIONS ---
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
    floatingTexts: FloatingText[]
  ) => {
    ctx.imageSmoothingEnabled = false;

    // Determine current background sky color based on camera position biome
    const currentChunkIndex = Math.floor(cameraX / (16 * TILE_SIZE));
    const currentBiome = getBiomeForChunk(currentChunkIndex);

    let skyColor = '#5c94fc'; // Overworld blue
    if (currentBiome === 'underground') skyColor = '#000000';
    if (currentBiome === 'castle') skyColor = '#000000';

    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Draw Background Elements (Clouds / Castle Walls)
    if (currentBiome === 'overworld') {
      drawParallaxClouds(ctx, cameraX);
    }

    // Render Chunks & Tiles
    chunks.forEach((chunk) => {
      const chunkX = chunk.startX - cameraX;
      if (chunkX + 256 < 0 || chunkX > SCREEN_WIDTH) return; // culling

      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 16; c++) {
          const tile = chunk.tiles[r][c];
          if (tile !== 0) {
            const tx = chunkX + c * TILE_SIZE;
            const ty = r * TILE_SIZE;
            drawTile(ctx, tile, tx, ty, chunk.biome);
          }
        }
      }
    });

    // Render Power-Ups
    powerUps.forEach((p) => drawPowerUp(ctx, p, cameraX));

    // Render Enemies
    enemies.forEach((e) => drawEnemy(ctx, e, cameraX));

    // Render Fireballs & Bowser Flames
    fireballs.forEach((fb) => drawFireball(ctx, fb, cameraX));
    bowserFlames.forEach((bf) => drawBowserFlame(ctx, bf, cameraX));

    // Render Particles & Floating Texts
    particles.forEach((pt) => {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - cameraX, pt.y, pt.size, pt.size);
    });

    floatingTexts.forEach((ft) => {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(ft.text, ft.x - cameraX, ft.y);
    });

    // Render Player
    drawPlayer(ctx, player, cameraX);

    // Render NES HUD
    drawHUD(ctx, player, currentBiome);
  };

  const drawParallaxClouds = (ctx: CanvasRenderingContext2D, cameraX: number) => {
    ctx.fillStyle = '#ffffff';
    const cloud1X = (50 - cameraX * 0.3) % 400;
    ctx.fillRect(cloud1X, 30, 32, 12);
    ctx.fillRect(cloud1X + 8, 22, 16, 8);

    const cloud2X = (220 - cameraX * 0.3) % 400;
    ctx.fillRect(cloud2X, 50, 48, 14);
    ctx.fillRect(cloud2X + 12, 40, 24, 10);
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
        ctx.fillStyle = biome === 'underground' ? '#008888' : '#c84c0c';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, TILE_SIZE, 1);
        ctx.fillRect(0, 8, TILE_SIZE, 1);
        ctx.fillRect(8, 0, 1, 8);
        ctx.fillRect(4, 8, 1, 8);
        break;

      case TILE_BRICK:
        ctx.fillStyle = biome === 'underground' ? '#008888' : '#c84c0c';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, TILE_SIZE, 1);
        ctx.fillRect(0, 8, TILE_SIZE, 1);
        ctx.fillRect(8, 0, 1, 8);
        ctx.fillRect(4, 8, 1, 8);
        ctx.fillRect(12, 8, 1, 8);
        break;

      case TILE_QUESTION_COIN:
      case TILE_QUESTION_POWERUP:
      case TILE_QUESTION_STAR:
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#c84c0c'; // ? mark
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
    // Flashing iframe / star effect
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

    // Color Palette based on State
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
      // Small Mario Sprite (12x16)
      ctx.fillStyle = hatShirtColor;
      ctx.fillRect(2, 0, 8, 3); // hat
      ctx.fillRect(0, 3, 12, 1); // brim
      ctx.fillRect(2, 7, 8, 5); // shirt

      ctx.fillStyle = '#ffcc99'; // skin
      ctx.fillRect(2, 4, 8, 3);
      ctx.fillRect(0, 8, 3, 3); // hand L
      ctx.fillRect(9, 8, 3, 3); // hand R

      ctx.fillStyle = overallsColor;
      ctx.fillRect(4, 9, 4, 5);
      ctx.fillRect(2, 12, 2, 4);
      ctx.fillRect(8, 12, 2, 4);

      ctx.fillStyle = '#8b4513'; // boots
      ctx.fillRect(0, 14, 4, 2);
      ctx.fillRect(8, 14, 4, 2);
    } else {
      // Super / Fire Mario Sprite (12x28)
      ctx.fillStyle = hatShirtColor;
      ctx.fillRect(2, 0, 8, 4); // hat
      ctx.fillRect(0, 4, 12, 2); // brim
      ctx.fillRect(2, 10, 8, 10); // shirt

      ctx.fillStyle = '#ffcc99'; // skin
      ctx.fillRect(2, 6, 8, 4);
      ctx.fillRect(0, 12, 3, 4);
      ctx.fillRect(9, 12, 3, 4);

      ctx.fillStyle = overallsColor;
      ctx.fillRect(3, 14, 6, 10);
      ctx.fillRect(1, 22, 4, 6);
      ctx.fillRect(7, 22, 4, 6);

      ctx.fillStyle = '#8b4513'; // boots
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
          ctx.fillRect(4, 0, 8, 6); // head
          ctx.fillRect(2, 6, 12, 10); // shell
        }
        break;

      case 'piranha':
        ctx.fillStyle = '#d82800';
        ctx.fillRect(2, 0, 12, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(4, 4, 2, 4); // teeth
        ctx.fillRect(10, 4, 2, 4);
        break;

      case 'spiny':
        ctx.fillStyle = '#d82800';
        ctx.fillRect(2, 4, 12, 12);
        ctx.fillStyle = '#ffffff'; // spikes
        ctx.fillRect(4, 0, 2, 4);
        ctx.fillRect(10, 0, 2, 4);
        break;

      case 'buzzy_beetle':
        ctx.fillStyle = '#5c94fc';
        ctx.fillRect(2, 4, 12, 12);
        break;

      case 'lakitu':
        ctx.fillStyle = '#ffffff'; // cloud
        ctx.fillRect(0, 12, 16, 12);
        ctx.fillStyle = '#00a800'; // lakitu
        ctx.fillRect(4, 2, 8, 10);
        break;

      case 'bowser':
        ctx.fillStyle = '#00a800';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#d82800'; // hair/spikes
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

  const drawBowserFlame = (
    ctx: CanvasRenderingContext2D,
    bf: BowserFlame,
    cameraX: number
  ) => {
    ctx.fillStyle = '#d82800';
    ctx.fillRect(bf.x - cameraX, bf.y, 24, 12);
    ctx.fillStyle = '#f8b800';
    ctx.fillRect(bf.x - cameraX + 4, bf.y + 2, 16, 8);
  };

  const drawHUD = (
    ctx: CanvasRenderingContext2D,
    player: Player,
    biome: Biome
  ) => {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';

    // Line 1 Labels
    ctx.fillText('MARIO', 16, 14);
    ctx.fillText('WORLD', 110, 14);
    ctx.fillText('TIME', 180, 14);
    ctx.fillText('LIVES', 220, 14);

    // Line 2 Values
    const scoreStr = player.score.toString().padStart(6, '0');
    const coinsStr = `$x${player.coins.toString().padStart(2, '0')}`;
    const worldStr = biome === 'overworld' ? '1-1' : biome === 'underground' ? '1-2' : '1-4';

    ctx.fillText(scoreStr, 16, 24);
    ctx.fillText(coinsStr, 70, 24);
    ctx.fillText(worldStr, 115, 24);
    ctx.fillText(gameTime.toString().padStart(3, '0'), 183, 24);
    ctx.fillText(`x${player.lives}`, 225, 24);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full h-full min-h-screen bg-black select-none overflow-hidden"
    >
      {/* Dynamic Responsive Canvas Container keeping 4:3 NES Aspect Ratio */}
      <div className="relative w-full max-w-4xl aspect-[4/3] flex items-center justify-center bg-black shadow-2xl border-4 border-gray-800 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Touch Controls Overlay for Mobile Devices */}
      {isMobile && (
        <div className="w-full max-w-4xl flex items-center justify-between p-4 bg-gray-900 text-white border-t border-gray-800">
          {/* D-Pad Controls */}
          <div className="grid grid-cols-3 gap-2 w-36 h-36">
            <div />
            <button
              onTouchStart={() => setKey('jump', true)}
              onTouchEnd={() => setKey('jump', false)}
              className="bg-gray-700 active:bg-gray-500 rounded flex items-center justify-center text-xl font-bold"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={() => setKey('left', true)}
              onTouchEnd={() => setKey('left', false)}
              className="bg-gray-700 active:bg-gray-500 rounded flex items-center justify-center text-xl font-bold"
            >
              ◀
            </button>
            <button
              onTouchStart={() => setKey('down', true)}
              onTouchEnd={() => setKey('down', false)}
              className="bg-gray-700 active:bg-gray-500 rounded flex items-center justify-center text-xl font-bold"
            >
              ▼
            </button>
            <button
              onTouchStart={() => setKey('right', true)}
              onTouchEnd={() => setKey('right', false)}
              className="bg-gray-700 active:bg-gray-500 rounded flex items-center justify-center text-xl font-bold"
            >
              ▶
            </button>
          </div>

          {/* Action Buttons (A / B) */}
          <div className="flex items-center space-x-4">
            <button
              onTouchStart={() => setKey('run', true)}
              onTouchEnd={() => setKey('run', false)}
              className="w-16 h-16 bg-red-600 active:bg-red-400 rounded-full flex items-center justify-center font-bold text-lg shadow-lg"
            >
              B / Fire
            </button>
            <button
              onTouchStart={() => setKey('jump', true)}
              onTouchEnd={() => setKey('jump', false)}
              className="w-16 h-16 bg-yellow-500 active:bg-yellow-300 rounded-full flex items-center justify-center font-bold text-lg shadow-lg"
            >
              A / Jump
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarioGame;
