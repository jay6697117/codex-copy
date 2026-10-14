import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Zap,
  Gauge,
  Sparkles,
  Bot,
  Gamepad2,
} from 'lucide-react';

const TRACKS = [
  { id: 'neon-spire', name: 'Neon Spire Circuit', sky: '#090D1A', road: '#1E2638', curb: '#10B981' },
  { id: 'voxel-canyon', name: 'Voxel Sunset Canyon', sky: '#1F1224', road: '#2D232E', curb: '#F59E0B' },
  { id: 'cyber-glacier', name: 'Cyber Glacier Drift', sky: '#081C24', road: '#16303D', curb: '#22D3EE' },
  { id: 'molten-core', name: 'Molten Server Core', sky: '#220909', road: '#2C1618', curb: '#F43F5E' },
  { id: 'skyline-loop', name: 'Astra Skyline Loop', sky: '#0F172A', road: '#1E293B', curb: '#8B5CF6' },
  { id: 'emerald-bay', name: 'Emerald Docks Sprint', sky: '#062019', road: '#132A24', curb: '#34D399' },
  { id: 'quantum-grid', name: 'Quantum Matrix Grid', sky: '#090A10', road: '#161824', curb: '#EC4899' },
  { id: 'rainbow-orbit', name: 'Sol Rainbow Orbit', sky: '#110C22', road: '#1F1938', curb: '#38BDF8' },
];

const RACERS = [
  { id: 'sol-bot', name: 'Sol-6.1', color: '#10B981', topSpeed: 295 },
  { id: 'luna-dash', name: 'Luna-6', color: '#22D3EE', topSpeed: 288 },
  { id: 'codex-prime', name: 'Codex Prime', color: '#8B5CF6', topSpeed: 292 },
  { id: 'voxel-fox', name: 'Voxel Fox', color: '#F59E0B', topSpeed: 285 },
  { id: 'rust-crab', name: 'Cargo Ferris', color: '#F43F5E', topSpeed: 284 },
  { id: 'worktree-wiz', name: 'Git Tree', color: '#3B82F6', topSpeed: 282 },
  { id: 'kernel-pan', name: 'Sandbox-0', color: '#EC4899', topSpeed: 280 },
  { id: 'pixel-knight', name: 'TUI Knight', color: '#A3E635', topSpeed: 278 },
];

const ITEMS = ['⚡ Turbo Pulse', '🛡️ Sandbox Shield', '🚀 Warp Feather', '🧲 Magnet Pull'];

