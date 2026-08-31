import {
  Chunk,
  Enemy,
  Fireball,
  BowserFlame,
  KeysState,
  Particle,
  Player,
  PowerUp,
  FloatingText,
  TILE_SIZE,
  CHUNK_WIDTH,
  TILE_EMPTY,
  TILE_BRICK,
  TILE_QUESTION_COIN,
  TILE_QUESTION_POWERUP,
  TILE_QUESTION_STAR,
  TILE_USED_BLOCK,
  TILE_CASTLE_AXE,
  TILE_LAVA_TOP,
  Biome,
} from './MarioTypes';
import { soundEngine, BGMType } from './MarioAudio';
import { getBiomeForChunk } from './MarioGenerator';

export const GRAVITY = 0.0009; // px/ms^2
export const MAX_FALL_SPEED = 0.4;
export const FIXED_STEP_MS = 1000 / 60; // ~16.66ms per step

export function getTileAt(
  x: number,
  y: number,
  chunks: Map<number, Chunk>
): { tile: number; chunkIndex: number; row: number; col: number } | null {
  const colTotal = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);

  if (row < 0 || row >= 15) return null;

  const chunkIndex = Math.floor(colTotal / CHUNK_WIDTH);
  const colInChunk = ((colTotal % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;

  const chunk = chunks.get(chunkIndex);
  if (!chunk) return null;

  const tile = chunk.tiles[row][colInChunk];
  return { tile, chunkIndex, row, col: colInChunk };
}

export function setTileAt(
  x: number,
  y: number,
  newTile: number,
  chunks: Map<number, Chunk>
) {
  const colTotal = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);

  if (row < 0 || row >= 15) return;

  const chunkIndex = Math.floor(colTotal / CHUNK_WIDTH);
  const colInChunk = ((colTotal % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;

  const chunk = chunks.get(chunkIndex);
  if (chunk) {
    chunk.tiles[row][colInChunk] = newTile;
  }
}

export function checkSolidCollision(
  x: number,
  y: number,
  w: number,
  h: number,
  chunks: Map<number, Chunk>
): boolean {
  const leftTile = Math.floor(x / TILE_SIZE);
  const rightTile = Math.floor((x + w - 0.1) / TILE_SIZE);
  const topTile = Math.floor(y / TILE_SIZE);
  const bottomTile = Math.floor((y + h - 0.1) / TILE_SIZE);

  for (let r = topTile; r <= bottomTile; r++) {
    for (let c = leftTile; c <= rightTile; c++) {
      const worldX = c * TILE_SIZE + 1;
      const worldY = r * TILE_SIZE + 1;
      const res = getTileAt(worldX, worldY, chunks);
      if (res && res.tile !== TILE_EMPTY && res.tile !== TILE_LAVA_TOP && res.tile !== TILE_CASTLE_AXE) {
        return true;
      }
    }
  }
  return false;
}

export interface EngineUpdateResult {
  cameraX: number;
  stageCleared: boolean;
  playerJustDied: boolean;
  currentBiome: Biome;
}

export function updateEngine(
  dt: number,
  player: Player,
  keys: KeysState,
  chunks: Map<number, Chunk>,
  enemies: Enemy[],
  powerUps: PowerUp[],
  fireballs: Fireball[],
  bowserFlames: BowserFlame[],
  particles: Particle[],
  floatingTexts: FloatingText[],
  cameraX: number
): EngineUpdateResult {
  // Cap frame delta time to prevent tunneling or huge physics jumps
  if (dt > 100) dt = 100;

  let stageCleared = false;
  let playerJustDied = false;

  const currentChunkIndex = Math.floor((cameraX + 128) / (CHUNK_WIDTH * TILE_SIZE));
  const currentBiome = getBiomeForChunk(Math.max(0, currentChunkIndex));

  // Dynamic BGM Updates
  if (!player.dead) {
    let expectedBGM: BGMType = currentBiome;
    if (player.starTimer > 0) {
      expectedBGM = 'starman';
    }
    soundEngine.playBGM(expectedBGM);
  }

  // --- PLAYER UPDATE ---
  if (!player.dead) {
    // Timers
    if (player.starTimer > 0) player.starTimer -= dt;
    if (player.iframeTimer > 0) player.iframeTimer -= dt;

    // Movement speeds
    const baseAccel = 0.0007;
    const maxSpd = keys.run ? 0.22 : 0.14;
    const friction = 0.88;

    // Crouch check
    player.crouching = keys.down && player.grounded && player.state !== 'small';
    if (player.crouching) {
      player.height = 16;
    } else {
      player.height = player.state === 'small' ? 16 : 28;
    }

    // Horizontal acceleration
    if (keys.left && !player.crouching) {
      player.vx -= baseAccel * dt;
      player.direction = -1;
    } else if (keys.right && !player.crouching) {
      player.vx += baseAccel * dt;
      player.direction = 1;
    } else {
      player.vx *= friction;
    }

    // Speed limits
    if (player.vx > maxSpd) player.vx = maxSpd;
    if (player.vx < -maxSpd) player.vx = -maxSpd;
    if (Math.abs(player.vx) < 0.005) player.vx = 0;

    // Horizontal Movement & Collision
    player.x += player.vx * dt;
    if (checkSolidCollision(player.x, player.y, player.width, player.height, chunks)) {
      if (player.vx > 0) {
        player.x = Math.floor((player.x + player.width) / TILE_SIZE) * TILE_SIZE - player.width - 0.05;
      } else if (player.vx < 0) {
        player.x = Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE + 0.05;
      }
      player.vx = 0;
    }

    // Vertical Gravity & Jump
    player.vy += GRAVITY * dt;
    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

    if (keys.jump && player.grounded && !player.crouching) {
      player.vy = -0.36;
      player.grounded = false;
      soundEngine.playJump(player.state !== 'small');
    }

    // Variable jump height
    if (!keys.jump && player.vy < 0) {
      player.vy += GRAVITY * dt * 1.5;
    }

    // Apply Vertical Movement & Collision
    player.y += player.vy * dt;
    player.grounded = false;

    // Check collision top & bottom
    if (checkSolidCollision(player.x, player.y, player.width, player.height, chunks)) {
      if (player.vy > 0) {
        // Falling
        player.y = Math.floor((player.y + player.height) / TILE_SIZE) * TILE_SIZE - player.height - 0.05;
        player.grounded = true;
        player.vy = 0;
      } else if (player.vy < 0) {
        // Head hit block from below
        const headY = player.y;
        const headLeftX = player.x + 2;
        const headRightX = player.x + player.width - 2;

        const tileLeft = getTileAt(headLeftX, headY, chunks);
        const tileRight = getTileAt(headRightX, headY, chunks);

        let hitResult = tileLeft && tileLeft.tile !== TILE_EMPTY ? tileLeft : tileRight;
        if (hitResult && hitResult.tile !== TILE_EMPTY) {
          handleBlockHit(hitResult, player, chunks, powerUps, particles, floatingTexts);
        }

        player.y = Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE + 0.05;
        player.vy = 0;
      }
    }

    // Check Axe Collision (Castle Boss victory)
    const centerTile = getTileAt(player.x + player.width / 2, player.y + player.height / 2, chunks);
    if (centerTile && centerTile.tile === TILE_CASTLE_AXE) {
      // Trigger bridge collapse & kill Bowser
      setTileAt(centerTile.col * TILE_SIZE + centerTile.chunkIndex * CHUNK_WIDTH * TILE_SIZE, centerTile.row * TILE_SIZE, TILE_EMPTY, chunks);
      const bridgeChunk = chunks.get(centerTile.chunkIndex);
      if (bridgeChunk) {
        for (let c = 3; c < 12; c++) {
          bridgeChunk.tiles[12][c] = TILE_EMPTY;
        }
      }
      // Kill Bowser
      enemies.forEach((e) => {
        if (e.type === 'bowser') {
          e.state = 'dead';
          e.vy = 0.2;
        }
      });
      soundEngine.playBossDefeat();
      player.score += 5000;
      floatingTexts.push({
        id: `ft_boss_${Date.now()}`,
        text: '5000',
        x: player.x,
        y: player.y - 10,
        vy: -0.05,
        life: 1000,
      });
      stageCleared = true;
    }

    // Check fall into abyss
    if (player.y > 240) {
      killPlayer(player);
      playerJustDied = true;
    }

    // Fireball shooting
    if (keys.fire && player.state === 'fire' && fireballs.length < 2) {
      fireballs.push({
        id: `fb_${Date.now()}_${Math.random()}`,
        x: player.direction === 1 ? player.x + player.width : player.x - 8,
        y: player.y + player.height / 2 - 4,
        vx: player.direction * 0.25,
        vy: 0.1,
        width: 8,
        height: 8,
      });
      keys.fire = false;
      soundEngine.playFireball();
    }

    // Update Distance score
    if (player.x > player.distance) {
      const diff = Math.floor(player.x - player.distance);
      player.distance = player.x;
      player.score += diff;
    }
  } else {
    // Player Dead Anim
    player.deathTimer -= dt;
    player.y += player.vy * dt;
    player.vy += GRAVITY * dt;
  }

  // Camera Follow
  const targetCamX = player.x - 100;
  if (targetCamX > cameraX) {
    cameraX = targetCamX;
  }
  if (player.x < cameraX) {
    player.x = cameraX;
    player.vx = 0;
  }

  // --- POWER-UPS UPDATE ---
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    if (p.emerging) {
      p.y -= 0.02 * dt;
      if (p.y <= p.spawnY - TILE_SIZE) {
        p.emerging = false;
        p.vx = 0.06;
      }
      continue;
    }

    // Apply Gravity & Movement for Mushroom & Star
    if (p.type === 'mushroom' || p.type === 'star') {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;

      if (checkSolidCollision(p.x, p.y, p.width, p.height, chunks)) {
        p.x -= p.vx * dt;
        p.vx *= -1;
      }

      p.y += p.vy * dt;
      if (checkSolidCollision(p.x, p.y, p.width, p.height, chunks)) {
        if (p.vy > 0) {
          p.y = Math.floor((p.y + p.height) / TILE_SIZE) * TILE_SIZE - p.height - 0.05;
          if (p.type === 'star') {
            p.vy = -0.2; // Star bounces
          } else {
            p.vy = 0;
          }
        }
      }
    }

    // Player collect Power-Up
    if (
      !player.dead &&
      player.x < p.x + p.width &&
      player.x + player.width > p.x &&
      player.y < p.y + p.height &&
      player.y + player.height > p.y
    ) {
      soundEngine.playPowerupCollect();
      player.score += 1000;
      floatingTexts.push({
        id: `ft_p_${Date.now()}`,
        text: '1000',
        x: p.x,
        y: p.y - 10,
        vy: -0.05,
        life: 800,
      });

      if (p.type === 'mushroom') {
        if (player.state === 'small') player.state = 'super';
      } else if (p.type === 'flower') {
        player.state = 'fire';
      } else if (p.type === 'star') {
        player.starTimer = 10000; // 10s star power
      }

      powerUps.splice(i, 1);
    }
  }

  // --- FIREBALLS UPDATE ---
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fb = fireballs[i];
    fb.x += fb.vx * dt;
    fb.y += fb.vy * dt;
    fb.vy += GRAVITY * dt * 0.8;

    // Bounce on ground
    if (checkSolidCollision(fb.x, fb.y, fb.width, fb.height, chunks)) {
      if (fb.vy > 0) {
        fb.y = Math.floor((fb.y + fb.height) / TILE_SIZE) * TILE_SIZE - fb.height - 0.05;
        fb.vy = -0.18;
      } else {
        createExplosionParticles(fb.x, fb.y, particles);
        fireballs.splice(i, 1);
        continue;
      }
    }

    // Hit Enemy check
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.state === 'dead' || e.state === 'squished') continue;

      if (
        fb.x < e.x + e.width &&
        fb.x + fb.width > e.x &&
        fb.y < e.y + e.height &&
        fb.y + fb.height > e.y
      ) {
        createExplosionParticles(fb.x, fb.y, particles);
        fireballs.splice(i, 1);

        if (e.type === 'spiny' || e.type === 'buzzy_beetle') {
          soundEngine.playBlockHit();
        } else if (e.type === 'bowser') {
          if (e.hp) {
            e.hp -= 1;
            if (e.hp <= 0) {
              e.state = 'dead';
              e.vy = 0.2;
              soundEngine.playBossDefeat();
              player.score += 5000;
            } else {
              soundEngine.playBlockHit();
            }
          }
        } else {
          e.state = 'dead';
          e.vy = -0.2;
          soundEngine.playSquish();
          player.score += 200;
          floatingTexts.push({
            id: `ft_e_${Date.now()}`,
            text: '200',
            x: e.x,
            y: e.y - 10,
            vy: -0.05,
            life: 800,
          });
        }
        break;
      }
    }
  }

  // --- BOWSER FLAMES UPDATE ---
  for (let i = bowserFlames.length - 1; i >= 0; i--) {
    const bf = bowserFlames[i];
    bf.x += bf.vx * dt;
    bf.y += bf.vy * dt;

    if (!player.dead && player.iframeTimer <= 0 && player.starTimer <= 0) {
      if (
        player.x < bf.x + bf.width &&
        player.x + player.width > bf.x &&
        player.y < bf.y + bf.height &&
        player.y + player.height > bf.y
      ) {
        if (hurtPlayer(player)) {
          playerJustDied = true;
        }
      }
    }

    if (bf.x < cameraX - 100 || bf.x > cameraX + 400) {
      bowserFlames.splice(i, 1);
    }
  }

  // --- ENEMIES UPDATE ---
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];

    if (e.state === 'dead') {
      e.y += e.vy * dt;
      e.vy += GRAVITY * dt;
      continue;
    }

    if (e.state === 'squished') {
      e.deadTimer -= dt;
      if (e.deadTimer <= 0) {
        enemies.splice(i, 1);
        i--;
      }
      continue;
    }

    if (e.x > cameraX + 320 || e.x < cameraX - 160) continue;

    if (e.type === 'piranha') {
      e.piranhaTimer = (e.piranhaTimer || 0) + dt;
      const playerNearPipe = Math.abs(player.x - (e.pipeX || 0)) < 32;

      if (e.piranhaState === 'up') {
        if ((e.piranhaOffset || 0) < 24) {
          e.piranhaOffset = (e.piranhaOffset || 0) + 0.03 * dt;
        } else {
          if ((e.piranhaTimer || 0) > 2000) {
            e.piranhaState = 'down';
            e.piranhaTimer = 0;
          }
        }
      } else if (e.piranhaState === 'down') {
        if ((e.piranhaOffset || 0) > 0) {
          e.piranhaOffset = (e.piranhaOffset || 0) - 0.03 * dt;
        } else {
          e.piranhaState = 'waiting';
          e.piranhaTimer = 0;
        }
      } else if (e.piranhaState === 'waiting') {
        if (!playerNearPipe && (e.piranhaTimer || 0) > 1500) {
          e.piranhaState = 'up';
          e.piranhaTimer = 0;
        }
      }

      e.y = (e.pipeY || e.y) - (e.piranhaOffset || 0);
    } else if (e.type === 'lakitu') {
      e.x += e.vx * dt;
      if (e.x < player.x - 80) e.vx = 0.04;
      if (e.x > player.x + 80) e.vx = -0.04;

      e.shootTimer = (e.shootTimer || 0) + dt;
      if (e.shootTimer > 3000) {
        e.shootTimer = 0;
        enemies.push({
          id: `spiny_dropped_${Date.now()}`,
          type: 'spiny',
          x: e.x,
          y: e.y + 16,
          vx: player.x > e.x ? 0.04 : -0.04,
          vy: -0.1,
          width: 16,
          height: 16,
          direction: player.x > e.x ? 1 : -1,
          state: 'walking',
          deadTimer: 0,
          animTimer: 0,
        });
      }
    } else if (e.type === 'bowser') {
      e.shootTimer = (e.shootTimer || 0) + dt;
      e.jumpTimer = (e.jumpTimer || 0) + dt;

      if (e.shootTimer > 2500) {
        e.shootTimer = 0;
        bowserFlames.push({
          id: `flame_${Date.now()}`,
          x: e.x - 16,
          y: e.y + 8,
          vx: -0.12,
          vy: 0,
          width: 24,
          height: 12,
        });
      }

      if (e.jumpTimer > 4000 && e.vy === 0) {
        e.jumpTimer = 0;
        e.vy = -0.25;
      }

      e.vy += GRAVITY * dt;
      e.y += e.vy * dt;
      if (checkSolidCollision(e.x, e.y, e.width, e.height, chunks)) {
        if (e.vy > 0) {
          e.y = Math.floor((e.y + e.height) / TILE_SIZE) * TILE_SIZE - e.height - 0.05;
          e.vy = 0;
        }
      }

      e.direction = player.x > e.x ? 1 : -1;
      e.vx = e.direction * 0.02;
      e.x += e.vx * dt;
    } else {
      e.vy += GRAVITY * dt;
      e.y += e.vy * dt;

      if (checkSolidCollision(e.x, e.y, e.width, e.height, chunks)) {
        if (e.vy > 0) {
          e.y = Math.floor((e.y + e.height) / TILE_SIZE) * TILE_SIZE - e.height - 0.05;
          e.vy = 0;
        }
      }

      const currentSpd = e.state === 'shell_moving' ? 0.22 : Math.abs(e.vx || 0.04);
      e.vx = e.direction * currentSpd;
      e.x += e.vx * dt;

      if (checkSolidCollision(e.x, e.y, e.width, e.height, chunks)) {
        if (e.vx > 0) {
          e.x = Math.floor((e.x + e.width) / TILE_SIZE) * TILE_SIZE - e.width - 0.05;
          e.direction = -1;
        } else if (e.vx < 0) {
          e.x = Math.floor(e.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE + 0.05;
          e.direction = 1;
        }
      }

      if (e.state === 'shell_moving') {
        for (let j = 0; j < enemies.length; j++) {
          const other = enemies[j];
          if (other.id === e.id || other.state === 'dead' || other.state === 'squished') continue;
          if (
            e.x < other.x + other.width &&
            e.x + e.width > other.x &&
            e.y < other.y + other.height &&
            e.y + e.height > other.y
          ) {
            other.state = 'dead';
            other.vy = -0.2;
            soundEngine.playSquish();
            player.score += 200;
          }
        }
      }
    }

    // --- PLAYER & ENEMY COLLISION ---
    if (
      !player.dead &&
      player.x < e.x + e.width &&
      player.x + player.width > e.x &&
      player.y < e.y + e.height &&
      player.y + player.height > e.y
    ) {
      if (player.starTimer > 0) {
        e.state = 'dead';
        e.vy = -0.2;
        soundEngine.playSquish();
        player.score += 400;
        floatingTexts.push({
          id: `ft_star_${Date.now()}`,
          text: '400',
          x: e.x,
          y: e.y - 10,
          vy: -0.05,
          life: 800,
        });
      } else if (player.vy > 0 && player.y + player.height - player.vy * dt <= e.y + 8) {
        if (e.type === 'spiny') {
          if (hurtPlayer(player)) playerJustDied = true;
        } else if (e.type === 'goomba') {
          e.state = 'squished';
          e.deadTimer = 400;
          player.vy = -0.25;
          soundEngine.playSquish();
          player.score += 100;
        } else if (e.type === 'koopa_green' || e.type === 'koopa_red' || e.type === 'buzzy_beetle') {
          if (e.state === 'walking') {
            e.state = 'shell_idle';
            player.vy = -0.25;
            soundEngine.playSquish();
          } else if (e.state === 'shell_idle') {
            e.state = 'shell_moving';
            e.direction = player.x < e.x ? 1 : -1;
            player.vy = -0.25;
            soundEngine.playKick();
          } else if (e.state === 'shell_moving') {
            e.state = 'shell_idle';
            player.vy = -0.25;
            soundEngine.playSquish();
          }
        }
      } else {
        if (e.state === 'shell_idle') {
          e.state = 'shell_moving';
          e.direction = player.x < e.x ? 1 : -1;
          soundEngine.playKick();
        } else if (player.iframeTimer <= 0) {
          if (hurtPlayer(player)) playerJustDied = true;
        }
      }
    }
  }

  // --- PARTICLES UPDATE ---
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += GRAVITY * dt * 0.5;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // --- FLOATING TEXTS UPDATE ---
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  return {
    cameraX,
    stageCleared,
    playerJustDied,
    currentBiome,
  };
}

