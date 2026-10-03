"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Runner = {
  kind: "barrier" | "orb";
  lane: 0 | 1;
  z: number;
  value?: 1 | 2;
  collected?: boolean;
};
type RunResult = { score: number; collectionRate: number };
type PlayerProfile = { skill: number; failStreak: number; runs: RunResult[] };
type Difficulty = {
  baseSpeed: number;
  maxSpeed: number;
  acceleration: number;
  spawnMin: number;
  spawnRange: number;
  comboChance: number;
  goldChance: number;
};
type SparkTheme = { rgb: string; core: string; rim: string; deep: string };

const SPARK_THEMES = {
  cyan: { rgb: "44,232,255", core: "#ffffff", rim: "#a9ffff", deep: "#008dff" },
  magenta: {
    rgb: "255,62,219",
    core: "#fff5ff",
    rim: "#ffb4ef",
    deep: "#a900ff",
  },
  gold: { rgb: "255,196,43", core: "#fffbea", rim: "#ffe99d", deep: "#ff7a00" },
  violet: {
    rgb: "151,102,255",
    core: "#fbf8ff",
    rim: "#d8c5ff",
    deep: "#6a2dff",
  },
} satisfies Record<string, SparkTheme>;
type SparkThemeName = keyof typeof SPARK_THEMES;

