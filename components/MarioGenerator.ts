import {
  Biome,
  Chunk,
  Enemy,
  PowerUp,
  CHUNK_WIDTH,
  CHUNK_HEIGHT,
  TILE_SIZE,
  TILE_EMPTY,
  TILE_GROUND,
  TILE_BRICK,
  TILE_QUESTION_COIN,
  TILE_QUESTION_POWERUP,
  TILE_QUESTION_STAR,
  TILE_HARD_BLOCK,
  TILE_PIPE_TOP_LEFT,
  TILE_PIPE_TOP_RIGHT,
  TILE_PIPE_BODY_LEFT,
  TILE_PIPE_BODY_RIGHT,
  TILE_CASTLE_WALL,
  TILE_CASTLE_AXE,
  TILE_CASTLE_BRIDGE,
  TILE_LAVA_TOP,
} from './MarioTypes';

// Seeded pseudo-random generator to ensure deterministic chunk generation when re-visited if needed
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function getBiomeForChunk(index: number): Biome {
  if (index === 0) return 'overworld';
  // Cycle biomes: 0-4 Overworld, 5-7 Underground, 8-9 Castle, etc.
  const cycle = index % 10;
  if (cycle >= 0 && cycle <= 4) return 'overworld';
  if (cycle >= 5 && cycle <= 7) return 'underground';
  return 'castle';
}

export interface GeneratedChunkData {
  chunk: Chunk;
  enemies: Enemy[];
}