function handleBlockHit(
  hit: { tile: number; chunkIndex: number; row: number; col: number },
  player: Player,
  chunks: Map<number, Chunk>,
  powerUps: PowerUp[],
  particles: Particle[],
  floatingTexts: FloatingText[]
) {
  const worldX = hit.col * TILE_SIZE + hit.chunkIndex * CHUNK_WIDTH * TILE_SIZE;
  const worldY = hit.row * TILE_SIZE;

  if (hit.tile === TILE_QUESTION_COIN) {
    soundEngine.playCoin();
    setTileAt(worldX, worldY, TILE_USED_BLOCK, chunks);
    player.coins += 1;
    player.score += 200;
    createCoinParticle(worldX, worldY, particles);
  } else if (hit.tile === TILE_QUESTION_POWERUP) {
    soundEngine.playPowerupSpawn();
    setTileAt(worldX, worldY, TILE_USED_BLOCK, chunks);
    const pType = player.state === 'small' ? 'mushroom' : 'flower';
    powerUps.push({
      id: `pu_${Date.now()}`,
      type: pType,
      x: worldX,
      y: worldY,
      vx: 0,
      vy: 0,
      width: 16,
      height: 16,
      spawnY: worldY,
      emerging: true,
    });
  } else if (hit.tile === TILE_QUESTION_STAR) {
    soundEngine.playPowerupSpawn();
    setTileAt(worldX, worldY, TILE_USED_BLOCK, chunks);
    powerUps.push({
      id: `pu_star_${Date.now()}`,
      type: 'star',
      x: worldX,
      y: worldY,
      vx: 0,
      vy: 0,
      width: 16,
      height: 16,
      spawnY: worldY,
      emerging: true,
    });
  } else if (hit.tile === TILE_BRICK) {
    if (player.state !== 'small') {
      soundEngine.playBlockBreak();
      setTileAt(worldX, worldY, TILE_EMPTY, chunks);
      player.score += 50;
      createBrickParticles(worldX, worldY, particles);
    } else {
      soundEngine.playBlockHit();
    }
  } else {
    soundEngine.playBlockHit();
  }
}