const DEFAULT_PROFILE: PlayerProfile = { skill: 50, failStreak: 0, runs: [] };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getDifficulty = (profile: PlayerProfile): Difficulty => {
  // Help appears only after three sub-1000 runs. Skilled players get faster,
  // fair double-switch patterns without ever blocking both lanes together.
  const assist =
    profile.failStreak >= 3
      ? clamp(0.08 + (profile.failStreak - 3) * 0.025, 0.08, 0.16)
      : 0;
  const expert = clamp((profile.skill - 65) / 35, 0, 1);
  return {
    baseSpeed: 0.31 * (1 - assist + expert * 0.1),
    maxSpeed: 0.62 * (1 - assist * 0.65 + expert * 0.12),
    acceleration: 0.0009 * (1 - assist + expert * 0.25),
    spawnMin: 0.53 * (1 + assist * 1.25 - expert * 0.12),
    spawnRange: 0.18 * (1 + assist * 0.6),
    comboChance: expert * 0.32,
    goldChance: 0.12,
  };
};
const BACKGROUND_WIDTH = 941;
const BACKGROUND_HEIGHT = 1672;
// Two endpoints define one straight perspective line for each background lane.
// Keep only these two values when manually calibrating the lane.
const LANE_SPREAD_POINTS = [
  [0.1, 0.035],
  [1.1, 0.4],
] as const;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparkTrailRef = useRef<{ x: number; age: number; phase: number }[]>([]);
  const sparkClockRef = useRef(0);
  const profileRef = useRef<PlayerProfile>(DEFAULT_PROFILE);
  const gameRef = useRef({
    lane: 0 as 0 | 1,
    visualLane: 0,
    distance: 0,
    coins: 0,
    speed: 0.31,
    runners: [] as Runner[],
    spawnAt: 0.58,
    last: 0,
    over: false,
    paused: false,
    sparksSpawned: 0,
    sparksCollected: 0,
    sparkTheme: "cyan" as SparkThemeName,
    difficulty: getDifficulty(DEFAULT_PROFILE),
  });
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);
  const [newBest, setNewBest] = useState(false);

  const reset = useCallback(() => {
    const difficulty = getDifficulty(profileRef.current);
    const sparkTheme = gameRef.current.sparkTheme ?? "cyan";
    sparkTrailRef.current = [];
    sparkClockRef.current = 0;
    gameRef.current = {
      lane: 0,
      visualLane: 0,
      distance: 0,
      coins: 0,
      speed: difficulty.baseSpeed,
      runners: [],
      spawnAt: difficulty.spawnMin,
      last: performance.now(),
      over: false,
      paused: false,
      sparksSpawned: 0,
      sparksCollected: 0,
      sparkTheme,
      difficulty,
    };
    setScore(0);
    setCoins(0);
    setOver(false);
    setPaused(false);
    setNewBest(false);
  }, []);
  const switchLane = useCallback(() => {
    const g = gameRef.current;
    if (!g.over && !g.paused) g.lane = g.lane === 0 ? 1 : 0;
  }, []);
  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (g.over) return;
    g.paused = !g.paused;
    g.last = performance.now();
    setPaused(g.paused);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bestRef.current = Number(localStorage.getItem("switch-drop-best") || 0);
      setBest(bestRef.current);
      setTotalCoins(
        Number(localStorage.getItem("switch-drop-total-coins") || 0),
      );
      try {
        const saved = JSON.parse(
          localStorage.getItem("switch-drop-profile") || "null",
        ) as PlayerProfile | null;
        if (
          saved &&
          typeof saved.skill === "number" &&
          Array.isArray(saved.runs)
        )
          profileRef.current = saved;
      } catch {
        profileRef.current = DEFAULT_PROFILE;
      }
      reset();
    });
    return () => cancelAnimationFrame(id);
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = (now: number) => {
      const g = gameRef.current;
      const rect = canvas.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 2),
        w = rect.width,
        h = rect.height;
      if (
        canvas.width !== Math.floor(w * dpr) ||
        canvas.height !== Math.floor(h * dpr)
      ) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const dt = Math.min((now - (g.last || now)) / 1000, 0.035);
      g.last = now;
      if (!g.over && !g.paused) {
        const difficulty = g.difficulty;
        g.distance += dt * 12 * (g.speed / difficulty.baseSpeed);
        g.speed = Math.min(
          difficulty.maxSpeed,
          difficulty.baseSpeed + g.distance * difficulty.acceleration,
        );
        g.spawnAt -= dt * g.speed;
        if (g.spawnAt <= 0) {
          const blocked = (Math.random() > 0.5 ? 1 : 0) as 0 | 1;
          const combo =
            g.distance > 1100 &&
            difficulty.comboChance > 0 &&
            Math.random() < difficulty.comboChance;
          g.runners.push({ kind: "barrier", lane: blocked, z: -0.24 });
          if (Math.random() > 0.18) {
            g.runners.push({
              kind: "orb",
              lane: (1 - blocked) as 0 | 1,
              z: -0.432,
              value: Math.random() < difficulty.goldChance ? 2 : 1,
            });
            g.sparksSpawned += 1;
          }
          if (combo) {
            g.runners.push({
              kind: "barrier",
              lane: (1 - blocked) as 0 | 1,
              z: -0.648,
            });
            g.spawnAt = 0.92 + Math.random() * 0.12;
          } else {
            if (Math.random() > 0.58) {
              g.runners.push({
                kind: "orb",
                lane: blocked,
                z: -0.672,
                value: Math.random() < difficulty.goldChance ? 2 : 1,
              });
              g.sparksSpawned += 1;
            }
            g.spawnAt =
              difficulty.spawnMin + Math.random() * difficulty.spawnRange;
          }
        }
        g.runners.forEach((i) => (i.z += dt * g.speed));
        g.visualLane += (g.lane - g.visualLane) * Math.min(1, dt * 15);
        for (const item of g.runners) {
          if (item.collected) continue;
          const match = Math.abs(item.lane - g.visualLane) < 0.36;
          if (item.kind === "orb" && match && item.z > 0.7 && item.z < 0.89) {
            const earned = item.value ?? 1;
            item.collected = true;
            g.coins += earned;
            g.sparksCollected += 1;
            setCoins(g.coins);
            setTotalCoins((current) => {
              const next = current + earned;
              localStorage.setItem("switch-drop-total-coins", String(next));
              return next;
            });
          }
          if (
            item.kind === "barrier" &&
            match &&
            item.z > 0.72 &&
            item.z < 0.86
          ) {
            g.over = true;
            const final = Math.floor(g.distance);
            setScore(final);
            setOver(true);
            const oldProfile = profileRef.current;
            const collectionRate =
              g.sparksSpawned > 0 ? g.sparksCollected / g.sparksSpawned : 0;
            const performance =
              clamp(final / 2200, 0, 1) * 0.78 + collectionRate * 0.22;
            const nextProfile: PlayerProfile = {
              skill: Math.round(
                clamp(
                  oldProfile.skill * 0.78 + performance * 100 * 0.22,
                  0,
                  100,
                ),
              ),
              failStreak: final < 1000 ? oldProfile.failStreak + 1 : 0,
              runs: [
                ...oldProfile.runs,
                { score: final, collectionRate },
              ].slice(-5),
            };
            profileRef.current = nextProfile;
            localStorage.setItem(
              "switch-drop-profile",
              JSON.stringify(nextProfile),
            );
            setNewBest(final > bestRef.current);
            bestRef.current = Math.max(bestRef.current, final);
            setBest(bestRef.current);
            localStorage.setItem("switch-drop-best", String(bestRef.current));
            break;
          }
        }
        g.runners = g.runners.filter((i) => i.z < 1.12 && !i.collected);
        setScore(Math.floor(g.distance));
      }
      // Match the exact `background-size: cover` transform used by the tunnel image.
      // Every game object is first positioned in the background's 941×1672 design space,
      // then transformed to the current phone viewport with the same scale and crop.
      const coverScale = Math.max(w / BACKGROUND_WIDTH, h / BACKGROUND_HEIGHT);
      const coverX = (w - BACKGROUND_WIDTH * coverScale) * 0.5;
      const coverY = (h - BACKGROUND_HEIGHT * coverScale) * 0.5;
      // Keep pre-horizon spawn positions visible above the horizon instead of
      // clamping them to the same y-position until they enter the track.
      const depth = (z: number) => (z < 0 ? z * 0.18 : z ** 1.65);
      // Start at a higher point in the tunnel, then smoothly meet the same
      // foreground position so objects enter earlier without shifting the track.
      const sceneY = (z: number) => 0.17 + depth(z) * 0.87;
      const projectY = (z: number) =>
        coverY + BACKGROUND_HEIGHT * sceneY(z) * coverScale;
      const laneSpreadAt = (y: number) => {
        const [topY, topSpread] = LANE_SPREAD_POINTS[0];
        const [bottomY, bottomSpread] = LANE_SPREAD_POINTS[1];
        const t = clamp((y - topY) / (bottomY - topY), 0, 1);
        return topSpread + (bottomSpread - topSpread) * t;
      };
      const laneX = (lane: number, z: number) => {
        const laneSpread = laneSpreadAt(sceneY(z));
        return (
          coverX +
          BACKGROUND_WIDTH * (0.5 + (lane * 2 - 1) * laneSpread) * coverScale
        );
      };
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Fine floor seams flow out of the tunnel, sharing the objects' perspective.
      for (let i = 0; i < 9; i++) {
        const z = (i / 9 + g.distance * 0.0035) % 1;
        const half = w * (0.045 + z * 0.185) * 1.9,
          fy = projectY(z);
        const seam = ctx.createLinearGradient(
          w * 0.5 - half,
          fy,
          w * 0.5 + half,
          fy,
        );
        seam.addColorStop(0, "rgba(35,168,255,0)");
        seam.addColorStop(0.25, `rgba(43,149,230,${z * 0.1})`);
        seam.addColorStop(0.75, `rgba(43,149,230,${z * 0.1})`);
        seam.addColorStop(1, "rgba(35,168,255,0)");
        ctx.strokeStyle = seam;
        ctx.lineWidth = 0.5 + z * 0.6;
        ctx.beginPath();
        ctx.moveTo(w * 0.5 - half, fy);
        ctx.lineTo(w * 0.5 + half, fy);
        ctx.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const z = (i / 14 + g.distance * 0.035) % 1,
          y = projectY(z);
        for (const lane of [0, 1]) {
          ctx.strokeStyle = `rgba(46,226,255,${z * 0.36})`;
          ctx.lineWidth = 1 + z * 3;
          ctx.beginPath();
          ctx.moveTo(laneX(lane, z), y);
          ctx.lineTo(laneX(lane, z + 0.055), projectY(z + 0.055));
          ctx.stroke();
        }
      }
      for (const item of [...g.runners].sort((a, b) => a.z - b.z)) {
        if (item.z < -0.75) continue;
        const x = laneX(item.lane, item.z),
          y = projectY(item.z),
          scale = 0.18 + Math.max(0, item.z) * 1.1;
        if (item.kind === "orb") {
          const gold = item.value === 2,
            r = Math.max(2.5, 9 * scale);
          const rgb = gold ? "255,190,40" : "35,220,255";
          const rim = gold ? "#fff0ab" : "#b9ffff",
            pearl = gold ? "#fffce9" : "#f1ffff";
          const phase = g.distance * 0.18 + item.z * 11 + item.lane * 2;
          const pulse = 1 + Math.sin(phase) * 0.045;
          const aheadX = laneX(item.lane, item.z + 0.03) - x;
          const aheadY = projectY(item.z + 0.03) - y;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-Math.atan2(aheadX, aheadY));
          ctx.globalCompositeOperation = "lighter";
          ctx.shadowBlur = 0;

          // An elliptical reflection on the road, with completely feathered edges.
          ctx.save();
          ctx.translate(0, r * 1.8);
          ctx.scale(1, 0.43);
          const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.8);
          pool.addColorStop(0, `rgba(${rgb},.34)`);
          pool.addColorStop(0.32, `rgba(${rgb},.17)`);
          pool.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = pool;
          ctx.beginPath();
          ctx.arc(0, 0, r * 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // The light flows ahead of the collectible, following its lane's perspective.
          const reach = r * (6.8 + g.speed * 3);
          const beam = ctx.createLinearGradient(0, r * 0.3, 0, reach);
          beam.addColorStop(0, `rgba(${rgb},.4)`);
          beam.addColorStop(0.3, `rgba(${rgb},.16)`);
          beam.addColorStop(0.72, `rgba(${rgb},.035)`);
          beam.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(-r * 0.7, r * 0.4);
          ctx.bezierCurveTo(-r * 1.25, r * 2, -r * 0.3, reach * 0.7, 0, reach);
          ctx.bezierCurveTo(
            r * 0.3,
            reach * 0.7,
            r * 1.25,
            r * 2,
            r * 0.7,
            r * 0.4,
          );
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = beam;
          ctx.lineWidth = Math.max(0.5, r * 0.16);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(0, r * 0.8);
          ctx.lineTo(0, reach * 0.86);
          ctx.stroke();
          for (let p = 0; p < 7; p++) {
            const t = (g.distance * 0.045 + p / 7 + item.lane * 0.23) % 1;
            const dx = Math.sin(p * 4.73) * r * (0.18 + t * 0.65),
              dy = r * 1.2 + t * (reach - r * 1.2);
            const radius = Math.max(0.35, r * 0.12 * (1 - t));
            ctx.globalAlpha = (1 - t) ** 2 * 0.75;
            ctx.fillStyle = rim;
            ctx.shadowColor = `rgb(${rgb})`;
            ctx.shadowBlur = r * 0.55;
            ctx.beginPath();
            ctx.arc(dx, dy, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;

          const halo = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 4.2);
          halo.addColorStop(0, `rgba(${rgb},.48)`);
          halo.addColorStop(0.25, `rgba(${rgb},.22)`);
          halo.addColorStop(0.6, `rgba(${rgb},.055)`);
          halo.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(0, 0, r * 4.2, 0, Math.PI * 2);
          ctx.fill();

          // A luminous pearl and a separate fine rim retain detail inside the bloom.
          ctx.globalCompositeOperation = "source-over";
          const core = ctx.createRadialGradient(
            -r * 0.23,
            -r * 0.28,
            0,
            0,
            0,
            r,
          );
          core.addColorStop(0, "#ffffff");
          core.addColorStop(0.36, pearl);
          core.addColorStop(0.7, rim);
          core.addColorStop(1, gold ? "#efa320" : "#16a8e6");
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.84 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = rim;
          ctx.lineWidth = Math.max(0.65, r * 0.11);
          ctx.shadowColor = `rgb(${rgb})`;
          ctx.shadowBlur = r * 0.75;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.04 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = pearl;
          ctx.lineWidth = Math.max(0.4, r * 0.065);
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.04 * pulse, Math.PI * 1.05, Math.PI * 1.85);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.ellipse(
            -r * 0.25,
            -r * 0.28,
            r * 0.24,
            r * 0.13,
            -0.6,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
        } else {
          // Size the block against its lane, including on narrow phone screens.
          const laneWidth = Math.abs(laneX(1, item.z) - laneX(0, item.z));
          const barrierScale = (laneWidth * 0.4) / 40;
          const bw = 40 * barrierScale,
            bh = 38 * barrierScale,
            bevel = 1.8 * barrierScale,
            blockDepth = 3 * barrierScale;
          const path = (points: [number, number][]) => {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            for (let p = 1; p < points.length; p++)
              ctx.lineTo(points[p][0], points[p][1]);
            ctx.closePath();
          };
          ctx.save();
          // Keep the whole silhouette on one continuous lane-center trajectory.
          // Perspective changes the size, while the block center stays stable.
          ctx.translate(-blockDepth * 0.5, 0);
          // Reflected red light anchors the obstacle to the polished track.
          ctx.save();
          ctx.translate(x, y + bh * 1.17);
          ctx.scale(1, 0.75);
          const reflection = ctx.createRadialGradient(0, 0, 0, 0, 0, bw * 1.9);
          reflection.addColorStop(0, "rgba(255,28,54,.44)");
          reflection.addColorStop(0.38, "rgba(255,15,44,.19)");
          reflection.addColorStop(1, "rgba(255,12,40,0)");
          ctx.fillStyle = reflection;
          ctx.beginPath();
          ctx.arc(0, 0, bw * 1.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.globalCompositeOperation = "source-over";
          ctx.shadowColor = "#ff183e";
          ctx.shadowBlur = 14 * barrierScale;
          path([
            [x + bw - bevel, y - bh],
            [x + bw, y - bh + bevel],
            [x + bw + blockDepth, y - bh + bevel + blockDepth],
            [x + bw + blockDepth, y + bh - bevel],
            [x + bw, y + bh],
            [x + bw, y - bh + bevel],
          ]);
          ctx.fillStyle = "#570021";
          ctx.fill();
          path([
            [x - bw, y - bh],
            [x - bw + blockDepth, y - bh - blockDepth * 1.7],
            [x + bw + blockDepth, y - bh - blockDepth * 1.7],
            [x + bw, y - bh],
          ]);
          ctx.fillStyle = "#ef5764";
          ctx.fill();
          const face = [
            [x - bw + bevel, y - bh],
            [x + bw - bevel, y - bh],
            [x + bw, y - bh + bevel],
            [x + bw, y + bh - bevel],
            [x + bw - bevel, y + bh],
            [x - bw + bevel, y + bh],
            [x - bw, y + bh - bevel],
            [x - bw, y - bh + bevel],
          ] as [number, number][];
          const grad = ctx.createLinearGradient(x - bw, y - bh, x + bw, y + bh);
          grad.addColorStop(0, "#57131d");
          grad.addColorStop(0.4, "#250910");
          grad.addColorStop(1, "#450c16");
          path(face);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = "#ff6370";
          ctx.lineWidth = Math.max(1, 1.7 * barrierScale);
          ctx.stroke();
          const core = ctx.createRadialGradient(x, y, 0, x, y, bw * 0.85);
          core.addColorStop(0, "rgba(255,47,63,.24)");
          core.addColorStop(1, "rgba(92,0,18,0)");
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(x, y, bw * 0.85, 0, Math.PI * 2);
          ctx.fill();
          // Illuminated diagonal hazard strips frame the dark, inset face.
          ctx.shadowBlur = 0;
          for (const stripY of [
            y - bh + 4 * barrierScale,
            y + bh - 12 * barrierScale,
          ]) {
            ctx.fillStyle = "#561220";
            ctx.fillRect(
              x - bw + 3 * barrierScale,
              stripY,
              bw * 2 - 6 * barrierScale,
              8 * barrierScale,
            );
            ctx.save();
            ctx.beginPath();
            ctx.rect(
              x - bw + 3 * barrierScale,
              stripY,
              bw * 2 - 6 * barrierScale,
              8 * barrierScale,
            );
            ctx.clip();
            ctx.fillStyle = "#ff9a9e";
            ctx.shadowColor = "#ff293e";
            ctx.shadowBlur = 5 * barrierScale;
            for (let stripe = -1; stripe < 9; stripe++) {
              const sx = x - bw + stripe * 12 * barrierScale;
              path([
                [sx, stripY + 8 * barrierScale],
                [sx + 6 * barrierScale, stripY],
                [sx + 13 * barrierScale, stripY],
                [sx + 7 * barrierScale, stripY + 8 * barrierScale],
              ]);
              ctx.fill();
            }
            ctx.restore();
          }
          ctx.strokeStyle = "#ff6572";
          ctx.lineCap = "square";
          ctx.lineWidth = Math.max(2, 7.5 * barrierScale);
          ctx.shadowColor = "#ff2444";
          ctx.shadowBlur = 13 * barrierScale;
          ctx.beginPath();
          ctx.moveTo(x - bw * 0.34, y - bh * 0.34);
          ctx.lineTo(x + bw * 0.34, y + bh * 0.34);
          ctx.moveTo(x + bw * 0.34, y - bh * 0.34);
          ctx.lineTo(x - bw * 0.34, y + bh * 0.34);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#ffb0ae";
          ctx.lineWidth = Math.max(0.6, barrierScale);
          ctx.beginPath();
          ctx.moveTo(x - bw + bevel, y - bh);
          ctx.lineTo(x + bw - bevel, y - bh);
          ctx.moveTo(x - bw, y - bh + bevel);
          ctx.lineTo(x - bw, y + bh - bevel);
          ctx.stroke();
          ctx.restore();
        }
      }
      const pz = 0.79,
        px = laneX(g.visualLane, pz),
        py = projectY(pz);
      const pr = Math.max(12, Math.min(w, h) * 0.033),
        spark = SPARK_THEMES[g.sparkTheme] ?? SPARK_THEMES.cyan;
      const lifetime = 0.72;
      // Remember the actual path: the wake stays behind when the head switches lanes.
      if (!g.paused && !g.over) {
        sparkClockRef.current += dt;
        sparkTrailRef.current = sparkTrailRef.current.filter((point) => {
          point.age += dt;
          return point.age < lifetime;
        });
        sparkTrailRef.current.unshift({
          x: px / w,
          age: 0,
          phase: sparkClockRef.current,
        });
        sparkTrailRef.current.length = Math.min(
          sparkTrailRef.current.length,
          160,
        );
      }
      const time = sparkClockRef.current,
        pulse = 1 + Math.sin(time * 5) * 0.025;
      const tailLength = pr * (11.5 + clamp(g.speed - 0.31, 0, 0.4) * 8);
      const trail = [
        { x: px, y: py, t: 0 },
        ...sparkTrailRef.current.map((point) => ({
          x: point.x * w,
          y: py + (point.age / lifetime) * tailLength,
          t: point.age / lifetime,
        })),
      ];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = 0;
      // Layered, tapered light ribbon, with a fine luminous filament inside it.
      for (const layer of [
        { width: 1.05, alpha: 0.065 },
        { width: 0.43, alpha: 0.26 },
        { width: 0.105, alpha: 0.8 },
      ]) {
        for (let i = trail.length - 1; i > 0; i--) {
          const a = trail[i - 1],
            b = trail[i],
            fade = (1 - b.t) ** 1.7;
          ctx.strokeStyle = `rgba(${spark.rgb},${fade * layer.alpha})`;
          ctx.lineWidth = Math.max(0.3, pr * layer.width * (1 - b.t) ** 0.85);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // Particles are emitted along that same historical path, not glued to the head.
      for (let i = 0; i < 19; i++) {
        const t = (time * 0.85 + i / 19) % 1,
          age = t * lifetime;
        const point = sparkTrailRef.current.find((sample) => sample.age >= age);
        if (!point || t < 0.07) continue;
        const spread = Math.sin(i * 8.31) * pr * (0.16 + t * 1.2);
        const x = point.x * w + spread,
          y = py + t * tailLength;
        const r = pr * (0.035 + 0.085 * (1 - t)) * (i % 3 === 0 ? 1.3 : 0.75);
        const fade = (1 - t) ** 1.4;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
        glow.addColorStop(0, `rgba(${spark.rgb},${fade * 0.65})`);
        glow.addColorStop(1, `rgba(${spark.rgb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade;
        ctx.fillStyle = i % 3 === 0 ? spark.core : spark.rim;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const aura = ctx.createRadialGradient(px, py, pr * 0.5, px, py, pr * 4.4);
      aura.addColorStop(0, `rgba(${spark.rgb},.34)`);
      aura.addColorStop(0.22, `rgba(${spark.rgb},.2)`);
      aura.addColorStop(0.55, `rgba(${spark.rgb},.065)`);
      aura.addColorStop(1, `rgba(${spark.rgb},0)`);
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(px, py, pr * 4.4, 0, Math.PI * 2);
      ctx.fill();
      // Draw the pearl separately from the bloom so its circular edge stays crisp.
      ctx.globalCompositeOperation = "source-over";
      const body = ctx.createRadialGradient(
        px - pr * 0.22,
        py - pr * 0.28,
        pr * 0.04,
        px,
        py,
        pr * 0.88,
      );
      body.addColorStop(0, "#ffffff");
      body.addColorStop(0.4, spark.core);
      body.addColorStop(0.7, spark.rim);
      body.addColorStop(1, spark.deep);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(px, py, pr * 0.84 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = spark.rim;
      ctx.lineWidth = pr * 0.14;
      ctx.shadowColor = `rgb(${spark.rgb})`;
      ctx.shadowBlur = pr * 0.7;
      ctx.beginPath();
      ctx.arc(px, py, pr * 1.12 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = spark.core;
      ctx.lineWidth = pr * 0.055;
      ctx.beginPath();
      ctx.arc(px, py, pr * 1.12 * pulse, Math.PI * 1.03, Math.PI * 1.91);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(
        px - pr * 0.23,
        py - pr * 0.29,
        pr * 0.28,
        pr * 0.14,
        -0.65,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main
      className={`game-shell${over ? " is-over" : ""}`}
      onPointerDown={switchLane}
    >
      <div className="game-backdrop" />
      <div className="center-glow" aria-hidden="true" />
      <div className="game-vignette" />
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Switch Drop game field"
      />
      <header className="hud" aria-live="polite">
        <div className="score-block">
          <strong>{score}</strong>
        </div>
      </header>
      <div className="total-coins" aria-label={`Total coins ${totalCoins}`}>
        <span className="coin-glyph" aria-hidden="true" />
        <strong>{totalCoins}</strong>
      </div>
      {!over && (
        <button
          className="pause-button"
          type="button"
          aria-label={paused ? "Resume game" : "Pause game"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={togglePause}
        >
          <span aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      )}
      {!over && score < 45 && (
        <div className="hint">
          <b>TAP TO SWITCH</b>
          <span className="switch-arrow" aria-hidden="true" />
        </div>
      )}
      {paused && !over && (
        <section
          className="pause-screen"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span>PAUSED</span>
          <button type="button" onClick={togglePause}>
            RESUME
          </button>
        </section>
      )}
      {over && (
        <section
          className="game-over"
          aria-label="Run results"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="over-glow" aria-hidden="true" />
          <div className="neon-orbits" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="result-stack">
            <div className="best-result">
              <span>BEST SCORE</span>
              <strong>{best}</strong>
            </div>
            {newBest && <div className="new-best">NEW BEST</div>}
            <div className="run-score">
              <span>SCORE</span>
              <strong>{score}</strong>
            </div>
            <div className="run-coins">
              <span>RUN COINS</span>
              <strong>
                <i className="coin-glyph small" aria-hidden="true" />
                {coins}
              </strong>
            </div>
          </div>
          <button className="restart-button" type="button" onClick={reset}>
            <span>RESTART</span>
            <i className="restart-glyph" aria-hidden="true" />
          </button>
        </section>
      )}
    </main>
  );
}
