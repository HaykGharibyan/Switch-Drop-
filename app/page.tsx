'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Runner = { kind: 'barrier' | 'orb'; lane: 0 | 1; z: number; value?: 1 | 2; collected?: boolean };
type RunResult = { score: number; collectionRate: number };
type PlayerProfile = { skill: number; failStreak: number; runs: RunResult[] };
type Difficulty = { baseSpeed: number; maxSpeed: number; acceleration: number; spawnMin: number; spawnRange: number; comboChance: number; goldChance: number };
type SparkTheme = { rgb: string; core: string; rim: string; deep: string };

const SPARK_THEMES = {
  cyan: { rgb: '44,232,255', core: '#ffffff', rim: '#a9ffff', deep: '#008dff' },
  magenta: { rgb: '255,62,219', core: '#fff5ff', rim: '#ffb4ef', deep: '#a900ff' },
  gold: { rgb: '255,196,43', core: '#fffbea', rim: '#ffe99d', deep: '#ff7a00' },
  violet: { rgb: '151,102,255', core: '#fbf8ff', rim: '#d8c5ff', deep: '#6a2dff' },
} satisfies Record<string, SparkTheme>;
type SparkThemeName = keyof typeof SPARK_THEMES;

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
  const sparkTrailRef = useRef<{ x: number; age: number; phase: number }[]>([]);
  const sparkClockRef = useRef(0);
  const profileRef = useRef<PlayerProfile>(DEFAULT_PROFILE);
  const gameRef = useRef({ lane: 0 as 0 | 1, visualLane: 0, distance: 0, coins: 0, speed: .31, runners: [] as Runner[], spawnAt: .58, last: 0, over: false, paused: false, sparksSpawned: 0, sparksCollected: 0, sparkTheme: 'cyan' as SparkThemeName, difficulty: getDifficulty(DEFAULT_PROFILE) });
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);

  const reset = useCallback(() => {
    const difficulty = getDifficulty(profileRef.current);
    const sparkTheme = gameRef.current.sparkTheme ?? 'cyan';
    sparkTrailRef.current = [];
    sparkClockRef.current = 0;
    gameRef.current = { lane: 0, visualLane: 0, distance: 0, coins: 0, speed: difficulty.baseSpeed, runners: [], spawnAt: difficulty.spawnMin, last: performance.now(), over: false, paused: false, sparksSpawned: 0, sparksCollected: 0, sparkTheme, difficulty };
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
      // Fine floor seams flow out of the tunnel, sharing the objects' perspective.
      for (let i = 0; i < 9; i++) {
        const z = (i / 9 + g.distance * .0035) % 1;
        const half = w * (.045 + z * .185) * 1.9, fy = projectY(z);
        const seam = ctx.createLinearGradient(w * .5 - half, fy, w * .5 + half, fy);
        seam.addColorStop(0, 'rgba(35,168,255,0)'); seam.addColorStop(.25, `rgba(43,149,230,${z * .1})`);
        seam.addColorStop(.75, `rgba(43,149,230,${z * .1})`); seam.addColorStop(1, 'rgba(35,168,255,0)');
        ctx.strokeStyle = seam; ctx.lineWidth = .5 + z * .6;
        ctx.beginPath(); ctx.moveTo(w * .5 - half, fy); ctx.lineTo(w * .5 + half, fy); ctx.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const z = (i / 14 + g.distance * .035) % 1, y = projectY(z);
        for (const lane of [0, 1]) { ctx.strokeStyle = `rgba(46,226,255,${z * .36})`; ctx.lineWidth = 1 + z * 3; ctx.beginPath(); ctx.moveTo(laneX(lane, z, w), y); ctx.lineTo(laneX(lane, z + .055, w), projectY(z + .055)); ctx.stroke(); }
      }
      for (const item of [...g.runners].sort((a, b) => a.z - b.z)) {
        if (item.z < 0) continue;
        const x = laneX(item.lane, item.z, w), y = projectY(item.z), scale = .18 + item.z * 1.1;
        if (item.kind === 'orb') {
          const gold = item.value === 2, r = Math.max(2.5, 9 * scale);
          const rgb = gold ? '255,190,40' : '35,220,255';
          const rim = gold ? '#fff0ab' : '#b9ffff', pearl = gold ? '#fffce9' : '#f1ffff';
          const phase = g.distance * .18 + item.z * 11 + item.lane * 2;
          const pulse = 1 + Math.sin(phase) * .045;
          const aheadX = laneX(item.lane, item.z + .03, w) - x;
          const aheadY = projectY(item.z + .03) - y;
          ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.atan2(aheadX, aheadY));
          ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 0;

          // An elliptical reflection on the road, with completely feathered edges.
          ctx.save(); ctx.translate(0, r * 1.8); ctx.scale(1, .43);
          const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.8);
          pool.addColorStop(0, `rgba(${rgb},.34)`);
          pool.addColorStop(.32, `rgba(${rgb},.17)`);
          pool.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, r * 3.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();

          // The light flows ahead of the collectible, following its lane's perspective.
          const reach = r * (6.8 + g.speed * 3);
          const beam = ctx.createLinearGradient(0, r * .3, 0, reach);
          beam.addColorStop(0, `rgba(${rgb},.4)`);
          beam.addColorStop(.3, `rgba(${rgb},.16)`);
          beam.addColorStop(.72, `rgba(${rgb},.035)`);
          beam.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = beam;
          ctx.beginPath(); ctx.moveTo(-r * .7, r * .4);
          ctx.bezierCurveTo(-r * 1.25, r * 2, -r * .3, reach * .7, 0, reach);
          ctx.bezierCurveTo(r * .3, reach * .7, r * 1.25, r * 2, r * .7, r * .4);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = beam; ctx.lineWidth = Math.max(.5, r * .16); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, r * .8); ctx.lineTo(0, reach * .86); ctx.stroke();
          for (let p = 0; p < 7; p++) {
            const t = (g.distance * .045 + p / 7 + item.lane * .23) % 1;
            const dx = Math.sin(p * 4.73) * r * (.18 + t * .65), dy = r * 1.2 + t * (reach - r * 1.2);
            const radius = Math.max(.35, r * .12 * (1 - t));
            ctx.globalAlpha = (1 - t) ** 2 * .75;
            ctx.fillStyle = rim; ctx.shadowColor = `rgb(${rgb})`; ctx.shadowBlur = r * .55;
            ctx.beginPath(); ctx.arc(dx, dy, radius, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;

          const halo = ctx.createRadialGradient(0, 0, r * .5, 0, 0, r * 4.2);
          halo.addColorStop(0, `rgba(${rgb},.48)`);
          halo.addColorStop(.25, `rgba(${rgb},.22)`);
          halo.addColorStop(.6, `rgba(${rgb},.055)`);
          halo.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 4.2, 0, Math.PI * 2); ctx.fill();

          // A luminous pearl and a separate fine rim retain detail inside the bloom.
          ctx.globalCompositeOperation = 'source-over';
          const core = ctx.createRadialGradient(-r * .23, -r * .28, 0, 0, 0, r);
          core.addColorStop(0, '#ffffff'); core.addColorStop(.36, pearl);
          core.addColorStop(.7, rim); core.addColorStop(1, gold ? '#efa320' : '#16a8e6');
          ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * .84 * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = rim; ctx.lineWidth = Math.max(.65, r * .11);
          ctx.shadowColor = `rgb(${rgb})`; ctx.shadowBlur = r * .75;
          ctx.beginPath(); ctx.arc(0, 0, r * 1.04 * pulse, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0; ctx.strokeStyle = pearl; ctx.lineWidth = Math.max(.4, r * .065);
          ctx.beginPath(); ctx.arc(0, 0, r * 1.04 * pulse, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .8;
          ctx.beginPath(); ctx.ellipse(-r * .25, -r * .28, r * .24, r * .13, -.6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          const bw = 40 * scale, bh = 44 * scale, bevel = 4 * scale, depth = 8 * scale;
          const path = (points: [number, number][]) => { ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let p = 1; p < points.length; p++) ctx.lineTo(points[p][0], points[p][1]); ctx.closePath(); };
          ctx.save();
          // Reflected red light anchors the obstacle to the polished track.
          ctx.save(); ctx.translate(x, y + bh * 1.17); ctx.scale(1, .75);
          const reflection = ctx.createRadialGradient(0, 0, 0, 0, 0, bw * 1.9);
          reflection.addColorStop(0, 'rgba(255,28,54,.32)'); reflection.addColorStop(.38, 'rgba(255,15,44,.14)'); reflection.addColorStop(1, 'rgba(255,12,40,0)');
          ctx.fillStyle = reflection; ctx.beginPath(); ctx.arc(0, 0, bw * 1.9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          ctx.globalCompositeOperation = 'source-over'; ctx.shadowColor = '#ff183e'; ctx.shadowBlur = 14 * scale;
          path([[x + bw - bevel, y - bh], [x + bw, y - bh + bevel], [x + bw + depth, y - bh + bevel + depth], [x + bw + depth, y + bh - bevel], [x + bw, y + bh], [x + bw, y - bh + bevel]]); ctx.fillStyle = '#570021'; ctx.fill();
          path([[x - bw + bevel, y - bh], [x + bw - bevel, y - bh], [x + bw, y - bh + bevel], [x - bw, y - bh + bevel], [x - bw + depth, y - bh - depth], [x + bw - bevel + depth, y - bh - depth]]); ctx.fillStyle = '#ff5476'; ctx.fill();
          const face = [[x - bw + bevel, y - bh], [x + bw - bevel, y - bh], [x + bw, y - bh + bevel], [x + bw, y + bh - bevel], [x + bw - bevel, y + bh], [x - bw + bevel, y + bh], [x - bw, y + bh - bevel], [x - bw, y - bh + bevel]] as [number, number][];
          const grad = ctx.createLinearGradient(x - bw, y - bh, x + bw, y + bh); grad.addColorStop(0, '#791729'); grad.addColorStop(.38, '#270b1c'); grad.addColorStop(1, '#460b1b'); path(face); ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#ff5365'; ctx.lineWidth = Math.max(1, 2.4 * scale); ctx.stroke();
          const inner = face.map(([px2, py2]) => [x + (px2 - x) * .78, y + (py2 - y) * .72] as [number, number]); path(inner); ctx.strokeStyle = '#ff3f72'; ctx.lineWidth = Math.max(1, 1.5 * scale); ctx.stroke();
          const core = ctx.createRadialGradient(x, y, 0, x, y, bw * .72); core.addColorStop(0, 'rgba(255,84,140,.42)'); core.addColorStop(1, 'rgba(92,0,38,0)'); ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, bw * .72, 0, Math.PI * 2); ctx.fill();
          // Illuminated diagonal hazard strips frame the dark, inset face.
          ctx.shadowBlur = 0;
          for (const stripY of [y - bh + 4 * scale, y + bh - 12 * scale]) {
            ctx.fillStyle = '#561220'; ctx.fillRect(x - bw + 3 * scale, stripY, bw * 2 - 6 * scale, 8 * scale);
            ctx.save(); ctx.beginPath(); ctx.rect(x - bw + 3 * scale, stripY, bw * 2 - 6 * scale, 8 * scale); ctx.clip();
            ctx.fillStyle = '#ff9a9e'; ctx.shadowColor = '#ff293e'; ctx.shadowBlur = 5 * scale;
            for (let stripe = -1; stripe < 9; stripe++) {
              const sx = x - bw + stripe * 12 * scale;
              path([[sx, stripY + 8 * scale], [sx + 6 * scale, stripY], [sx + 13 * scale, stripY], [sx + 7 * scale, stripY + 8 * scale]]); ctx.fill();
            }
            ctx.restore();
          }
          ctx.strokeStyle = '#ff596c'; ctx.lineCap = 'square'; ctx.lineWidth = Math.max(2, 6.5 * scale); ctx.shadowColor = '#ff2444'; ctx.shadowBlur = 12 * scale; ctx.beginPath(); ctx.moveTo(x - bw * .32, y - bh * .29); ctx.lineTo(x + bw * .32, y + bh * .29); ctx.moveTo(x + bw * .32, y - bh * .29); ctx.lineTo(x - bw * .32, y + bh * .29); ctx.stroke();
          ctx.shadowBlur = 0; ctx.strokeStyle = '#ffb0ae'; ctx.lineWidth = Math.max(.6, scale);
          ctx.beginPath(); ctx.moveTo(x - bw + bevel, y - bh); ctx.lineTo(x + bw - bevel, y - bh); ctx.moveTo(x - bw, y - bh + bevel); ctx.lineTo(x - bw, y + bh - bevel); ctx.stroke();
          ctx.restore();
        }
      }
      const pz = .79, px = laneX(g.visualLane, pz, w), py = projectY(pz);
      const pr = Math.max(12, Math.min(w, h) * .033), spark = SPARK_THEMES[g.sparkTheme] ?? SPARK_THEMES.cyan;
      const lifetime = .72;
      // Remember the actual path: the wake stays behind when the head switches lanes.
      if (!g.paused && !g.over) {
        sparkClockRef.current += dt;
        sparkTrailRef.current = sparkTrailRef.current.filter(point => {
          point.age += dt;
          return point.age < lifetime;
        });
        sparkTrailRef.current.unshift({ x: px / w, age: 0, phase: sparkClockRef.current });
        sparkTrailRef.current.length = Math.min(sparkTrailRef.current.length, 160);
      }
      const time = sparkClockRef.current, pulse = 1 + Math.sin(time * 5) * .025;
      const tailLength = pr * (11.5 + clamp(g.speed - .31, 0, .4) * 8);
      const trail = [{ x: px, y: py, t: 0 }, ...sparkTrailRef.current.map(point => ({
        x: point.x * w, y: py + point.age / lifetime * tailLength, t: point.age / lifetime,
      }))];
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
      // Layered, tapered light ribbon, with a fine luminous filament inside it.
      for (const layer of [{ width: 1.05, alpha: .065 }, { width: .43, alpha: .26 }, { width: .105, alpha: .8 }]) {
        for (let i = trail.length - 1; i > 0; i--) {
          const a = trail[i - 1], b = trail[i], fade = (1 - b.t) ** 1.7;
          ctx.strokeStyle = `rgba(${spark.rgb},${fade * layer.alpha})`;
          ctx.lineWidth = Math.max(.3, pr * layer.width * (1 - b.t) ** .85);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // Particles are emitted along that same historical path, not glued to the head.
      for (let i = 0; i < 19; i++) {
        const t = ((time * .85 + i / 19) % 1), age = t * lifetime;
        const point = sparkTrailRef.current.find(sample => sample.age >= age);
        if (!point || t < .07) continue;
        const spread = Math.sin(i * 8.31) * pr * (.16 + t * 1.2);
        const x = point.x * w + spread, y = py + t * tailLength;
        const r = pr * (.035 + .085 * (1 - t)) * (i % 3 === 0 ? 1.3 : .75);
        const fade = (1 - t) ** 1.4;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
        glow.addColorStop(0, `rgba(${spark.rgb},${fade * .65})`); glow.addColorStop(1, `rgba(${spark.rgb},0)`);
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = fade; ctx.fillStyle = i % 3 === 0 ? spark.core : spark.rim;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      const aura = ctx.createRadialGradient(px, py, pr * .5, px, py, pr * 4.4);
      aura.addColorStop(0, `rgba(${spark.rgb},.34)`); aura.addColorStop(.22, `rgba(${spark.rgb},.2)`);
      aura.addColorStop(.55, `rgba(${spark.rgb},.065)`); aura.addColorStop(1, `rgba(${spark.rgb},0)`);
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(px, py, pr * 4.4, 0, Math.PI * 2); ctx.fill();
      // Draw the pearl separately from the bloom so its circular edge stays crisp.
      ctx.globalCompositeOperation = 'source-over';
      const body = ctx.createRadialGradient(px - pr * .22, py - pr * .28, pr * .04, px, py, pr * .88);
      body.addColorStop(0, '#ffffff'); body.addColorStop(.4, spark.core);
      body.addColorStop(.7, spark.rim); body.addColorStop(1, spark.deep);
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(px, py, pr * .84 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = spark.rim; ctx.lineWidth = pr * .14;
      ctx.shadowColor = `rgb(${spark.rgb})`; ctx.shadowBlur = pr * .7;
      ctx.beginPath(); ctx.arc(px, py, pr * 1.12 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = spark.core; ctx.lineWidth = pr * .055;
      ctx.beginPath(); ctx.arc(px, py, pr * 1.12 * pulse, Math.PI * 1.03, Math.PI * 1.91); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.ellipse(px - pr * .23, py - pr * .29, pr * .28, pr * .14, -.65, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, []);

  return <main className="game-shell" onPointerDown={switchLane}>
    <div className="game-backdrop" /><div className="center-glow" aria-hidden="true" /><div className="game-vignette" />
    <canvas ref={canvasRef} className="game-canvas" aria-label="Switch Drop game field" />
    <header className="hud" aria-live="polite"><div className="score-block"><strong>{score}</strong></div></header>
    <div className="total-coins" aria-label={`Total coins ${totalCoins}`}><span className="coin-glyph" aria-hidden="true" /><strong>{totalCoins}</strong></div>
    {!over && <button className="pause-button" type="button" aria-label={paused ? 'Resume game' : 'Pause game'} onPointerDown={e => e.stopPropagation()} onClick={togglePause}><span aria-hidden="true"><i /><i /></span></button>}
    {!over && score < 45 && <div className="hint"><b>TAP TO SWITCH</b><span className="switch-arrow" aria-hidden="true" /></div>}
    {paused && !over && <section className="pause-screen" onPointerDown={e => e.stopPropagation()}><span>PAUSED</span><button type="button" onClick={togglePause}>RESUME</button></section>}
    {over && <section className="game-over" onPointerDown={e => e.stopPropagation()}><div className="over-glow" /><div className="neon-orbits" aria-hidden="true"><i /><i /><i /></div><div className="result-stack"><div className="best-result"><span>BEST SCORE</span><strong>{best}</strong></div><div className="run-score"><span>SCORE</span><strong>{score}</strong></div><div className="run-coins"><span>RUN COINS</span><strong><i className="coin-glyph small" aria-hidden="true" />{coins}</strong></div></div><button className="restart-button" type="button" onClick={reset}><span>RESTART</span><i className="restart-glyph" aria-hidden="true" /></button><button className="settings-button" type="button" aria-label="Settings"><span className="gear-glyph" aria-hidden="true"><i /></span></button></section>}
  </main>;
}