export const VoxelVelocityGame: React.FC = () => {
  const [selectedTrack, setSelectedTrack] = useState(TRACKS[0]);
  const [selectedRacer, setSelectedRacer] = useState(RACERS[0]);
  const [difficulty, setDifficulty] = useState<'Chill' | 'Standard' | 'Mean'>('Standard');
  const [isRunning, setIsRunning] = useState(true);
  const [qaAutopilot, setQaAutopilot] = useState(true);
  const [hudState, setHudState] = useState({
    lap: 1,
    position: 1,
    speed: 240,
    driftTier: 0 as 0 | 1 | 2 | 3,
    boostRemaining: 0,
    heldItem: ITEMS[0],
    lapTime: '00:14.82',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const stateRef = useRef({
    distance: 0,
    playerX: 0,
    speed: 210,
    driftCharge: 0,
    driftTier: 0 as 0 | 1 | 2 | 3,
    boostTimer: 0,
    lap: 1,
    startTime: performance.now(),
    heldItem: ITEMS[0],
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Space') {
        stateRef.current.boostTimer = 1.2;
        stateRef.current.heldItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        (e.code === 'ShiftLeft' || e.code === 'ShiftRight') &&
        stateRef.current.driftTier > 0
      ) {
        const durations = { 0: 0, 1: 0.7, 2: 1.1, 3: 1.5 };
        stateRef.current.boostTimer = durations[stateRef.current.driftTier];
        stateRef.current.driftCharge = 0;
        stateRef.current.driftTier = 0;
      }
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    let animId: number;
    let lastTick = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      const canvas = canvasRef.current;
      if (canvas && isRunning) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const s = stateRef.current;
          const w = canvas.width;
          const h = canvas.height;

          // Update physics
          const baseMax = selectedRacer.topSpeed + (s.boostTimer > 0 ? 75 : 0);
          s.speed += (baseMax - s.speed) * dt * 3;
          s.distance += s.speed * dt;

          const curve = Math.sin(s.distance * 0.008) * 0.65;
          if (qaAutopilot) {
            s.playerX += (curve * 0.45 - s.playerX) * dt * 4;
            s.driftCharge += dt * 0.95;
            if (s.driftCharge > 2.2) {
              s.boostTimer = 1.5;
              s.driftCharge = 0;
              s.driftTier = 0;
            } else if (s.driftCharge > 1.4) {
              s.driftTier = 3;
            } else if (s.driftCharge > 0.8) {
              s.driftTier = 2;
            } else if (s.driftCharge > 0.35) {
              s.driftTier = 1;
            }
          } else {
            if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) s.playerX -= dt * 1.4;
            if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) s.playerX += dt * 1.4;
            if (keysRef.current['ShiftLeft'] || keysRef.current['ShiftRight']) {
              s.driftCharge += dt;
              s.driftTier =
                s.driftCharge > 2.1 ? 3 : s.driftCharge > 1.3 ? 2 : s.driftCharge > 0.6 ? 1 : 0;
            }
          }

          if (s.boostTimer > 0) s.boostTimer = Math.max(0, s.boostTimer - dt);
          s.lap = Math.min(3, 1 + Math.floor(s.distance / 1800));

          // Draw Sky
          ctx.fillStyle = selectedTrack.sky;
          ctx.fillRect(0, 0, w, h * 0.48);

          // Draw Retro Voxel Mountains / Horizon Grid
          ctx.fillStyle = '#1E293B';
          for (let i = 0; i < 14; i++) {
            const mx = ((i * 55 - s.distance * 0.15) % (w + 60) + (w + 60)) % (w + 60) - 30;
            const mh = 18 + ((i * 19) % 28);
            ctx.fillRect(mx, h * 0.48 - mh, 42, mh);
          }

          // Draw Pseudo-3D Road Strips
          const horizonY = h * 0.48;
          const strips = 42;
          for (let i = 0; i < strips; i++) {
            const p = i / strips;
            const y = horizonY + p * (h - horizonY);
            const stripH = (h - horizonY) / strips + 1;
            const perspectiveW = (0.14 + p * 0.82) * w;
            const curveOffset = Math.sin(s.distance * 0.012 + (1 - p) * 2.5) * (1 - p) * 75;
            const centerX = w / 2 + curveOffset - s.playerX * p * 90;

            const segIndex = Math.floor((s.distance * 0.15 + (1 - p) * 35) % 2);
            // Grass / Off-road
            ctx.fillStyle = segIndex === 0 ? '#0B1320' : '#0E1726';
            ctx.fillRect(0, y, w, stripH);

            // Curbs
            ctx.fillStyle = segIndex === 0 ? selectedTrack.curb : '#E2E8F0';
            ctx.fillRect(centerX - perspectiveW * 0.54, y, perspectiveW * 1.08, stripH);

            // Road surface
            ctx.fillStyle = segIndex === 0 ? selectedTrack.road : '#171E2E';
            ctx.fillRect(centerX - perspectiveW * 0.5, y, perspectiveW, stripH);
          }

          // Draw AI Opponent Voxel Karts
          for (let r = 1; r <= 3; r++) {
            const relZ = ((s.distance * 0.02 + r * 0.28) % 0.85) + 0.12;
            const ky = horizonY + relZ * (h - horizonY) - 14;
            const kx =
              w / 2 +
              Math.sin(s.distance * 0.015 + r * 2) * 45 * relZ -
              s.playerX * relZ * 60;
            const kw = 16 + relZ * 26;
            const kh = 10 + relZ * 18;
            ctx.fillStyle = RACERS[r].color;
            ctx.fillRect(kx - kw / 2, ky - kh, kw, kh);
            ctx.fillStyle = '#090A0F';
            ctx.fillRect(kx - kw / 2 - 3, ky - 6, 4, 6);
            ctx.fillRect(kx + kw / 2 - 1, ky - 6, 4, 6);
          }

          // Draw Player Voxel Kart
          const px = w / 2;
          const py = h - 32;
          // Drift sparks / boost flame
          if (s.boostTimer > 0 || s.driftTier > 0) {
            const sparkColor =
              s.boostTimer > 0
                ? '#34D399'
                : s.driftTier === 3
                ? '#EC4899'
                : s.driftTier === 2
                ? '#F59E0B'
                : '#22D3EE';
            ctx.fillStyle = sparkColor;
            ctx.fillRect(px - 26, py - 4, 14, 8);
            ctx.fillRect(px + 12, py - 4, 14, 8);
          }

          // Kart Chassis (Voxel blocks)
          ctx.fillStyle = selectedRacer.color;
          ctx.fillRect(px - 22, py - 18, 44, 14);
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(px - 10, py - 27, 20, 10);
          // Wheels
          ctx.fillStyle = '#090A0F';
          ctx.fillRect(px - 27, py - 14, 6, 12);
          ctx.fillRect(px + 21, py - 14, 6, 12);

          // Update React HUD periodically
          if (Math.random() < 0.18) {
            const elapsed = ((now - s.startTime) / 1000).toFixed(2);
            setHudState({
              lap: s.lap,
              position: s.boostTimer > 0 ? 1 : 2,
              speed: Math.round(s.speed),
              driftTier: s.driftTier,
              boostRemaining: Number(s.boostTimer.toFixed(1)),
              heldItem: s.heldItem,
              lapTime: `00:${elapsed.padStart(5, '0')}`,
            });
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, qaAutopilot, selectedTrack, selectedRacer]);

  return (
    <div className="p-3 space-y-3 bg-[#0B0D14] rounded-xl border border-[#222736]">
      {/* Header & QA Playtest Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">
            Voxel Velocity 3D · Single Race (3 Laps, 8 Racers)
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
            $develop-web-game
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setQaAutopilot((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
              qaAutopilot
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-[#161B26] border-slate-700 text-slate-400'
            }`}
          >
            <Bot className="w-3 h-3" />
            <span>{qaAutopilot ? 'Codex QA Bot: ON' : 'Manual Drive'}</span>
          </button>
          <button
            onClick={() => setIsRunning((v) => !v)}
            className="p-1.5 rounded bg-[#161B26] hover:bg-[#1E2536] text-slate-200 border border-slate-700"
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            onClick={() => {
              stateRef.current.distance = 0;
              stateRef.current.lap = 1;
              stateRef.current.startTime = performance.now();
            }}
            className="p-1.5 rounded bg-[#161B26] hover:bg-[#1E2536] text-slate-200 border border-slate-700"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Pre-Race Selector Bar: Track (8), Character (8), Difficulty */}
      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        <select
          value={selectedTrack.id}
          onChange={(e) =>
            setSelectedTrack(TRACKS.find((t) => t.id === e.target.value) || TRACKS[0])
          }
          className="bg-[#131722] border border-[#262E42] rounded-lg px-2 py-1 text-slate-200 truncate"
        >
          {TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              Track: {t.name}
            </option>
          ))}
        </select>

        <select
          value={selectedRacer.id}
          onChange={(e) =>
            setSelectedRacer(RACERS.find((r) => r.id === e.target.value) || RACERS[0])
          }
          className="bg-[#131722] border border-[#262E42] rounded-lg px-2 py-1 text-slate-200 truncate"
        >
          {RACERS.map((r) => (
            <option key={r.id} value={r.id}>
              Racer: {r.name} ({r.topSpeed} km/h)
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as 'Chill' | 'Standard' | 'Mean')}
          className="bg-[#131722] border border-[#262E42] rounded-lg px-2 py-1 text-slate-200"
        >
          <option value="Chill">CPU: Chill</option>
          <option value="Standard">CPU: Standard</option>
          <option value="Mean">CPU: Mean</option>
        </select>
      </div>

      {/* Live Canvas Viewport + HUD Overlay */}
      <div className="relative rounded-lg overflow-hidden border border-[#283044] bg-black">
        <canvas ref={canvasRef} width={440} height={210} className="w-full h-48 block" />

        {/* Top HUD Banner */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none text-[11px] font-mono">
          <div className="flex items-center gap-2 bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-white/10">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-white font-bold">POS {hudState.position}/8</span>
            <span className="text-slate-400">|</span>
            <span className="text-emerald-300">LAP {hudState.lap}/3</span>
          </div>

          <div className="bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-white/10 text-cyan-300">
            {hudState.heldItem}
          </div>
        </div>

        {/* Bottom HUD Telemetry */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none text-[11px] font-mono">
          <div className="bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white font-semibold">{hudState.speed} km/h</span>
            {hudState.driftTier > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-pink-500/30 text-pink-300 border border-pink-500/40">
                DRIFT TIER {hudState.driftTier}
              </span>
            )}
            {hudState.boostRemaining > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300">
                BOOST {hudState.boostRemaining}s
              </span>
            )}
          </div>

          <div className="bg-black/75 backdrop-blur px-2 py-1 rounded-md border border-white/10 text-slate-300">
            {hudState.lapTime}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Controls: WASD / Arrows to Steer · Shift to Drift Charge · Space for Item</span>
        <span className="text-emerald-400">60 FPS · WebGL/Canvas</span>
      </div>
    </div>
  );
};
