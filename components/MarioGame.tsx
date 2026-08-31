'use client';

import React, { useEffect, useRef } from 'react';

const MarioGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Constants
    const SCREEN_WIDTH = 256;
    const SCREEN_HEIGHT = 240;
    const SCALE = 2; // Scale for viewing
    const TILE_SIZE = 16;
    const GRAVITY = 0.001; // pixels/ms^2 (adjust later)

    // Simplified Level 1-1 Map (partial, just to have ground and obstacles)
    // 0 = empty, 1 = ground, 2 = brick, 3 = question block, 4 = pipe top-left, 5 = pipe top-right, 6 = pipe bottom-left, 7 = pipe bottom-right
    const map = [
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000003000000000000000000000000000000000000000000000000000000000",
      "00000000000000000000023200000000000000000000000000000000000000000000000000000000",
      "00000000000000000000000000004500000000000000000000000000000000000000000000000000",
      "00000000000000000000000000006700000000000000000000000000000000000000000000000000",
      "00000000000000000000000000006700000000000000000000000000000000000000000000000000",
      "11111111111111111111111111111111111111111111111111111111111111111111111111111111",
      "11111111111111111111111111111111111111111111111111111111111111111111111111111111"
    ];

    // Camera
    const camera = { x: 0, y: 0 };

    // Input state
    const keys = { left: false, right: false, up: false, run: false };

    // Goomba State
    const goombas = [
      { x: 300, y: 192, width: 16, height: 16, vx: -0.05, vy: 0, alive: true, deadTimer: 0 },
      { x: 400, y: 192, width: 16, height: 16, vx: -0.05, vy: 0, alive: true, deadTimer: 0 }
    ];

    // Player State
    const player = {
      x: 32,
      y: 192,
      width: 12, // Hitbox slightly smaller than tile
      height: 16,
      vx: 0,
      vy: 0,
      speed: 0.1,
      maxSpeed: 0.15,
      runMaxSpeed: 0.25,
      friction: 0.9,
      jumpPower: -0.35,
      grounded: false,
      direction: 1 // 1 for right, -1 for left
    };

    // Event Listeners for Controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'a') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'w' || e.key === ' ') keys.up = true;
      if (e.key === 'Shift') keys.run = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'a') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'w' || e.key === ' ') keys.up = false;
      if (e.key === 'Shift') keys.run = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Resize canvas
    canvas.width = SCREEN_WIDTH * SCALE;
    canvas.height = SCREEN_HEIGHT * SCALE;
    ctx.scale(SCALE, SCALE);

    // Game state
    let lastTime = 0;
    let requestRef: number;

    // Main Game Loop
    const gameLoop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      update(deltaTime);
      render(ctx);

      requestRef = requestAnimationFrame(gameLoop);
    };

    // AABB Collision check against map
    const checkCollision = (x: number, y: number, w: number, h: number) => {
      const leftTile = Math.floor(x / TILE_SIZE);
      const rightTile = Math.floor((x + w - 0.1) / TILE_SIZE);
      const topTile = Math.floor(y / TILE_SIZE);
      const bottomTile = Math.floor((y + h - 0.1) / TILE_SIZE);

      for (let ty = topTile; ty <= bottomTile; ty++) {
        for (let tx = leftTile; tx <= rightTile; tx++) {
          if (ty >= 0 && ty < map.length && tx >= 0 && tx < map[0].length) {
             const tile = map[ty][tx];
             if (tile !== '0') {
               return true; // Collision found
             }
          }
        }
      }
      return false;
    };

    const update = (dt: number) => {
      // Limit dt to avoid massive physics jumps on lag
      if (dt > 50) dt = 50;

      // --- Horizontal Movement ---
      const maxSpd = keys.run ? player.runMaxSpeed : player.maxSpeed;
      if (keys.left) {
        player.vx -= player.speed * (dt/16);
        player.direction = -1;
      } else if (keys.right) {
        player.vx += player.speed * (dt/16);
        player.direction = 1;
      } else {
        // Friction
        player.vx *= player.friction;
      }

      // Cap speed
      if (player.vx > maxSpd) player.vx = maxSpd;
      if (player.vx < -maxSpd) player.vx = -maxSpd;
      
      // Stop tiny movements
      if (Math.abs(player.vx) < 0.01) player.vx = 0;

      // Apply horizontal velocity
      player.x += player.vx * dt;

      // X Collision resolving
      if (checkCollision(player.x, player.y, player.width, player.height)) {
        if (player.vx > 0) { // moving right
          player.x = Math.floor((player.x + player.width) / TILE_SIZE) * TILE_SIZE - player.width - 0.1;
        } else if (player.vx < 0) { // moving left
          player.x = Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE + 0.1;
        }
        player.vx = 0;
      }

      // --- Vertical Movement (Gravity & Jump) ---
      player.vy += GRAVITY * dt;

      // Jump (only if grounded)
      if (keys.up && player.grounded) {
         player.vy = player.jumpPower;
         player.grounded = false;
      }
      
      // Variable jump height (release jump key to fall faster)
      if (!keys.up && player.vy < 0) {
          player.vy += GRAVITY * dt * 2; // Extra gravity
      }

      // Apply vertical velocity
      player.y += player.vy * dt;
      player.grounded = false;

      // Y Collision resolving
      if (checkCollision(player.x, player.y, player.width, player.height)) {
        if (player.vy > 0) { // falling down
          player.y = Math.floor((player.y + player.height) / TILE_SIZE) * TILE_SIZE - player.height - 0.1;
          player.grounded = true;
        } else if (player.vy < 0) { // jumping up (hit head)
          player.y = Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE + 0.1;
        }
        player.vy = 0;
      }
      
      // Map boundaries
      if (player.x < 0) {
          player.x = 0;
          player.vx = 0;
      }

      // --- Enemy Logic ---
      goombas.forEach(goomba => {
        if (!goomba.alive) {
          if (goomba.deadTimer > 0) goomba.deadTimer -= dt;
          return;
        }
        
        // Only update if near screen
        if (goomba.x > camera.x + SCREEN_WIDTH + 100 || goomba.x < camera.x - 100) return;

        // Apply gravity
        goomba.vy += GRAVITY * dt;
        goomba.y += goomba.vy * dt;

        // Y Collision
        if (checkCollision(goomba.x, goomba.y, goomba.width, goomba.height)) {
            if (goomba.vy > 0) {
                goomba.y = Math.floor((goomba.y + goomba.height) / TILE_SIZE) * TILE_SIZE - goomba.height - 0.1;
            }
            goomba.vy = 0;
        }

        // Apply horizontal
        goomba.x += goomba.vx * dt;

        // X Collision (turn around)
        if (checkCollision(goomba.x, goomba.y, goomba.width, goomba.height)) {
            if (goomba.vx > 0) {
                goomba.x = Math.floor((goomba.x + goomba.width) / TILE_SIZE) * TILE_SIZE - goomba.width - 0.1;
                goomba.vx *= -1; // Turn left
            } else if (goomba.vx < 0) {
                goomba.x = Math.floor(goomba.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE + 0.1;
                goomba.vx *= -1; // Turn right
            }
        }

        // Enemy / Player Collision
        // Simple AABB overlap check
        if (
            player.x < goomba.x + goomba.width &&
            player.x + player.width > goomba.x &&
            player.y < goomba.y + goomba.height &&
            player.y + player.height > goomba.y
        ) {
            // Check if player is falling on top of goomba
            if (player.vy > 0 && player.y + player.height - (player.vy*dt) <= goomba.y + 4) {
                // Squish goomba
                goomba.alive = false;
                goomba.deadTimer = 500; // ms to show squished sprite
                player.vy = player.jumpPower * 0.7; // Bounce off
            } else {
                // Player hit from side/bottom - reset game (simplified death)
                player.x = 32;
                player.y = 192;
                player.vx = 0;
                player.vy = 0;
                camera.x = 0;
                goombas[0].x = 300; goombas[0].alive = true; goombas[0].vx = -0.05;
                goombas[1].x = 400; goombas[1].alive = true; goombas[1].vx = -0.05;
            }
        }
      });

      // Camera Follow Player
      // Keep player roughly in center, only scroll right (retro style)
      const targetCamX = player.x - SCREEN_WIDTH / 2;
      if (targetCamX > camera.x) {
          camera.x = targetCamX;
      }
      
      // Ensure camera doesn't go before start
      if (camera.x < 0) camera.x = 0;
      
      // Prevent player going back off screen
      if (player.x < camera.x) {
          player.x = camera.x;
          player.vx = 0;
      }
    };

    const drawMario = (ctx: CanvasRenderingContext2D) => {
       ctx.save();
       // Screen position
       const screenX = player.x - camera.x;
       const screenY = player.y - camera.y;

       ctx.translate(screenX + player.width/2, screenY);
       
       // Flip based on direction
       if (player.direction === -1) {
           ctx.scale(-1, 1);
       }

       // Move back to draw
       ctx.translate(-player.width/2, 0);

       // Procedural Mario Sprite (12x16 approximation)
       // Hat / Shirt
       ctx.fillStyle = '#ff0000';
       ctx.fillRect(2, 0, 8, 3); // hat top
       ctx.fillRect(0, 3, 12, 1); // hat brim
       ctx.fillRect(2, 8, 8, 5); // shirt
       
       // Face / Hands
       ctx.fillStyle = '#ffcc99';
       ctx.fillRect(2, 4, 8, 4); // face
       ctx.fillRect(0, 9, 3, 3); // hand L
       ctx.fillRect(9, 9, 3, 3); // hand R
       
       // Overalls
       ctx.fillStyle = '#0000ff';
       ctx.fillRect(4, 10, 4, 6); // pants center
       ctx.fillRect(2, 13, 2, 3); // pants L
       ctx.fillRect(8, 13, 2, 3); // pants R
       
       // Boots
       ctx.fillStyle = '#8b4513'; // brown
       ctx.fillRect(0, 14, 4, 2); // boot L
       ctx.fillRect(8, 14, 4, 2); // boot R
       
       // Eyes/Mustache (simple details)
       ctx.fillStyle = '#000000';
       ctx.fillRect(8, 4, 1, 2); // eye
       ctx.fillRect(7, 7, 4, 1); // mustache

       ctx.restore();
    };

    const drawGoomba = (ctx: CanvasRenderingContext2D, goomba: any) => {
        if (!goomba.alive && goomba.deadTimer <= 0) return; // Completely gone

        const screenX = goomba.x - camera.x;
        const screenY = goomba.y - camera.y;
        
        ctx.save();
        ctx.translate(screenX, screenY);
        
        ctx.fillStyle = '#c84c0c'; // Brown
        
        if (goomba.alive) {
            // Mushroom body
            ctx.fillRect(4, 2, 8, 4);
            ctx.fillRect(2, 6, 12, 6);
            ctx.fillRect(0, 12, 16, 2);
            
            // Feet (animated slightly based on x)
            ctx.fillStyle = '#000000';
            const walk = Math.floor(goomba.x / 10) % 2;
            if (walk === 0) {
                ctx.fillRect(2, 14, 4, 2); // left foot
                ctx.fillRect(10, 14, 4, 2); // right foot
            } else {
                ctx.fillRect(4, 14, 4, 2); // left foot in
                ctx.fillRect(8, 14, 4, 2); // right foot in
            }
            
            // Eyes
            ctx.fillRect(4, 8, 2, 2);
            ctx.fillRect(10, 8, 2, 2);
        } else {
            // Squished Goomba
            ctx.fillRect(0, 12, 16, 4);
        }
        
        ctx.restore();
    };

    const drawTile = (ctx: CanvasRenderingContext2D, type: string, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);

      switch (type) {
        case '1': // Ground
          ctx.fillStyle = '#c84c0c';
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000000'; // Brick pattern lines
          ctx.fillRect(0, 0, TILE_SIZE, 1);
          ctx.fillRect(0, TILE_SIZE / 2, TILE_SIZE, 1);
          ctx.fillRect(TILE_SIZE / 2, 0, 1, TILE_SIZE / 2);
          ctx.fillRect(TILE_SIZE / 4, TILE_SIZE / 2, 1, TILE_SIZE / 2);
          break;
        case '2': // Brick
          ctx.fillStyle = '#c84c0c';
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, TILE_SIZE, 1);
          ctx.fillRect(0, TILE_SIZE / 2, TILE_SIZE, 1);
          ctx.fillRect(TILE_SIZE / 2, 0, 1, TILE_SIZE / 2);
          ctx.fillRect(TILE_SIZE / 4, TILE_SIZE / 2, 1, TILE_SIZE / 2);
          break;
        case '3': // Question Block
          ctx.fillStyle = '#f8b800';
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, TILE_SIZE, 1);
          ctx.fillRect(0, TILE_SIZE - 1, TILE_SIZE, 1);
          ctx.fillRect(0, 0, 1, TILE_SIZE);
          ctx.fillRect(TILE_SIZE - 1, 0, 1, TILE_SIZE);
          ctx.fillStyle = '#c84c0c'; // The ? mark (simplified)
          ctx.fillRect(TILE_SIZE/2 - 2, TILE_SIZE/2 - 4, 4, 2);
          ctx.fillRect(TILE_SIZE/2 + 2, TILE_SIZE/2 - 2, 2, 4);
          ctx.fillRect(TILE_SIZE/2 - 2, TILE_SIZE/2 + 2, 4, 2);
          ctx.fillRect(TILE_SIZE/2 - 1, TILE_SIZE/2 + 5, 2, 2);
          break;
        case '4': // Pipe TL
          ctx.fillStyle = '#00a800';
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, TILE_SIZE, 1);
          ctx.fillRect(0, 0, 1, TILE_SIZE);
          break;
        case '5': // Pipe TR
          ctx.fillStyle = '#00a800';
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, TILE_SIZE, 1);
          ctx.fillRect(TILE_SIZE - 1, 0, 1, TILE_SIZE);
          break;
        case '6': // Pipe BL
          ctx.fillStyle = '#00a800';
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, 1, TILE_SIZE);
          break;
        case '7': // Pipe BR
          ctx.fillStyle = '#00a800';
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000';
          ctx.fillRect(TILE_SIZE - 1, 0, 1, TILE_SIZE);
          break;
      }
      ctx.restore();
    };

    const drawClouds = (ctx: CanvasRenderingContext2D) => {
       ctx.fillStyle = '#ffffff';
       // Cloud 1
       ctx.fillRect(30 - camera.x * 0.5, 40, 40, 20);
       ctx.fillRect(40 - camera.x * 0.5, 30, 20, 10);
       // Cloud 2
       ctx.fillRect(150 - camera.x * 0.5, 50, 50, 25);
       ctx.fillRect(160 - camera.x * 0.5, 40, 30, 10);
    }

    const render = (ctx: CanvasRenderingContext2D) => {
      // Clear screen (Mario sky blue)
      ctx.fillStyle = '#5c94fc';
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      // Draw background elements (parallax clouds)
      drawClouds(ctx);

      // Draw map
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          const tile = map[y][x];
          if (tile !== '0') {
            const screenX = x * TILE_SIZE - camera.x;
            const screenY = y * TILE_SIZE - camera.y;

            // Simple culling
            if (screenX > -TILE_SIZE && screenX < SCREEN_WIDTH) {
              drawTile(ctx, tile, screenX, screenY);
            }
          }
        }
      }

      // Draw Enemies
      goombas.forEach(g => drawGoomba(ctx, g));

      // Draw Player
      drawMario(ctx);
    };

    requestRef = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(requestRef);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '512px', height: '480px' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated', // Keep it sharp
        }}
      />
    </div>
  );
};

export default MarioGame;