function hurtPlayer(player: Player): boolean {
  if (player.state === 'fire') {
    player.state = 'super';
    player.iframeTimer = 2000;
    soundEngine.playHurt();
    return false;
  } else if (player.state === 'super') {
    player.state = 'small';
    player.iframeTimer = 2000;
    soundEngine.playHurt();
    return false;
  } else {
    killPlayer(player);
    return true;
  }
}

function killPlayer(player: Player) {
  player.dead = true;
  player.deathTimer = 2000;
  player.vy = -0.3;
  player.lives -= 1;
  soundEngine.playJingle('death');
}

function createCoinParticle(x: number, y: number, particles: Particle[]) {
  particles.push({
    id: `coin_${Date.now()}`,
    x: x + 4,
    y: y - 8,
    vx: 0,
    vy: -0.2,
    color: '#f8b800',
    life: 300,
    maxLife: 300,
    size: 8,
  });
}

function createBrickParticles(x: number, y: number, particles: Particle[]) {
  const velocities = [
    { vx: -0.08, vy: -0.2 },
    { vx: 0.08, vy: -0.2 },
    { vx: -0.05, vy: -0.1 },
    { vx: 0.05, vy: -0.1 },
  ];
  velocities.forEach((v, idx) => {
    particles.push({
      id: `brick_${Date.now()}_${idx}`,
      x: x + (idx % 2) * 8,
      y: y + Math.floor(idx / 2) * 8,
      vx: v.vx,
      vy: v.vy,
      color: '#c84c0c',
      life: 500,
      maxLife: 500,
      size: 6,
    });
  });
}

function createExplosionParticles(x: number, y: number, particles: Particle[]) {
  for (let i = 0; i < 4; i++) {
    particles.push({
      id: `exp_${Date.now()}_${i}`,
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      color: '#fc9838',
      life: 200,
      maxLife: 200,
      size: 4,
    });
  }
}