export function generateChunk(chunkIndex: number): GeneratedChunkData {
  const biome = getBiomeForChunk(chunkIndex);
  const startX = chunkIndex * CHUNK_WIDTH * TILE_SIZE;

  // Initialize empty tile grid 15 rows x 16 cols
  const tiles: number[][] = Array.from({ length: CHUNK_HEIGHT }, () =>
    Array(CHUNK_WIDTH).fill(TILE_EMPTY)
  );

  const enemies: Enemy[] = [];

  // Helper to place ground rows (rows 13 & 14 by default)
  const placeGround = (colStart: number, colEnd: number, tileType: number = TILE_GROUND) => {
    for (let c = colStart; c < colEnd; c++) {
      tiles[13][c] = tileType;
      tiles[14][c] = tileType;
    }
  };

  if (chunkIndex === 0) {
    // Starting safe chunk
    placeGround(0, CHUNK_WIDTH);
    // Add a couple simple question blocks
    tiles[9][8] = TILE_QUESTION_COIN;
    tiles[9][9] = TILE_QUESTION_POWERUP;
    tiles[9][10] = TILE_BRICK;
    return {
      chunk: { index: chunkIndex, biome, tiles, startX },
      enemies,
    };
  }

  const rng = (offset: number) => pseudoRandom(chunkIndex * 100 + offset);

  if (biome === 'castle') {
    // Castle Biome
    // Check if this is a Boss Axe/Bridge chunk (every 10th chunk or last of castle cycle)
    const isBossChunk = chunkIndex % 10 === 9;

    if (isBossChunk) {
      // Lava pit with bridge and axe
      // Ground on left
      placeGround(0, 3, TILE_CASTLE_WALL);
      // Bridge in middle (rows 12)
      for (let c = 3; c < 12; c++) {
        tiles[12][c] = TILE_CASTLE_BRIDGE;
        tiles[13][c] = TILE_LAVA_TOP;
        tiles[14][c] = TILE_LAVA_TOP;
      }
      // Axe at position 12, row 11
      tiles[11][12] = TILE_CASTLE_AXE;
      // Castle wall on right
      placeGround(12, CHUNK_WIDTH, TILE_CASTLE_WALL);

      // Spawn Bowser on the bridge
      enemies.push({
        id: `bowser_${chunkIndex}`,
        type: 'bowser',
        x: startX + 7 * TILE_SIZE,
        y: 10 * TILE_SIZE,
        vx: -0.02,
        vy: 0,
        width: 32,
        height: 32,
        direction: -1,
        state: 'walking',
        deadTimer: 0,
        animTimer: 0,
        hp: 5,
        shootTimer: 0,
        jumpTimer: 0,
      });

      return {
        chunk: { index: chunkIndex, biome, tiles, startX, hasBowserAxe: true },
        enemies,
      };
    } else {
      // Castle regular layout
      placeGround(0, CHUNK_WIDTH, TILE_CASTLE_WALL);

      // Add castle obstacles, floating hard blocks, and lava gaps
      const gapStart = Math.floor(rng(1) * 4) + 6;
      const gapWidth = Math.floor(rng(2) * 2) + 2;
      for (let c = gapStart; c < gapStart + gapWidth && c < CHUNK_WIDTH - 2; c++) {
        tiles[13][c] = TILE_LAVA_TOP;
        tiles[14][c] = TILE_LAVA_TOP;
      }

      // Floating castle blocks
      for (let c = 2; c < CHUNK_WIDTH - 2; c += 3) {
        if (c < gapStart || c >= gapStart + gapWidth) {
          tiles[9][c] = TILE_HARD_BLOCK;
          if (rng(c) > 0.5) tiles[9][c + 1] = TILE_BRICK;
        }
      }

      // Spawn Castle mobs (Buzzy Beetle / Spiny)
      if (rng(10) > 0.4) {
        enemies.push({
          id: `buzzy_${chunkIndex}`,
          type: 'buzzy_beetle',
          x: startX + 4 * TILE_SIZE,
          y: 12 * TILE_SIZE,
          vx: -0.04,
          vy: 0,
          width: 16,
          height: 16,
          direction: -1,
          state: 'walking',
          deadTimer: 0,
          animTimer: 0,
        });
      }
    }
  } else if (biome === 'underground') {
    // Underground Biome
    placeGround(0, CHUNK_WIDTH, TILE_HARD_BLOCK);

    // Ceiling of underground
    for (let c = 0; c < CHUNK_WIDTH; c++) {
      tiles[0][c] = TILE_HARD_BLOCK;
      tiles[1][c] = TILE_HARD_BLOCK;
    }

    // Platforms & Blocks
    const layoutType = Math.floor(rng(3) * 3);
    if (layoutType === 0) {
      // Dual layer blocks
      for (let c = 3; c < 13; c++) {
        tiles[9][c] = c % 2 === 0 ? TILE_BRICK : TILE_QUESTION_COIN;
        if (c === 7) tiles[9][c] = TILE_QUESTION_POWERUP;
      }
    } else if (layoutType === 1) {
      // Staircase layout
      for (let step = 0; step < 4; step++) {
        for (let h = 0; h <= step; h++) {
          tiles[12 - h][3 + step] = TILE_HARD_BLOCK;
          tiles[12 - h][12 - step] = TILE_HARD_BLOCK;
        }
      }
    } else {
      // Pipe tunnel
      const pipeCol = 6;
      const pipeHeight = 4;
      for (let h = 0; h < pipeHeight; h++) {
        const r = 13 - pipeHeight + h;
        if (h === 0) {
          tiles[r][pipeCol] = TILE_PIPE_TOP_LEFT;
          tiles[r][pipeCol + 1] = TILE_PIPE_TOP_RIGHT;
        } else {
          tiles[r][pipeCol] = TILE_PIPE_BODY_LEFT;
          tiles[r][pipeCol + 1] = TILE_PIPE_BODY_RIGHT;
        }
      }

      // Add Piranha Plant in pipe
      enemies.push({
        id: `piranha_${chunkIndex}`,
        type: 'piranha',
        x: startX + pipeCol * TILE_SIZE,
        y: (13 - pipeHeight) * TILE_SIZE,
        vx: 0,
        vy: 0,
        width: 16,
        height: 24,
        direction: 1,
        state: 'walking',
        deadTimer: 0,
        animTimer: 0,
        pipeX: startX + pipeCol * TILE_SIZE,
        pipeY: (13 - pipeHeight) * TILE_SIZE,
        piranhaOffset: 0,
        piranhaState: 'up',
        piranhaTimer: 0,
      });
    }

    // Spawn Goombas / Red Koopas
    enemies.push({
      id: `goomba_${chunkIndex}`,
      type: rng(5) > 0.5 ? 'goomba' : 'koopa_red',
      x: startX + 10 * TILE_SIZE,
      y: 12 * TILE_SIZE,
      vx: -0.04,
      vy: 0,
      width: 16,
      height: 16,
      direction: -1,
      state: 'walking',
      deadTimer: 0,
      animTimer: 0,
    });
  } else {
    // Overworld Biome (Classic NES Style)
    const hasGap = rng(1) > 0.6 && chunkIndex > 1;
    let gapStart = -1;
    let gapWidth = 0;

    if (hasGap) {
      gapStart = Math.floor(rng(2) * 6) + 5; // col 5..10
      gapWidth = Math.floor(rng(3) * 2) + 2; // 2..3 cols wide
    }

    // Place ground around gap
    for (let c = 0; c < CHUNK_WIDTH; c++) {
      if (!hasGap || c < gapStart || c >= gapStart + gapWidth) {
        tiles[13][c] = TILE_GROUND;
        tiles[14][c] = TILE_GROUND;
      }
    }

    // Feature 1: Pipes
    const hasPipe = rng(4) > 0.3;
    if (hasPipe && (!hasGap || gapStart > 5)) {
      const pipeCol = Math.floor(rng(5) * 3) + 2; // col 2..4
      const pipeHeight = Math.floor(rng(6) * 3) + 2; // 2..4 tall
      for (let h = 0; h < pipeHeight; h++) {
        const r = 13 - pipeHeight + h;
        if (h === 0) {
          tiles[r][pipeCol] = TILE_PIPE_TOP_LEFT;
          tiles[r][pipeCol + 1] = TILE_PIPE_TOP_RIGHT;
        } else {
          tiles[r][pipeCol] = TILE_PIPE_BODY_LEFT;
          tiles[r][pipeCol + 1] = TILE_PIPE_BODY_RIGHT;
        }
      }

      // 50% chance of Piranha plant
      if (rng(7) > 0.5) {
        enemies.push({
          id: `piranha_${chunkIndex}`,
          type: 'piranha',
          x: startX + pipeCol * TILE_SIZE,
          y: (13 - pipeHeight) * TILE_SIZE,
          vx: 0,
          vy: 0,
          width: 16,
          height: 24,
          direction: 1,
          state: 'walking',
          deadTimer: 0,
          animTimer: 0,
          pipeX: startX + pipeCol * TILE_SIZE,
          pipeY: (13 - pipeHeight) * TILE_SIZE,
          piranhaOffset: 0,
          piranhaState: 'up',
          piranhaTimer: 0,
        });
      }
    }

    // Feature 2: Floating Blocks & Brick Arrays
    const blockRow = 9;
    const blockStart = 7;
    for (let c = blockStart; c < blockStart + 5 && c < CHUNK_WIDTH; c++) {
      if (hasGap && c >= gapStart && c < gapStart + gapWidth) {
        // Platform over gap
        tiles[blockRow][c] = TILE_HARD_BLOCK;
      } else {
        const rVal = rng(c * 3);
        if (rVal < 0.3) tiles[blockRow][c] = TILE_BRICK;
        else if (rVal < 0.6) tiles[blockRow][c] = TILE_QUESTION_COIN;
        else if (rVal < 0.8 && c === blockStart + 2) tiles[blockRow][c] = TILE_QUESTION_POWERUP;
        else if (rVal < 0.9 && c === blockStart + 3 && rng(99) > 0.7) tiles[blockRow][c] = TILE_QUESTION_STAR;
        else tiles[blockRow][c] = TILE_BRICK;
      }
    }

    // High platform block structure
    if (rng(8) > 0.5) {
      for (let c = 10; c < 14; c++) {
        tiles[blockRow - 4][c] = c === 11 ? TILE_QUESTION_COIN : TILE_BRICK;
      }
    }

    // Feature 3: Enemies
    // Spawn Goombas / Koopas
    const spawnEnemyCount = Math.floor(rng(9) * 2) + 1; // 1 to 2
    for (let i = 0; i < spawnEnemyCount; i++) {
      const eCol = Math.floor(rng(10 + i) * 6) + 8;
      if (!hasGap || eCol < gapStart || eCol >= gapStart + gapWidth) {
        const eTypeRand = rng(15 + i);
        let eType: any = 'goomba';
        if (eTypeRand > 0.7) eType = 'koopa_green';
        else if (eTypeRand > 0.5) eType = 'koopa_red';

        enemies.push({
          id: `mob_${chunkIndex}_${i}`,
          type: eType,
          x: startX + eCol * TILE_SIZE,
          y: 12 * TILE_SIZE,
          vx: -0.04,
          vy: 0,
          width: 16,
          height: 16,
          direction: -1,
          state: 'walking',
          deadTimer: 0,
          animTimer: 0,
        });
      }
    }

    // Lakitu spawn chance every 6th overworld chunk
    if (chunkIndex > 3 && chunkIndex % 6 === 0) {
      enemies.push({
        id: `lakitu_${chunkIndex}`,
        type: 'lakitu',
        x: startX + 12 * TILE_SIZE,
        y: 3 * TILE_SIZE,
        vx: -0.05,
        vy: 0,
        width: 16,
        height: 24,
        direction: -1,
        state: 'walking',
        deadTimer: 0,
        animTimer: 0,
        shootTimer: 0,
      });
    }
  }

  return {
    chunk: { index: chunkIndex, biome, tiles, startX },
    enemies,
  };
}

// Memory Cleanup Helper for Chunks & Off-screen Entities
export function pruneFarObjects(
  chunks: Map<number, Chunk>,
  enemies: Enemy[],
  powerUps: PowerUp[],
  cameraX: number
): { enemies: Enemy[]; powerUps: PowerUp[] } {
  const minX = cameraX - CHUNK_WIDTH * TILE_SIZE * 3; // Keep 3 chunks behind

  // Prune chunks
  chunks.forEach((chunk, index) => {
    if (chunk.startX + CHUNK_WIDTH * TILE_SIZE < minX) {
      chunks.delete(index);
    }
  });

  // Prune enemies
  const filteredEnemies = enemies.filter(
    (e) => e.x + e.width >= minX && e.y < 350 // also remove enemies fallen into abyss
  );

  // Prune powerups
  const filteredPowerUps = powerUps.filter(
    (p) => p.x + p.width >= minX && p.y < 350
  );

  return {
    enemies: filteredEnemies,
    powerUps: filteredPowerUps,
  };
}
