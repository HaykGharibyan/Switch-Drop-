'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Runner = { kind: 'barrier' | 'orb'; lane: 0 | 1; z: number; value?: 1 | 2; collected?: boolean };
type RunResult = { score: number; collectionRate: number };
type PlayerProfile = { skill: number; failStreak: number; runs: RunResult[] };
type Difficulty = { baseSpeed: number; maxSpeed: number; acceleration: number; spawnMin: number; spawnRange: number; comboChance: number; goldChance: number };

const DEFAULT_PROFILE: PlayerProfile = { skill: 50, failStreak: 0, runs: [] };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getDifficulty = (profile: PlayerProfile): Difficulty => {
  // Help appears only after three sub-1000 runs. Skilled players get faster,
  // fair double-switch patterns without ever blocking both lanes together.
  const assist = profile.failStreak >= 3 ? clamp(.08 + (profile.failStreak - 3) * .025, .08, .16) : 0;
  const expert = clamp((profile.skill - 65) / 35, 0, 1);
  return {
    baseSpeed: .31 * (1 - assist + expert * .1),
    maxSpeed: .62 * (1 - assist * .65 + expert * .12),
    acceleration: .0009 * (1 - assist + expert * .25),
    spawnMin: .53 * (1 + assist * 1.25 - expert * .12),
    spawnRange: .18 * (1 + assist * .6),
    comboChance: expert * .32,
    goldChance: .12,
  };
};
// Accepts both discrete lanes (0 / 1) and the interpolated player position.
// Using a signed value here keeps the spark moving continuously between lanes.
const laneX = (lane: number, z: number, width: number) => width * .5 + (lane * 2 - 1) * width * (.045 + z * .185);

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profileRef = useRef<PlayerProfile>(DEFAULT_PROFILE);
  const gameRef = useRef({ lane: 0 as 0 | 1, visualLane: 0, distance: 0, coins: 0, speed: .31, runners: [] as Runner[], spawnAt: .58, last: 0, over: false, paused: false, sparksSpawned: 0, sparksCollected: 0, difficulty: getDifficulty(DEFAULT_PROFILE) });
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);

  const reset = useCallback(() => {
    const difficulty = getDifficulty(profileRef.current);
    gameRef.current = { lane: 0, visualLane: 0, distance: 0, coins: 0, speed: difficulty.baseSpeed, runners: [], spawnAt: difficulty.spawnMin, last: performance.now(), over: false, paused: false, sparksSpawned: 0, sparksCollected: 0, difficulty };
    setScore(0); setCoins(0); setOver(false); setPaused(false);
  }, []);
  const switchLane = useCallback(() => { const g = gameRef.current; if (!g.over && !g.paused) g.lane = g.lane === 0 ? 1 : 0; }, []);
  const togglePause = useCallback(() => { const g = gameRef.current; if (g.over) return; g.paused = !g.paused; g.last = performance.now(); setPaused(g.paused); }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setBest(Number(localStorage.getItem('switch-drop-best') || 0));
      setTotalCoins(Number(localStorage.getItem('switch-drop-total-coins') || 0));
      try {
        const saved = JSON.parse(localStorage.getItem('switch-drop-profile') || 'null') as PlayerProfile | null;
        if (saved && typeof saved.skill === 'number' && Array.isArray(saved.runs)) profileRef.current = saved;
      } catch { profileRef.current = DEFAULT_PROFILE; }
      reset();
    });
    return () => cancelAnimationFrame(id);
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = (now: number) => {
      const g = gameRef.current;
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), w = rect.width, h = rect.height;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) { canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const dt = Math.min((now - (g.last || now)) / 1000, .035); g.last = now;
      if (!g.over && !g.paused) {
        const difficulty = g.difficulty;
        g.distance += dt * 12 * (g.speed / difficulty.baseSpeed); g.speed = Math.min(difficulty.maxSpeed, difficulty.baseSpeed + g.distance * difficulty.acceleration); g.spawnAt -= dt * g.speed;
        if (g.spawnAt <= 0) {
          const blocked = (Math.random() > .5 ? 1 : 0) as 0 | 1;
          const combo = g.distance > 1100 && difficulty.comboChance > 0 && Math.random() < difficulty.comboChance;
          g.runners.push({ kind: 'barrier', lane: blocked, z: 0 });
          if (Math.random() > .18) { g.runners.push({ kind: 'orb', lane: (1 - blocked) as 0 | 1, z: -.16, value: Math.random() < difficulty.goldChance ? 2 : 1 }); g.sparksSpawned += 1; }
          if (combo) {
            g.runners.push({ kind: 'barrier', lane: (1 - blocked) as 0 | 1, z: -.48 });
            g.spawnAt = .92 + Math.random() * .12;
          } else {
            if (Math.random() > .58) { g.runners.push({ kind: 'orb', lane: blocked, z: -.36, value: Math.random() < difficulty.goldChance ? 2 : 1 }); g.sparksSpawned += 1; }
            g.spawnAt = difficulty.spawnMin + Math.random() * difficulty.spawnRange;
          }
        }
        g.runners.forEach(i => i.z += dt * g.speed); g.visualLane += (g.lane - g.visualLane) * Math.min(1, dt * 15);
        for (const item of g.runners) {
          if (item.collected) continue;
          const match = Math.abs(item.lane - g.visualLane) < .36;
          if (item.kind === 'orb' && match && item.z > .70 && item.z < .89) {
            const earned = item.value ?? 1;
            item.collected = true; g.coins += earned; g.sparksCollected += 1; setCoins(g.coins);
            setTotalCoins(current => { const next = current + earned; localStorage.setItem('switch-drop-total-coins', String(next)); return next; });
          }
          if (item.kind === 'barrier' && match && item.z > .72 && item.z < .86) {
            g.over = true; const final = Math.floor(g.distance); setScore(final); setOver(true);
            const oldProfile = profileRef.current;
            const collectionRate = g.sparksSpawned > 0 ? g.sparksCollected / g.sparksSpawned : 0;
            const performance = clamp(final / 2200, 0, 1) * .78 + collectionRate * .22;
            const nextProfile: PlayerProfile = {
              skill: Math.round(clamp(oldProfile.skill * .78 + performance * 100 * .22, 0, 100)),
              failStreak: final < 1000 ? oldProfile.failStreak + 1 : 0,
              runs: [...oldProfile.runs, { score: final, collectionRate }].slice(-5),
            };
            profileRef.current = nextProfile;
            localStorage.setItem('switch-drop-profile', JSON.stringify(nextProfile));
            setBest(old => { const next = Math.max(old, final); localStorage.setItem('switch-drop-best', String(next)); return next; });
            break;
          }
        }
        g.runners = g.runners.filter(i => i.z < 1.12 && !i.collected); setScore(Math.floor(g.distance));
      }
      const horizonY = h * .205, bottomY = h * 1.04, projectY = (z: number) => horizonY + Math.max(0, z) ** 1.65 * (bottomY - horizonY);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const z = (i / 14 + g.distance * .035) % 1, y = projectY(z);
        for (const lane of [0, 1]) { ctx.strokeStyle = `rgba(46,226,255,${z * .36})`; ctx.lineWidth = 1 + z * 3; ctx.beginPath(); ctx.moveTo(laneX(lane, z, w) - w * .075 * z, y); ctx.lineTo(laneX(lane, z + .055, w) - w * .075 * (z + .055), projectY(z + .055)); ctx.stroke(); }
      }
      for (const item of [...g.runners].sort((a, b) => a.z - b.z)) {
        if (item.z < 0) continue;
        const x = laneX(item.lane, item.z, w), y = projectY(item.z), scale = .18 + item.z * 1.1;
        if (item.kind === 'orb') {
          const gold = item.value === 2, r = Math.max(3, 9 * scale), glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
          glow.addColorStop(0, '#fff'); glow.addColorStop(.2, gold ? '#fff3a6' : '#aff'); glow.addColorStop(.5, gold ? 'rgba(255,194,38,.55)' : 'rgba(49,235,255,.48)'); glow.addColorStop(1, gold ? 'rgba(255,170,0,0)' : 'rgba(49,235,255,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = gold ? '#fff0a0' : '#dfffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        } else {
          const bw = 40 * scale, bh = 44 * scale, bevel = 10 * scale, depth = 7 * scale;
          const path = (points: [number, number][]) => { ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let p = 1; p < points.length; p++) ctx.lineTo(points[p][0], points[p][1]); ctx.closePath(); };
          ctx.save(); ctx.shadowColor = '#ff174f'; ctx.shadowBlur = 30 * scale;
          path([[x + bw - bevel, y - bh], [x + bw, y - bh + bevel], [x + bw + depth, y - bh + bevel + depth], [x + bw + depth, y + bh - bevel], [x + bw, y + bh], [x + bw, y - bh + bevel]]); ctx.fillStyle = '#570021'; ctx.fill();
          path([[x - bw + bevel, y - bh], [x + bw - bevel, y - bh], [x + bw, y - bh + bevel], [x - bw, y - bh + bevel], [x - bw + depth, y - bh - depth], [x + bw - bevel + depth, y - bh - depth]]); ctx.fillStyle = '#ff5476'; ctx.fill();
          const face = [[x - bw + bevel, y - bh], [x + bw - bevel, y - bh], [x + bw, y - bh + bevel], [x + bw, y + bh - bevel], [x + bw - bevel, y + bh], [x - bw + bevel, y + bh], [x - bw, y + bh - bevel], [x - bw, y - bh + bevel]] as [number, number][];
          const grad = ctx.createLinearGradient(x - bw, y - bh, x + bw, y + bh); grad.addColorStop(0, '#ff547d'); grad.addColorStop(.38, '#c00b45'); grad.addColorStop(1, '#39001f'); path(face); ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#ff99ad'; ctx.lineWidth = Math.max(1, 2.4 * scale); ctx.stroke();
          const inner = face.map(([px2, py2]) => [x + (px2 - x) * .78, y + (py2 - y) * .72] as [number, number]); path(inner); ctx.strokeStyle = '#ff3f72'; ctx.lineWidth = Math.max(1, 1.5 * scale); ctx.stroke();
          const core = ctx.createRadialGradient(x, y, 0, x, y, bw * .72); core.addColorStop(0, 'rgba(255,84,140,.42)'); core.addColorStop(1, 'rgba(92,0,38,0)'); ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, bw * .72, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffd5df'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, 6 * scale); ctx.shadowColor = '#ff356a'; ctx.shadowBlur = 12 * scale; ctx.beginPath(); ctx.moveTo(x - bw * .34, y - bh * .31); ctx.lineTo(x + bw * .34, y + bh * .31); ctx.moveTo(x + bw * .34, y - bh * .31); ctx.lineTo(x - bw * .34, y + bh * .31); ctx.stroke();
          ctx.fillStyle = '#fff2f5'; for (const [cx, cy] of [[x - bw + bevel, y - bh + bevel], [x + bw - bevel, y - bh + bevel], [x - bw + bevel, y + bh - bevel], [x + bw - bevel, y + bh - bevel]]) { ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, 2.2 * scale), 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
      }
      const pz = .79, px = laneX(g.visualLane, pz, w), py = projectY(pz), pr = Math.max(11, Math.min(w, h) * .025);
      for (let i = 8; i > 0; i--) { const t = i / 8, tr = pr * (.5 - t * .035), ty = py + i * pr * .68; ctx.fillStyle = `rgba(64,235,255,${(1 - t) * .42})`; ctx.shadowColor = '#29dfff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(px + Math.sin(g.distance * 2 + i) * pr * .12, ty, Math.max(1.5, tr), 0, Math.PI * 2); ctx.fill(); }
      const aura = ctx.createRadialGradient(px, py, 0, px, py, pr * 4.8);
      aura.addColorStop(0, '#fff'); aura.addColorStop(.16, '#7ff7ff'); aura.addColorStop(.45, 'rgba(18,213,255,.52)'); aura.addColorStop(1, 'rgba(0,164,255,0)'); ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(px, py, pr * 4.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4ffff'; ctx.shadowColor = '#36edff'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(px, py, pr * .72, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#9dffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, []);

  return <main className="game-shell" onPointerDown={switchLane}>
    <div className="game-backdrop" /><div className="game-vignette" />
    <canvas ref={canvasRef} className="game-canvas" aria-label="Switch Drop game field" />
    <header className="hud" aria-live="polite"><div className="score-block"><strong>{score}</strong></div></header>
    <div className="total-coins" aria-label={`Total coins ${totalCoins}`}><span className="coin-glyph" aria-hidden="true" /><strong>{totalCoins}</strong></div>
    {!over && <button className="pause-button" type="button" aria-label={paused ? 'Resume game' : 'Pause game'} onPointerDown={e => e.stopPropagation()} onClick={togglePause}><span aria-hidden="true"><i /><i /></span></button>}
    {!over && score < 45 && <div className="hint"><b>TAP TO SWITCH</b><span className="switch-arrow" aria-hidden="true" /></div>}
    {paused && !over && <section className="pause-screen" onPointerDown={e => e.stopPropagation()}><span>PAUSED</span><button type="button" onClick={togglePause}>RESUME</button></section>}
    {over && <section className="game-over" onPointerDown={e => e.stopPropagation()}><div className="over-glow" /><div className="neon-orbits" aria-hidden="true"><i /><i /><i /></div><div className="result-stack"><div className="best-result"><span>BEST SCORE</span><strong>{best}</strong></div><div className="run-score"><span>SCORE</span><strong>{score}</strong></div><div className="run-coins"><span>RUN COINS</span><strong><i className="coin-glyph small" aria-hidden="true" />{coins}</strong></div></div><button className="restart-button" type="button" onClick={reset}><span>RESTART</span><i className="restart-glyph" aria-hidden="true" /></button><button className="settings-button" type="button" aria-label="Settings"><span className="gear-glyph" aria-hidden="true"><i /></span></button></section>}
  </main>;
}
