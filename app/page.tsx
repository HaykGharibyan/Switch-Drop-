"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  requestShopPurchase,
  SHOP_PRODUCTS,
  type ShopProductId,
} from "./shop-products";

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
type SparkTheme = {
  rgb: string;
  core: string;
  rim: string;
  deep: string;
  effect?:
    | "rainbow"
    | "aurora"
    | "supernova"
    | "plasma"
    | "dark-matter"
    | "solar-eclipse"
    | "ice-crystal"
    | "tiger-flame"
    | "neon-lightning"
    | "toxic-reactor"
    | "silver-comet"
    | "cosmic-nebula";
};
type DailyRewardStatus = {
  serverNow: number;
  claimedDay: number;
  nextDay: number;
  canClaim: boolean;
  nextClaimAt: number;
  expiresAt: number | null;
  rewards: readonly number[];
  error?: string;
};
type ClaimedReward = { amount: number; day: number };

const DAILY_REWARDS = [100, 150, 200, 250, 300, 350, 550] as const;
const COMMON_SKINS = [
  "cyan",
  "red",
  "lime",
  "violet",
  "blue",
  "yellow",
  "pink",
  "green",
  "orange",
  "purple",
  "white",
  "teal",
  "crimson",
  "amber",
  "magenta",
  "sapphire",
] as const;
const SPECIAL_SKINS = [
  "rainbow",
  "aurora",
  "supernova",
  "plasma",
  "dark-matter",
  "solar-eclipse",
  "ice-crystal",
  "tiger-flame",
  "neon-lightning",
  "toxic-reactor",
  "silver-comet",
  "cosmic-nebula",
] as const;
const IMPLEMENTED_SKINS = [...COMMON_SKINS, ...SPECIAL_SKINS] as const;
const CUSTOMIZE_SLOTS = Array.from({ length: 28 }, (_, index) => ({
  id: index + 1,
  rare: index >= 16,
  price: index === 0 ? 0 : index < 16 ? 250 : 1000,
  theme:
    index < COMMON_SKINS.length
      ? COMMON_SKINS[index]
      : SPECIAL_SKINS[index - COMMON_SKINS.length] ?? null,
}));

const SPARK_THEMES = {
  cyan: { rgb: "44,232,255", core: "#ffffff", rim: "#a9ffff", deep: "#008dff" },
  blue: { rgb: "36,124,255", core: "#ffffff", rim: "#b8d7ff", deep: "#1449ff" },
  teal: { rgb: "0,205,181", core: "#ffffff", rim: "#a4fff1", deep: "#008d7c" },
  green: { rgb: "20,230,111", core: "#ffffff", rim: "#b8ffd2", deep: "#00a943" },
  lime: { rgb: "155,255,26", core: "#ffffed", rim: "#e7ff9b", deep: "#65c900" },
  yellow: { rgb: "255,225,31", core: "#fffef1", rim: "#fff59d", deep: "#d99a00" },
  orange: { rgb: "255,122,24", core: "#fff8eb", rim: "#ffc383", deep: "#e13a00" },
  red: { rgb: "255,36,61", core: "#fffafa", rim: "#ff9aa7", deep: "#f00024" },
  coral: { rgb: "255,98,112", core: "#fffafa", rim: "#ffd0d0", deep: "#e23f58" },
  pink: { rgb: "255,47,171", core: "#fff7fd", rim: "#fface0", deep: "#d6007a" },
  rainbow: {
    rgb: "255,92,188",
    core: "#ffffff",
    rim: "#ffd8f5",
    deep: "#a72dff",
    effect: "rainbow",
  },
  aurora: {
    rgb: "47,255,201",
    core: "#ffffff",
    rim: "#a9ffe9",
    deep: "#7c48ff",
    effect: "aurora",
  },
  supernova: {
    rgb: "255,179,44",
    core: "#ffffff",
    rim: "#fff0a3",
    deep: "#ff391f",
    effect: "supernova",
  },
  plasma: {
    rgb: "255,48,221",
    core: "#ffffff",
    rim: "#ffc0f6",
    deep: "#7838ff",
    effect: "plasma",
  },
  "dark-matter": {
    rgb: "176,42,255",
    core: "#16001f",
    rim: "#ff79e7",
    deep: "#35106e",
    effect: "dark-matter",
  },
  "solar-eclipse": {
    rgb: "255,183,35",
    core: "#07030b",
    rim: "#ffe07a",
    deep: "#e35b00",
    effect: "solar-eclipse",
  },
  "ice-crystal": {
    rgb: "148,226,255",
    core: "#ffffff",
    rim: "#dffaff",
    deep: "#3a8dff",
    effect: "ice-crystal",
  },
  "tiger-flame": {
    rgb: "255,119,20",
    core: "#fff4d8",
    rim: "#ffc66e",
    deep: "#4b1100",
    effect: "tiger-flame",
  },
  "neon-lightning": {
    rgb: "72,177,255",
    core: "#ffffff",
    rim: "#c8edff",
    deep: "#3d35ff",
    effect: "neon-lightning",
  },
  "toxic-reactor": {
    rgb: "115,255,32",
    core: "#f5ffd8",
    rim: "#d8ff87",
    deep: "#148900",
    effect: "toxic-reactor",
  },
  "silver-comet": {
    rgb: "220,238,255",
    core: "#ffffff",
    rim: "#f4fbff",
    deep: "#8ca9c7",
    effect: "silver-comet",
  },
  "cosmic-nebula": {
    rgb: "153,77,255",
    core: "#fff5ff",
    rim: "#e3b9ff",
    deep: "#2545c9",
    effect: "cosmic-nebula",
  },
  magenta: {
    rgb: "255,34,239",
    core: "#fff5ff",
    rim: "#ffa7f7",
    deep: "#bd00d8",
  },
  gold: { rgb: "255,196,43", core: "#fffbea", rim: "#ffe99d", deep: "#ff7a00" },
  violet: {
    rgb: "146,80,255",
    core: "#fbf8ff",
    rim: "#d0b4ff",
    deep: "#6323f4",
  },
  purple: { rgb: "192,43,255", core: "#fff8ff", rim: "#e7a7ff", deep: "#7910cf" },
  white: { rgb: "239,255,255", core: "#ffffff", rim: "#ffffff", deep: "#8fcfff" },
  crimson: { rgb: "184,0,63", core: "#fff5f8", rim: "#ff8eb1", deep: "#740020" },
  amber: { rgb: "255,176,0", core: "#fffbea", rim: "#ffe18a", deep: "#cf6900" },
  sapphire: { rgb: "33,64,201", core: "#f5f7ff", rim: "#9cb7ff", deep: "#111f78" },
  ice: { rgb: "126,214,255", core: "#ffffff", rim: "#d6f6ff", deep: "#258cff" },
  mint: { rgb: "114,255,219", core: "#ffffff", rim: "#d0fff2", deep: "#00b889" },
} satisfies Record<string, SparkTheme>;
type SparkThemeName = keyof typeof SPARK_THEMES;
const CUSTOMIZE_HUES: Record<string, number> = {
  cyan: 147,
  blue: 176,
  teal: 131,
  green: 102,
  lime: 53,
  yellow: 13,
  orange: 348,
  red: 315,
  coral: 314,
  pink: 288,
  magenta: 268,
  violet: 219,
  purple: 241,
  white: 0,
  crimson: 320,
  amber: 1,
  sapphire: 190,
  rainbow: 268,
  aurora: 124,
  supernova: 355,
  plasma: 265,
  "dark-matter": 238,
  "solar-eclipse": 2,
  "ice-crystal": 158,
  "tiger-flame": 345,
  "neon-lightning": 178,
  "toxic-reactor": 72,
  "silver-comet": 0,
  "cosmic-nebula": 224,
  ice: 159,
  mint: 124,
};
const CUSTOMIZE_BRIGHTNESS: Record<string, number> = {
  cyan: 1.18,
  red: 1.08,
  lime: 1.24,
  violet: 1.08,
  blue: 1.05,
  yellow: 1.28,
  pink: 1.12,
  green: 1.13,
  orange: 1.15,
  purple: 1.02,
  white: 1.35,
  teal: 1.06,
  crimson: 0.88,
  amber: 1.14,
  magenta: 1.1,
  sapphire: 0.82,
  rainbow: 1.16,
  aurora: 1.12,
  supernova: 1.3,
  plasma: 1.14,
  "dark-matter": 0.72,
  "solar-eclipse": 0.9,
  "ice-crystal": 1.38,
  "tiger-flame": 1.18,
  "neon-lightning": 1.28,
  "toxic-reactor": 1.18,
  "silver-comet": 1.32,
  "cosmic-nebula": 0.98,
};
const customizeStyle = (theme: string | null): CSSProperties => {
  const spark = SPARK_THEMES[theme as SparkThemeName] ?? SPARK_THEMES.cyan;
  const color = `rgb(${spark.rgb})`;
  return {
    "--customize-hue": `${CUSTOMIZE_HUES[theme || "cyan"] ?? 0}deg`,
    "--customize-saturation":
      theme === "white" || theme === "silver-comet" ? "0" : "6.5",
    "--customize-brightness": String(
      CUSTOMIZE_BRIGHTNESS[theme || "cyan"] ?? 1.15,
    ),
    "--customize-color": color,
    "--customize-glow": color,
    "--customize-deep": color,
  } as CSSProperties;
};

const hueRgb = (hue: number) => {
  const angle = ((hue % 360) + 360) % 360;
  const sector = angle / 60;
  const x = 1 - Math.abs((sector % 2) - 1);
  const [r, g, b] =
    sector < 1
      ? [1, x, 0]
      : sector < 2
        ? [x, 1, 0]
        : sector < 3
          ? [0, 1, x]
          : sector < 4
            ? [0, x, 1]
            : sector < 5
              ? [x, 0, 1]
              : [1, 0, x];
  return [r, g, b].map((value) => Math.round(value * 255)).join(",");
};
const animatedSparkTheme = (theme: SparkTheme, time: number): SparkTheme => {
  if (!theme.effect) return theme;
  if (theme.effect === "rainbow") {
    const hue = (time * 82) % 360;
    return {
      rgb: hueRgb(hue),
      core: "#ffffff",
      rim: `hsl(${hue} 100% 82%)`,
      deep: `hsl(${(hue + 24) % 360} 100% 55%)`,
      effect: "rainbow",
    };
  }
  if (theme.effect === "aurora") {
    const hue = 175 + Math.sin(time * 1.8) * 78;
    return {
      rgb: hueRgb(hue),
      core: "#ffffff",
      rim: `hsl(${hue} 100% 82%)`,
      deep: `hsl(${(hue + 72) % 360} 100% 57%)`,
      effect: "aurora",
    };
  }
  if (theme.effect === "supernova") {
    const flare = (Math.sin(time * 5.2) + 1) * 0.5;
    return {
      rgb: `255,${Math.round(105 + flare * 116)},${Math.round(18 + flare * 52)}`,
      core: "#ffffff",
      rim: flare > 0.55 ? "#fffbd7" : "#ffd060",
      deep: flare > 0.55 ? "#ff7a19" : "#ef192a",
      effect: "supernova",
    };
  }
  if (theme.effect === "plasma") {
    const hue = 302 + Math.sin(time * 3.8) * 31;
    return { rgb: hueRgb(hue), core: "#ffffff", rim: `hsl(${hue} 100% 84%)`, deep: `hsl(${(hue + 54) % 360} 100% 58%)`, effect: "plasma" };
  }
  if (theme.effect === "dark-matter") {
    const hue = 281 + Math.sin(time * 1.7) * 18;
    return { rgb: hueRgb(hue), core: "#120018", rim: `hsl(${hue + 24} 100% 72%)`, deep: "#2a0757", effect: theme.effect };
  }
  if (theme.effect === "solar-eclipse") {
    const heat = (Math.sin(time * 4.1) + 1) * 0.5;
    return { rgb: `255,${Math.round(143 + heat * 65)},${Math.round(14 + heat * 25)}`, core: "#050207", rim: "#ffe27a", deep: "#d74700", effect: theme.effect };
  }
  if (theme.effect === "ice-crystal") {
    const hue = 196 + Math.sin(time * 2.4) * 10;
    return { rgb: hueRgb(hue), core: "#ffffff", rim: "#e7fbff", deep: "#3d8dff", effect: theme.effect };
  }
  if (theme.effect === "tiger-flame") {
    const heat = (Math.sin(time * 7.2) + 1) * 0.5;
    return { rgb: `255,${Math.round(76 + heat * 79)},${Math.round(4 + heat * 20)}`, core: "#fff4d6", rim: "#ffc056", deep: "#541000", effect: theme.effect };
  }
  if (theme.effect === "neon-lightning") {
    const flash = Math.sin(time * 15) > 0.72 ? 28 : 0;
    return { rgb: `${72 + flash},${177 + Math.round(flash * 0.7)},255`, core: "#ffffff", rim: "#d7f4ff", deep: "#3549ff", effect: theme.effect };
  }
  if (theme.effect === "toxic-reactor") {
    const hue = 96 + Math.sin(time * 3.2) * 11;
    return { rgb: hueRgb(hue), core: "#f8ffdc", rim: "#dcff89", deep: "#118700", effect: theme.effect };
  }
  if (theme.effect === "silver-comet") {
    const blue = Math.round(238 + (Math.sin(time * 2.7) + 1) * 8);
    return { rgb: `${blue - 12},${blue},255`, core: "#ffffff", rim: "#f7fcff", deep: "#88a9c9", effect: theme.effect };
  }
  const hue = 258 + Math.sin(time * 1.25) * 34;
  return { rgb: hueRgb(hue), core: "#fff7ff", rim: `hsl(${hue} 100% 86%)`, deep: `hsl(${(hue + 45) % 360} 78% 45%)`, effect: "cosmic-nebula" };
};

const skinLabel = (theme: string | null) =>
  (theme ?? "cyan").replace(/-/g, " ").toUpperCase();

const DEFAULT_PROFILE: PlayerProfile = { skill: 50, failStreak: 0, runs: [] };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const formatCountdown = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};
const clearStaleModalLocation = () => {
  if (
    !["#shop", "#customize", "#daily", "#daily-reward", "#settings"].includes(
      window.location.hash,
    )
  )
    return;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
};

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
    lobby: true,
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
  const [lobby, setLobby] = useState(true);
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);
  const displayedScoreRef = useRef(0);
  const [newBest, setNewBest] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const shopHistoryRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsHistoryRef = useRef(false);
  const [settingsPrivacyOpen, setSettingsPrivacyOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const customizeHistoryRef = useRef(false);
  const [customizeSelection, setCustomizeSelection] = useState(0);
  const [customizeOwned, setCustomizeOwned] = useState<boolean[]>([
    true,
    false,
    ...Array(26).fill(false),
  ]);
  const [equippedSkin, setEquippedSkin] = useState<SparkThemeName>("cyan");
  const [customizeNotice, setCustomizeNotice] = useState("");
  const purchaseSoundRef = useRef<HTMLAudioElement | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<DailyRewardStatus | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState("");
  const [dailyRemaining, setDailyRemaining] = useState(0);
  const [claimedReward, setClaimedReward] = useState<ClaimedReward | null>(null);
  const dailyHistoryRef = useRef(false);
  const rewardHistoryRef = useRef(false);
  const dailyClockRef = useRef({ serverNow: 0, performanceNow: 0 });

  const initializeRun = useCallback((showLobby: boolean) => {
    const difficulty = getDifficulty(profileRef.current);
    const sparkTheme = gameRef.current.sparkTheme ?? "cyan";
    sparkTrailRef.current = [];
    sparkClockRef.current = 0;
    displayedScoreRef.current = 0;
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
      lobby: showLobby,
      sparksSpawned: 0,
      sparksCollected: 0,
      sparkTheme,
      difficulty,
    };
    setScore(0);
    setCoins(0);
    setOver(false);
    setPaused(false);
    setLobby(showLobby);
    setNewBest(false);
  }, []);
  const enterLobby = useCallback(() => initializeRun(true), [initializeRun]);
  const startGame = useCallback(() => initializeRun(false), [initializeRun]);
  const openShop = useCallback(() => {
    if (shopHistoryRef.current) return;
    clearStaleModalLocation();
    shopHistoryRef.current = true;
    window.history.pushState({ switchDropShop: true }, "", "#shop");
    setShopOpen(true);
  }, []);
  const closeShop = useCallback(() => {
    if (!shopHistoryRef.current) return;
    shopHistoryRef.current = false;
    setShopOpen(false);
    if (window.history.state?.switchDropShop) window.history.back();
  }, []);
  const openSettings = useCallback(() => {
    if (settingsHistoryRef.current) return;
    clearStaleModalLocation();
    settingsHistoryRef.current = true;
    window.history.pushState({ switchDropSettings: true }, "", "#settings");
    setSettingsPrivacyOpen(false);
    setSettingsOpen(true);
  }, []);
  const closeSettings = useCallback(() => {
    if (!settingsHistoryRef.current) return;
    settingsHistoryRef.current = false;
    setSettingsPrivacyOpen(false);
    setSettingsOpen(false);
    if (window.history.state?.switchDropSettings) window.history.back();
  }, []);
  const toggleMusic = useCallback(() => {
    setMusicEnabled((current) => {
      const next = !current;
      localStorage.setItem("switch-drop-music-enabled", String(next));
      return next;
    });
  }, []);
  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      localStorage.setItem("switch-drop-sound-enabled", String(next));
      return next;
    });
  }, []);
  const handleShopPurchase = useCallback((productId: ShopProductId) => {
    requestShopPurchase(productId);
  }, []);
  const openCustomize = useCallback(() => {
    if (customizeHistoryRef.current) return;
    clearStaleModalLocation();
    customizeHistoryRef.current = true;
    window.history.pushState(
      { switchDropCustomize: true },
      "",
      "#customize",
    );
    const equippedIndex = CUSTOMIZE_SLOTS.findIndex(
      (slot) => slot.theme === equippedSkin,
    );
    setCustomizeSelection(equippedIndex >= 0 ? equippedIndex : 0);
    setCustomizeNotice("");
    setCustomizeOpen(true);
  }, [equippedSkin]);
  const closeCustomize = useCallback(() => {
    if (!customizeHistoryRef.current) return;
    customizeHistoryRef.current = false;
    setCustomizeOpen(false);
    if (window.history.state?.switchDropCustomize) window.history.back();
  }, []);
  const handleCustomizeSlot = useCallback(
    (slot: (typeof CUSTOMIZE_SLOTS)[number]) => {
      const owned = customizeOwned[slot.id - 1] || slot.id === 1;
      if (owned) {
        setCustomizeSelection(slot.id - 1);
        const nextSkin = slot.theme as SparkThemeName;
        gameRef.current.sparkTheme = nextSkin;
        setEquippedSkin(nextSkin);
        localStorage.setItem("switch-drop-equipped-skin", nextSkin);
        setCustomizeNotice("");
        return;
      }
      if (!slot.theme) {
        setCustomizeNotice("COMING SOON");
        return;
      }
    if (totalCoins < slot.price) {
      customizeHistoryRef.current = false;
      setCustomizeOpen(false);
      setCustomizeNotice("");
      openShop();
      return;
    }
    const nextOwned = customizeOwned.map((value, index) =>
      index === slot.id - 1 ? true : value,
    );
    setCustomizeOwned(nextOwned);
    localStorage.setItem("switch-drop-owned-skins", JSON.stringify(nextOwned));
    setTotalCoins((current) => {
      const next = current - slot.price;
      localStorage.setItem("switch-drop-total-coins", String(next));
      return next;
    });
    setCustomizeSelection(slot.id - 1);
    const nextSkin = slot.theme as SparkThemeName;
    gameRef.current.sparkTheme = nextSkin;
    setEquippedSkin(nextSkin);
    localStorage.setItem("switch-drop-equipped-skin", nextSkin);
    setCustomizeNotice(`${skinLabel(slot.theme)} SPARK UNLOCKED`);
    if (soundEnabled) {
      const sound =
        purchaseSoundRef.current ?? new Audio("/skin-purchase.mp3?v=1");
      purchaseSoundRef.current = sound;
      sound.currentTime = 0;
      void sound.play().catch(() => {
        // Some mobile browsers may still mute audio at the system level.
      });
    }
  }, [customizeOwned, openShop, soundEnabled, totalCoins]);
  const applyDailyStatus = useCallback((status: DailyRewardStatus) => {
    dailyClockRef.current = {
      serverNow: status.serverNow,
      performanceNow: performance.now(),
    };
    setDailyStatus(status);
    setDailyRemaining(
      status.canClaim ? 0 : Math.max(0, status.nextClaimAt - status.serverNow),
    );
  }, []);
  const loadDailyStatus = useCallback(async () => {
    setDailyLoading(true);
    setDailyError("");
    try {
      const response = await fetch("/api/daily-reward", { cache: "no-store" });
      const data = (await response.json()) as DailyRewardStatus;
      if (!response.ok) throw new Error(data.error || "Unable to load rewards.");
      applyDailyStatus(data);
    } catch (error) {
      setDailyError(
        error instanceof Error ? error.message : "Unable to load rewards.",
      );
    } finally {
      setDailyLoading(false);
    }
  }, [applyDailyStatus]);
  const openDaily = useCallback(() => {
    if (dailyHistoryRef.current) return;
    clearStaleModalLocation();
    dailyHistoryRef.current = true;
    window.history.pushState({ switchDropDaily: true }, "", "#daily");
    setDailyOpen(true);
    void loadDailyStatus();
  }, [loadDailyStatus]);
  const closeDaily = useCallback(() => {
    if (!dailyHistoryRef.current) return;
    dailyHistoryRef.current = false;
    setDailyOpen(false);
    setDailyError("");
    if (window.history.state?.switchDropDaily) window.history.back();
  }, []);
  const closeRewardPopup = useCallback(() => {
    if (!rewardHistoryRef.current) {
      setClaimedReward(null);
      return;
    }
    rewardHistoryRef.current = false;
    setClaimedReward(null);
    if (window.history.state?.switchDropReward) window.history.back();
  }, []);
  const claimDailyReward = useCallback(async () => {
    if (dailyLoading || !dailyStatus?.canClaim) return;
    setDailyLoading(true);
    setDailyError("");
    try {
      const response = await fetch("/api/daily-reward", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await response.json()) as DailyRewardStatus & {
        claimed?: boolean;
        reward?: number;
        day?: number;
      };
      if (!response.ok || !data.claimed || !data.reward || !data.day) {
        if (data.serverNow) applyDailyStatus(data);
        throw new Error(data.error || "Unable to claim reward.");
      }
      applyDailyStatus(data);
      setTotalCoins((current) => {
        const next = current + data.reward!;
        localStorage.setItem("switch-drop-total-coins", String(next));
        return next;
      });
      rewardHistoryRef.current = true;
      window.history.pushState(
        { switchDropDaily: true, switchDropReward: true },
        "",
        "#daily-reward",
      );
      setClaimedReward({ amount: data.reward, day: data.day });
    } catch (error) {
      setDailyError(
        error instanceof Error ? error.message : "Unable to claim reward.",
      );
    } finally {
      setDailyLoading(false);
    }
  }, [applyDailyStatus, dailyLoading, dailyStatus]);
  const switchLane = useCallback(() => {
    const g = gameRef.current;
    if (!g.over && !g.paused && !g.lobby)
      g.lane = g.lane === 0 ? 1 : 0;
  }, []);
  const handleScreenPointerDown = useCallback(() => {
    if (gameRef.current.lobby) startGame();
    else switchLane();
  }, [startGame, switchLane]);
  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (g.over || g.lobby) return;
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
      setMusicEnabled(
        localStorage.getItem("switch-drop-music-enabled") !== "false",
      );
      setSoundEnabled(
        localStorage.getItem("switch-drop-sound-enabled") !== "false",
      );
      let restoredOwned = [true, false, ...Array(26).fill(false)];
      try {
        const savedOwned = JSON.parse(
          localStorage.getItem("switch-drop-owned-skins") || "null",
        );
        if (Array.isArray(savedOwned)) {
          restoredOwned = restoredOwned.map((value, index) =>
            index === 0 ? true : Boolean(savedOwned[index] ?? value),
          );
        }
      } catch {
        restoredOwned = [true, false, ...Array(26).fill(false)];
      }
      setCustomizeOwned(restoredOwned);
      const savedEquipped = localStorage.getItem("switch-drop-equipped-skin");
      const restoredSkin: SparkThemeName =
        IMPLEMENTED_SKINS.includes(
          savedEquipped as (typeof IMPLEMENTED_SKINS)[number],
        )
          ? (savedEquipped as SparkThemeName)
          : "cyan";
      gameRef.current.sparkTheme = restoredSkin;
      setEquippedSkin(restoredSkin);
      const restoredIndex = CUSTOMIZE_SLOTS.findIndex(
        (slot) => slot.theme === restoredSkin,
      );
      setCustomizeSelection(restoredIndex >= 0 ? restoredIndex : 0);
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
      enterLobby();
    });
    return () => cancelAnimationFrame(id);
  }, [enterLobby]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as
        | {
            switchDropShop?: boolean;
            switchDropSettings?: boolean;
            switchDropCustomize?: boolean;
            switchDropDaily?: boolean;
            switchDropReward?: boolean;
          }
        | null;
      shopHistoryRef.current = Boolean(state?.switchDropShop);
      settingsHistoryRef.current = Boolean(state?.switchDropSettings);
      customizeHistoryRef.current = Boolean(state?.switchDropCustomize);
      dailyHistoryRef.current = Boolean(state?.switchDropDaily);
      rewardHistoryRef.current = Boolean(state?.switchDropReward);
      setShopOpen(Boolean(state?.switchDropShop));
      setSettingsOpen(Boolean(state?.switchDropSettings));
      setSettingsPrivacyOpen(false);
      setCustomizeOpen(Boolean(state?.switchDropCustomize));
      setDailyOpen(Boolean(state?.switchDropDaily));
      if (!state?.switchDropReward) setClaimedReward(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (rewardHistoryRef.current) closeRewardPopup();
      else if (dailyHistoryRef.current) closeDaily();
      else if (customizeHistoryRef.current) closeCustomize();
      else if (settingsHistoryRef.current) closeSettings();
      else closeShop();
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCustomize, closeDaily, closeRewardPopup, closeSettings, closeShop]);

  useEffect(() => {
    if (!dailyOpen || !dailyStatus || dailyStatus.canClaim) return;
    const tick = () => {
      const elapsed =
        (performance.now() - dailyClockRef.current.performanceNow) / 1000;
      const serverNow = dailyClockRef.current.serverNow + elapsed;
      const remaining = Math.max(
        0,
        Math.ceil(dailyStatus.nextClaimAt - serverNow),
      );
      setDailyRemaining(remaining);
      if (remaining === 0) {
        setDailyStatus((current) =>
          current ? { ...current, canClaim: true } : current,
        );
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [dailyOpen, dailyStatus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;
    let frame = 0;
    let width = 0;
    let height = 0;
    let renderDpr = 1;
    let idleFrameDrawn = false;
    let trailSampleAccumulator = 0;
    const mobileRendering =
      window.matchMedia("(pointer: coarse)").matches ||
      Math.min(window.innerWidth, window.innerHeight) < 700;
    const floorSeamCount = mobileRendering ? 6 : 9;
    const laneDashCount = mobileRendering ? 10 : 14;
    const orbParticleCount = mobileRendering ? 4 : 7;
    const trailParticleCount = mobileRendering ? 10 : 19;
    const trailSampleInterval = mobileRendering ? 1 / 30 : 1 / 45;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      renderDpr = Math.min(
        window.devicePixelRatio || 1,
        mobileRendering ? 1.25 : 1.75,
      );
      canvas.width = Math.max(1, Math.floor(width * renderDpr));
      canvas.height = Math.max(1, Math.floor(height * renderDpr));
      idleFrameDrawn = false;
    };
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();

    const draw = (now: number) => {
      const g = gameRef.current;
      const w = width;
      const h = height;
      if (w <= 0 || h <= 0) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const idle = g.over || g.paused;
      if (idle && idleFrameDrawn) {
        g.last = now;
        frame = requestAnimationFrame(draw);
        return;
      }
      idleFrameDrawn = idle;
      ctx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const dt = Math.min((now - (g.last || now)) / 1000, 0.035);
      g.last = now;
      if (!g.over && !g.paused && !g.lobby) {
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
              z: -0.36,
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
                z: -0.56,
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
            displayedScoreRef.current = final;
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
        const nextScore = Math.floor(g.distance);
        if (nextScore !== displayedScoreRef.current) {
          displayedScoreRef.current = nextScore;
          setScore(nextScore);
        }
      }
      // Match the exact `background-size: cover` transform used by the tunnel image.
      // Every game object is first positioned in the background's 941×1672 design space,
      // then transformed to the current phone viewport with the same scale and crop.
      const coverScale = Math.max(w / BACKGROUND_WIDTH, h / BACKGROUND_HEIGHT);
      const coverX = (w - BACKGROUND_WIDTH * coverScale) * 0.5;
      const coverY = (h - BACKGROUND_HEIGHT * coverScale) * 0.5;
      // Keep pre-horizon spawn positions visible above the horizon instead of
      // clamping them to the same y-position until they enter the track.
      // Blend the distant linear motion into the foreground perspective over a
      // wide interval. Matching both position and slope keeps the whole trip
      // feeling like one continuous movement without a pause at the horizon.
      const depth = (z: number) => {
        const blendEdge = 0.32;
        if (z <= -blendEdge) return z * 0.2;
        if (z >= blendEdge) return z ** 1.65;

        const t = (z + blendEdge) / (blendEdge * 2);
        const t2 = t * t;
        const t3 = t2 * t;
        const start = -blendEdge * 0.2;
        const end = blendEdge ** 1.65;
        const startSlope = 0.2 * blendEdge * 2;
        const endSlope = 1.65 * blendEdge ** 0.65 * blendEdge * 2;

        return (
          (2 * t3 - 3 * t2 + 1) * start +
          (t3 - 2 * t2 + t) * startSlope +
          (-2 * t3 + 3 * t2) * end +
          (t3 - t2) * endSlope
        );
      };
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
      for (let i = 0; i < floorSeamCount; i++) {
        const z = (i / floorSeamCount + g.distance * 0.0035) % 1;
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
      for (let i = 0; i < laneDashCount; i++) {
        const z = (i / laneDashCount + g.distance * 0.035) % 1,
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
          for (let p = 0; p < orbParticleCount; p++) {
            const t =
              (g.distance * 0.045 +
                p / orbParticleCount +
                item.lane * 0.23) %
              1;
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
        sparkBase = SPARK_THEMES[g.sparkTheme] ?? SPARK_THEMES.rainbow;
      const lifetime = 0.72;
      // Remember the actual path: the wake stays behind when the head switches lanes.
      if (!g.paused && !g.over) {
        sparkClockRef.current += dt;
        const trailPoints = sparkTrailRef.current;
        for (const point of trailPoints) {
          point.age += dt;
        }
        while (
          trailPoints.length > 0 &&
          trailPoints[trailPoints.length - 1].age >= lifetime
        ) {
          trailPoints.pop();
        }
        trailSampleAccumulator += dt;
        if (
          trailPoints.length === 0 ||
          trailSampleAccumulator >= trailSampleInterval
        ) {
          trailSampleAccumulator %= trailSampleInterval;
          trailPoints.unshift({
            x: px / w,
            age: 0,
            phase: sparkClockRef.current,
          });
        }
        const maxTrailSamples = Math.ceil(lifetime / trailSampleInterval) + 2;
        if (trailPoints.length > maxTrailSamples) {
          trailPoints.length = maxTrailSamples;
        }
      }
      const time = sparkClockRef.current;
      const spark = animatedSparkTheme(sparkBase, time);
      const sparkAtTrailAge = (age: number) =>
        animatedSparkTheme(sparkBase, time - age * 1.6);
      const effectPulse =
        sparkBase.effect === "supernova"
          ? 1 + (Math.sin(time * 5.2) + 1) * 0.045
          : sparkBase.effect === "plasma"
            ? 1 + Math.sin(time * 9.4) * 0.025
            : sparkBase.effect === "solar-eclipse"
              ? 1 + Math.sin(time * 4.1) * 0.045
              : sparkBase.effect === "toxic-reactor"
                ? 1 + Math.sin(time * 3.2) * 0.04
                : sparkBase.effect === "neon-lightning"
                  ? 1 + Math.max(0, Math.sin(time * 15)) * 0.035
            : 1;
      const pulse = (1 + Math.sin(time * 5) * 0.025) * effectPulse;
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
        const trailStep = mobileRendering ? 2 : 1;
        for (let i = trail.length - 1; i > 0; i -= trailStep) {
          const a = trail[Math.max(0, i - trailStep)],
            b = trail[i],
            fade = (1 - b.t) ** 1.7,
            trailSpark = sparkAtTrailAge(b.t);
          ctx.strokeStyle = `rgba(${trailSpark.rgb},${fade * layer.alpha})`;
          ctx.lineWidth = Math.max(0.3, pr * layer.width * (1 - b.t) ** 0.85);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // Particles are emitted along that same historical path, not glued to the head.
      for (let i = 0; i < trailParticleCount; i++) {
        const t = (time * 0.85 + i / trailParticleCount) % 1,
          age = t * lifetime;
        const point = sparkTrailRef.current.find((sample) => sample.age >= age);
        if (!point || t < 0.07) continue;
        const spread = Math.sin(i * 8.31) * pr * (0.16 + t * 1.2);
        const x = point.x * w + spread,
          y = py + t * tailLength;
        const r = pr * (0.035 + 0.085 * (1 - t)) * (i % 3 === 0 ? 1.3 : 0.75);
        const fade = (1 - t) ** 1.4;
        const particleSpark = sparkAtTrailAge(t);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
        glow.addColorStop(0, `rgba(${particleSpark.rgb},${fade * 0.65})`);
        glow.addColorStop(1, `rgba(${particleSpark.rgb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade;
        ctx.fillStyle = i % 3 === 0 ? particleSpark.core : particleSpark.rim;
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
      // Signature details for rare sparks use the live body palette, keeping
      // their color and glow synchronized in both gameplay and Customize.
      if (sparkBase.effect && !["rainbow", "aurora", "supernova", "plasma"].includes(sparkBase.effect)) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${spark.rgb},.9)`;
        ctx.fillStyle = `rgba(${spark.rgb},.82)`;
        ctx.shadowColor = `rgb(${spark.rgb})`;
        ctx.shadowBlur = pr * 0.55;
        ctx.lineCap = "round";
        if (sparkBase.effect === "dark-matter" || sparkBase.effect === "cosmic-nebula") {
          const orbit = pr * (sparkBase.effect === "dark-matter" ? 1.55 : 1.8);
          for (let i = 0; i < 4; i++) {
            const angle = time * (sparkBase.effect === "dark-matter" ? -1.4 : 0.9) + i * Math.PI * 0.5;
            ctx.beginPath();
            ctx.arc(px + Math.cos(angle) * orbit, py + Math.sin(angle) * orbit * 0.55, pr * (0.06 + i * 0.012), 0, Math.PI * 2);
            ctx.fill();
          }
          if (sparkBase.effect === "dark-matter") {
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "rgba(7,0,14,.72)";
            ctx.beginPath();
            ctx.arc(px, py, pr * 0.46, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (sparkBase.effect === "solar-eclipse") {
          ctx.lineWidth = pr * 0.08;
          const rays = 10;
          for (let i = 0; i < rays; i++) {
            const angle = time * 0.18 + (i / rays) * Math.PI * 2;
            const inner = pr * 1.28;
            const outer = pr * (1.62 + 0.15 * Math.sin(time * 5 + i));
            ctx.beginPath();
            ctx.moveTo(px + Math.cos(angle) * inner, py + Math.sin(angle) * inner);
            ctx.lineTo(px + Math.cos(angle) * outer, py + Math.sin(angle) * outer);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "rgba(4,1,8,.88)";
          ctx.beginPath();
          ctx.arc(px, py, pr * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (sparkBase.effect === "ice-crystal") {
          const crystalTurn = time * 0.2;
          // Mobile keeps the same silhouette with fewer paths and no large blur.
          const frostSides = mobileRendering ? [0] : [-1, 1];
          const iceShardCount = mobileRendering ? 2 : 4;
          const frostGradient = ctx.createLinearGradient(px, py + pr, px, py + pr * 3.35);
          frostGradient.addColorStop(0, `rgba(${spark.rgb},.62)`);
          frostGradient.addColorStop(0.55, `rgba(${spark.rgb},.24)`);
          frostGradient.addColorStop(1, `rgba(${spark.rgb},0)`);
          ctx.strokeStyle = frostGradient;
          ctx.shadowColor = `rgb(${spark.rgb})`;
          ctx.shadowBlur = mobileRendering ? 0 : pr * 0.5;
          ctx.lineWidth = pr * 0.07;
          for (const side of frostSides) {
            const centerSway = side === 0 ? Math.sin(time * 2.3) * pr * 0.12 : 0;
            ctx.beginPath();
            ctx.moveTo(px + side * pr * 0.32, py + pr * 1.02);
            ctx.bezierCurveTo(
              px + side * pr * 0.48 + centerSway,
              py + pr * 1.55,
              px + side * pr * (0.66 + Math.sin(time * 2.3) * 0.08) - centerSway,
              py + pr * 2.4,
              px + side * pr * 0.92 + centerSway,
              py + pr * 3.28,
            );
            ctx.stroke();
          }

          // Six primary arms with small crystalline branches form a real snow crystal.
          ctx.strokeStyle = `rgba(${spark.rgb},.92)`;
          ctx.lineWidth = pr * 0.065;
          ctx.globalAlpha = 0.9;
          for (let arm = 0; arm < 6; arm++) {
            const angle = crystalTurn + arm * Math.PI / 3;
            const inner = pr * 1.05;
            const outer = pr * 1.82;
            const ax = px + Math.cos(angle) * outer;
            const ay = py + Math.sin(angle) * outer;
            ctx.beginPath();
            ctx.moveTo(px + Math.cos(angle) * inner, py + Math.sin(angle) * inner);
            ctx.lineTo(ax, ay);
            ctx.stroke();
            if (!mobileRendering) {
              for (const branchSide of [-1, 1]) {
                const joint = pr * 1.48;
                const branchAngle = angle + branchSide * 0.48;
                ctx.beginPath();
                ctx.moveTo(px + Math.cos(angle) * joint, py + Math.sin(angle) * joint);
                ctx.lineTo(
                  px + Math.cos(angle) * joint + Math.cos(branchAngle) * pr * 0.34,
                  py + Math.sin(angle) * joint + Math.sin(branchAngle) * pr * 0.34,
                );
                ctx.stroke();
              }
            }
          }

          // Faceted hexagonal glass overlay turns the round pearl into an ice gem.
          ctx.globalCompositeOperation = "source-over";
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(${spark.rgb},.13)`;
          ctx.strokeStyle = "rgba(255,255,255,.78)";
          ctx.lineWidth = pr * 0.045;
          ctx.beginPath();
          for (let corner = 0; corner < 6; corner++) {
            const angle = -Math.PI / 2 + corner * Math.PI / 3;
            const cx = px + Math.cos(angle) * pr * 0.76;
            const cy = py + Math.sin(angle) * pr * 0.76;
            if (corner === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (!mobileRendering) {
            ctx.globalAlpha = 0.42;
            for (let facet = 0; facet < 6; facet++) {
              const angle = -Math.PI / 2 + facet * Math.PI / 3;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(px + Math.cos(angle) * pr * 0.76, py + Math.sin(angle) * pr * 0.76);
              ctx.stroke();
            }
          }

          // Four orbiting diamond shards add depth without expensive particles.
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = `rgb(${spark.rgb})`;
          ctx.shadowBlur = mobileRendering ? 0 : pr * 0.55;
          for (let shard = 0; shard < iceShardCount; shard++) {
            const angle = -time * 0.82 + shard * Math.PI * 2 / iceShardCount;
            const sx = px + Math.cos(angle) * pr * 2.02;
            const sy = py + Math.sin(angle) * pr * 1.08;
            const sr = pr * (0.075 + (shard % 2) * 0.018);
            ctx.globalAlpha = 0.52 + (shard % 2) * 0.22;
            ctx.beginPath();
            ctx.moveTo(sx, sy - sr * 1.8);
            ctx.lineTo(sx + sr, sy);
            ctx.lineTo(sx, sy + sr * 1.8);
            ctx.lineTo(sx - sr, sy);
            ctx.closePath();
            ctx.fill();
          }
        } else if (sparkBase.effect === "tiger-flame") {
          const flamePulse = 0.82 + (Math.sin(time * 7.2) + 1) * 0.09;
          // Layered, tapered fire tongues flow into the normal spark trail.
          const flameGradient = ctx.createLinearGradient(px, py + pr * 0.45, px, py + pr * 3.4);
          flameGradient.addColorStop(0, `rgba(${spark.rgb},.82)`);
          flameGradient.addColorStop(0.45, `rgba(${spark.rgb},.46)`);
          flameGradient.addColorStop(1, `rgba(${spark.rgb},0)`);
          ctx.fillStyle = flameGradient;
          ctx.shadowColor = `rgb(${spark.rgb})`;
          ctx.shadowBlur = pr * 0.72;
          for (let tongue = 0; tongue < 5; tongue++) {
            const offset = (tongue - 2) * pr * 0.23;
            const sway = Math.sin(time * 8.4 + tongue * 1.77) * pr * 0.17;
            const length = pr * (1.75 + (tongue % 3) * 0.42 + Math.sin(time * 6.2 + tongue) * 0.13);
            ctx.beginPath();
            ctx.moveTo(px + offset - pr * 0.15, py + pr * 0.64);
            ctx.bezierCurveTo(
              px + offset - pr * 0.3 + sway,
              py + pr * 1.08,
              px + offset + sway,
              py + length * 0.72,
              px + offset + sway * 1.35,
              py + length,
            );
            ctx.bezierCurveTo(
              px + offset + pr * 0.22 + sway,
              py + length * 0.7,
              px + offset + pr * 0.25,
              py + pr * 1.04,
              px + offset + pr * 0.15,
              py + pr * 0.64,
            );
            ctx.closePath();
            ctx.globalAlpha = flamePulse * (0.7 + (tongue % 2) * 0.18);
            ctx.fill();
          }

          // A broken rotating corona keeps the flame energetic around the head.
          ctx.globalAlpha = 0.72 * flamePulse;
          ctx.strokeStyle = `rgba(${spark.rgb},.92)`;
          ctx.lineWidth = pr * 0.085;
          ctx.setLineDash([pr * 0.46, pr * 0.16]);
          ctx.lineDashOffset = time * pr * 1.45;
          ctx.beginPath();
          ctx.ellipse(px, py, pr * 1.47, pr * 1.25, -0.18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Tiger markings are curved and clipped visually inside the pearl.
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = "rgba(55,8,0,.82)";
          ctx.shadowBlur = 0;
          ctx.lineCap = "round";
          for (let stripe = -1; stripe <= 1; stripe++) {
            const sy = py + stripe * pr * 0.34;
            ctx.lineWidth = pr * (stripe === 0 ? 0.17 : 0.125);
            ctx.beginPath();
            ctx.moveTo(px - pr * 0.67, sy - pr * 0.12);
            ctx.quadraticCurveTo(
              px - pr * 0.05,
              sy + pr * (stripe % 2 === 0 ? 0.26 : -0.25),
              px + pr * 0.58,
              sy + pr * 0.08,
            );
            ctx.stroke();
          }

          // Hot inner ember and a few deterministic sparks finish the flame.
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "#fff3c4";
          ctx.shadowColor = `rgb(${spark.rgb})`;
          ctx.shadowBlur = pr * 0.75;
          ctx.globalAlpha = 0.72 + flamePulse * 0.2;
          ctx.beginPath();
          ctx.arc(px - pr * 0.12, py - pr * 0.16, pr * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgb(${spark.rgb})`;
          for (let ember = 0; ember < 5; ember++) {
            const travel = (time * (0.55 + ember * 0.035) + ember * 0.19) % 1;
            const ex = px + Math.sin(time * 4.1 + ember * 2.3) * pr * (0.65 + travel * 0.85);
            const ey = py + pr * (1.15 + travel * 2.25);
            const er = pr * (0.035 + (1 - travel) * 0.035);
            ctx.globalAlpha = (1 - travel) * 0.72;
            ctx.beginPath();
            ctx.arc(ex, ey, er, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (sparkBase.effect === "neon-lightning") {
          const electricPulse = 0.7 + Math.max(0, Math.sin(time * 14.5)) * 0.3;
          // Broken energy rings make the charge feel contained around the core.
          ctx.globalAlpha = 0.76 * electricPulse;
          ctx.lineWidth = pr * 0.075;
          ctx.setLineDash([pr * 0.32, pr * 0.18]);
          ctx.lineDashOffset = -time * pr * 1.9;
          ctx.beginPath();
          ctx.ellipse(px, py, pr * 1.58, pr * 1.28, time * 0.28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Three irregular, rotating branches replace the old mirrored zigzags.
          ctx.globalAlpha = 0.9 * electricPulse;
          ctx.lineWidth = pr * 0.085;
          for (let branch = 0; branch < 3; branch++) {
            const baseAngle = time * 0.34 + branch * (Math.PI * 2 / 3) - 0.55;
            ctx.beginPath();
            for (let step = 0; step < 5; step++) {
              const radius = pr * (1.12 + step * 0.24);
              const angle = baseAngle + Math.sin(time * 15 + branch * 4.7 + step * 2.2) * 0.13;
              const bx = px + Math.cos(angle) * radius;
              const by = py + Math.sin(angle) * radius;
              if (step === 0) ctx.moveTo(bx, by);
              else ctx.lineTo(bx, by);
            }
            ctx.stroke();
          }

          // A narrow electric filament continues into the normal trail.
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = pr * 0.075;
          ctx.beginPath();
          ctx.moveTo(px, py + pr * 1.14);
          for (let step = 1; step <= 6; step++) {
            const by = py + pr * (1.14 + step * 0.37);
            const bx = px + Math.sin(time * 17 + step * 2.15) * pr * (0.1 + step * 0.035);
            ctx.lineTo(bx, by);
          }
          ctx.stroke();

          // Crisp white-blue heart sells the high-voltage flash without a large bloom.
          ctx.globalAlpha = 0.55 + electricPulse * 0.35;
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = `rgb(${spark.rgb})`;
          ctx.shadowBlur = pr * 0.9;
          ctx.beginPath();
          ctx.arc(px, py, pr * (0.24 + electricPulse * 0.05), 0, Math.PI * 2);
          ctx.fill();
        } else if (sparkBase.effect === "toxic-reactor") {
          for (let i = 0; i < 3; i++) {
            const angle = time * 1.9 + i * Math.PI * 2 / 3;
            ctx.beginPath();
            ctx.arc(px + Math.cos(angle) * pr * 1.55, py + Math.sin(angle) * pr * 1.1, pr * 0.13, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (sparkBase.effect === "silver-comet") {
          const cometPulse = 0.86 + Math.sin(time * 3.6) * 0.08;
          // Three curved ribbons form a clean, layered silver tail.
          for (let ribbon = 0; ribbon < 3; ribbon++) {
            const side = ribbon - 1;
            const tailGradient = ctx.createLinearGradient(
              px,
              py + pr,
              px + side * pr * 1.15,
              py + pr * (3.9 + ribbon * 0.28),
            );
            tailGradient.addColorStop(0, `rgba(${spark.rgb},${0.72 - ribbon * 0.08})`);
            tailGradient.addColorStop(0.48, `rgba(${spark.rgb},${0.28 - ribbon * 0.035})`);
            tailGradient.addColorStop(1, `rgba(${spark.rgb},0)`);
            ctx.strokeStyle = tailGradient;
            ctx.lineWidth = pr * (0.12 - ribbon * 0.018);
            ctx.globalAlpha = cometPulse;
            ctx.beginPath();
            ctx.moveTo(px + side * pr * 0.38, py + pr * 1.02);
            ctx.bezierCurveTo(
              px + side * pr * 0.52,
              py + pr * 1.72,
              px + side * pr * (0.62 + ribbon * 0.16),
              py + pr * 2.72,
              px + side * pr * (0.88 + ribbon * 0.18),
              py + pr * (3.72 + ribbon * 0.28),
            );
            ctx.stroke();
          }

          // A polished orbital highlight gives the head a metallic, premium finish.
          ctx.strokeStyle = `rgba(${spark.rgb},.82)`;
          ctx.shadowColor = `rgb(${spark.rgb})`;
          ctx.shadowBlur = pr * 0.52;
          ctx.lineWidth = pr * 0.07;
          ctx.globalAlpha = 0.88;
          const orbitPhase = time * 0.72;
          ctx.beginPath();
          ctx.ellipse(px, py, pr * 1.48, pr * 0.58, -0.62, orbitPhase, orbitPhase + Math.PI * 1.15);
          ctx.stroke();

          // Small silver fragments travel around the head instead of a single rigid line.
          ctx.fillStyle = "#ffffff";
          for (let shard = 0; shard < 4; shard++) {
            const angle = time * 1.1 + shard * Math.PI * 0.5;
            const sx = px + Math.cos(angle) * pr * (1.45 + shard * 0.08);
            const sy = py + Math.sin(angle) * pr * 0.72;
            const size = pr * (0.045 + (shard % 2) * 0.022);
            ctx.globalAlpha = 0.5 + (shard % 2) * 0.24;
            ctx.fillRect(sx - size, sy - size * 0.34, size * 2, size * 0.68);
          }

          // Moving specular flare across the pearl.
          const shine = time * 1.25;
          ctx.globalAlpha = 0.82;
          ctx.lineWidth = pr * 0.055;
          ctx.strokeStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(shine) * pr * 0.16, py + Math.sin(shine) * pr * 0.16);
          ctx.lineTo(px + Math.cos(shine) * pr * 0.62, py + Math.sin(shine) * pr * 0.62);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
      ctx.restore();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, []);

  const selectedCustomizeSlot = CUSTOMIZE_SLOTS[customizeSelection] ?? CUSTOMIZE_SLOTS[0];
  const selectedCustomizeTheme = selectedCustomizeSlot.theme ?? "cyan";

  return (
    <main
      className={`game-shell${over ? " is-over" : ""}${lobby ? " is-lobby" : ""}`}
      onPointerDown={handleScreenPointerDown}
    >
      <div className="game-backdrop" aria-hidden="true">
        <picture>
          <source
            media="(pointer: coarse)"
            srcSet="/switch-drop-bg-mobile.jpg?v=1"
          />
          <img
            src="/switch-drop-bg-v2.png?v=4"
            alt=""
            draggable={false}
            decoding="async"
            loading="eager"
            fetchPriority="high"
          />
        </picture>
      </div>
      <div className="center-glow" aria-hidden="true" />
      <div className="game-vignette" />
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Switch Drop game field"
      />
      {!lobby && (
        <header className="hud" aria-live="polite">
          <div className="score-block">
            <strong>{score}</strong>
          </div>
        </header>
      )}
      <div className="total-coins" aria-label={`Total coins ${totalCoins}`}>
        <span className="coin-glyph" aria-hidden="true" />
        <strong>{totalCoins}</strong>
      </div>
      {lobby && !over && (
        <>
          <button
            className="lobby-settings"
            type="button"
            aria-label="Settings"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openSettings}
          >
            <img
              className="lobby-settings-icon"
              src="/lobby-settings.png?v=1"
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
            />
          </button>
          <section className="lobby-screen" aria-label="Main menu">
            <h1 className="lobby-title">SWITCH DROP</h1>
            <div
              className="lobby-actions"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                className="lobby-card"
                type="button"
                onClick={openCustomize}
              >
                <img
                  className="lobby-card-icon"
                  src="/lobby-customize.png?v=1"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  decoding="async"
                />
                <b>CUSTOMIZE</b>
              </button>
              <button
                className="lobby-card"
                type="button"
                onClick={openDaily}
              >
                <img
                  className="lobby-card-icon"
                  src="/lobby-daily-bonus.png?v=1"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  decoding="async"
                />
                <b>DAILY BONUS</b>
              </button>
              <button
                className="lobby-card lobby-shop"
                type="button"
                onClick={openShop}
              >
                <img
                  className="lobby-shop-icon"
                  src="/lobby-shop.png?v=1"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  decoding="async"
                />
                <b>SHOP</b>
              </button>
              <button
                className="lobby-test-coins"
                type="button"
                aria-label="Add 10000 test coins"
                onClick={() => {
                  setTotalCoins((current) => {
                    const next = current + 10000;
                    localStorage.setItem("switch-drop-total-coins", String(next));
                    return next;
                  });
                }}
              >
                +10,000 TEST COINS
              </button>
            </div>
            <div className="lobby-start">TAP TO START</div>
          </section>
        </>
      )}
      {settingsOpen && (
        <section
          className="shop-overlay settings-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={settingsPrivacyOpen ? "Privacy policy" : "Settings"}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="settings-panel premium-modal">
            <button
              className="shop-close"
              type="button"
              aria-label="Close settings"
              onClick={closeSettings}
            >
              <img
                src="/shop-close.png?v=1"
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
              />
            </button>
            {!settingsPrivacyOpen ? (
              <>
                <div className="settings-heading premium-heading">
                  <span aria-hidden="true" />
                  <div>
                    <small>SWITCH DROP</small>
                    <h2>SETTINGS</h2>
                  </div>
                  <span aria-hidden="true" />
                </div>
                <div className="settings-options">
                  <button
                    className="settings-toggle-row"
                    type="button"
                    aria-pressed={musicEnabled}
                    onClick={toggleMusic}
                  >
                    <img className="settings-icon" src="/settings-music.png?v=1" alt="" aria-hidden="true" draggable={false} decoding="async" />
                    <strong>MUSIC</strong>
                    <span className={`settings-switch${musicEnabled ? " is-on" : ""}`} aria-hidden="true">
                      <i />
                    </span>
                  </button>
                  <button
                    className="settings-toggle-row"
                    type="button"
                    aria-pressed={soundEnabled}
                    onClick={toggleSound}
                  >
                    <img className="settings-icon" src="/settings-sound.png?v=1" alt="" aria-hidden="true" draggable={false} decoding="async" />
                    <strong>SOUND EFFECTS</strong>
                    <span className={`settings-switch${soundEnabled ? " is-on" : ""}`} aria-hidden="true">
                      <i />
                    </span>
                  </button>
                  <button
                    className="settings-link-row"
                    type="button"
                    onClick={() => setSettingsPrivacyOpen(true)}
                  >
                    <img className="settings-icon" src="/settings-privacy.png?v=1" alt="" aria-hidden="true" draggable={false} decoding="async" />
                    <strong>PRIVACY POLICY</strong>
                  </button>
                  <a
                    className="settings-link-row"
                    href="mailto:ustapisoo@gmail.com?subject=Switch%20Drop%20Support"
                  >
                    <img className="settings-icon" src="/settings-support.png?v=1" alt="" aria-hidden="true" draggable={false} decoding="async" />
                    <strong>SUPPORT</strong>
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="settings-heading premium-heading">
                  <span aria-hidden="true" />
                  <div>
                    <small>SWITCH DROP</small>
                    <h2>PRIVACY POLICY</h2>
                  </div>
                  <span aria-hidden="true" />
                </div>
                <article className="settings-privacy-copy">
                  <p><strong>Last updated: October 4, 2026</strong></p>
                  <p>Switch Drop is designed to be playable without creating an account. Your game progress, settings, selected spark and locally earned coins are stored on your device.</p>
                  <p>We do not currently ask you to provide your name, contacts, photos or precise location. The game does not sell personal information.</p>
                  <p>If purchases or third-party services are enabled in a future release, the policy will be updated to explain what information those services process and why.</p>
                  <p>For privacy questions or support, contact <a href="mailto:ustapisoo@gmail.com">ustapisoo@gmail.com</a>.</p>
                </article>
                <button
                  className="settings-back-button"
                  type="button"
                  onClick={() => setSettingsPrivacyOpen(false)}
                >
                  BACK TO SETTINGS
                </button>
              </>
            )}
          </div>
        </section>
      )}
      {customizeOpen && (
        <section
          className="shop-overlay customize-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Customize spark"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="customize-panel premium-modal">
            <button
              className="shop-close"
              type="button"
              aria-label="Close customize"
              onClick={closeCustomize}
            >
              <img
                src="/shop-close.png?v=1"
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
              />
            </button>
            <div className="customize-heading premium-heading">
              <span aria-hidden="true" />
              <div>
                <small>CHOOSE YOUR SPARK</small>
                <h2>CUSTOMIZE</h2>
              </div>
              <span aria-hidden="true" />
            </div>
            <div
              className={`customize-preview customize-preview--${selectedCustomizeTheme}`}
              style={customizeStyle(selectedCustomizeTheme)}
              aria-label={`${skinLabel(selectedCustomizeTheme)} spark preview`}
            >
              <div className="customize-preview-aura" aria-hidden="true" />
              <img
                className={`customize-preview-spark customize-effect-${selectedCustomizeTheme}`}
                src="/shop-life.png?v=1"
                alt={`${skinLabel(selectedCustomizeTheme)} spark`}
                draggable={false}
                decoding="async"
              />
            </div>
            <div className="customize-grid-shell">
              <div className="customize-grid">
                {CUSTOMIZE_SLOTS.map((slot) => (
                  (() => {
                    const owned =
                      customizeOwned[slot.id - 1] || slot.id === 1;
                    return (
                      <button
                        key={slot.id}
                        style={customizeStyle(slot.theme)}
                        className={`customize-slot${owned ? " is-unlocked" : " is-locked"}${owned && customizeSelection === slot.id - 1 ? " is-selected" : ""}${slot.rare ? " is-rare" : ""}`}
                        type="button"
                        aria-label={
                          owned
                            ? `${skinLabel(slot.theme)} spark`
                            : `Mystery ${slot.rare ? "rare" : "common"} spark, ${slot.price} coins`
                        }
                        onClick={() => handleCustomizeSlot(slot)}
                      >
                        {owned ? (
                          <img
                            className={`customize-slot-spark customize-effect-${slot.theme}`}
                            src="/shop-life.png?v=1"
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            decoding="async"
                          />
                        ) : (
                          <>
                            <strong>?</strong>
                            <span className="customize-price">
                              <span className="customize-coin" aria-hidden="true">
                                C
                              </span>
                              {slot.price}
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })()
                ))}
              </div>
            </div>
            {customizeNotice && (
              <div className="customize-notice" aria-live="polite">
                {customizeNotice}
              </div>
            )}
          </div>
        </section>
      )}
      {shopOpen && (
        <section
          className="shop-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Shop"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="shop-panel premium-modal">
            <button
              className="shop-close"
              type="button"
              aria-label="Close shop"
              onClick={closeShop}
            >
              <img
                src="/shop-close.png?v=1"
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
              />
            </button>
            <div className="shop-heading premium-heading">
              <span aria-hidden="true" />
              <div>
                <small>SWITCH DROP</small>
                <h2>SHOP</h2>
              </div>
              <span aria-hidden="true" />
            </div>
            <div className="shop-products">
              {SHOP_PRODUCTS.map((product) => (
                <button
                  key={product.id}
                  className={`shop-product-card premium-card shop-product-card--${product.tone}`}
                  type="button"
                  data-product-id={product.id}
                  aria-label={`${product.title} ${product.label}, ${product.price}`}
                  onClick={() => handleShopPurchase(product.id)}
                >
                  <span className="shop-product-main">
                    <img
                      className="shop-product-art"
                      src={product.image}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      decoding="async"
                    />
                    <span className="shop-product-copy">
                      <strong>{product.title}</strong>
                      <b>{product.label}</b>
                    </span>
                  </span>
                  <span className="shop-price premium-action">
                    {product.price}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      {dailyOpen && (
        <section
          className="shop-overlay daily-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Daily rewards"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="daily-panel premium-modal">
            <button
              className="shop-close"
              type="button"
              aria-label="Close daily rewards"
              onClick={closeDaily}
            >
              <img
                src="/shop-close.png?v=1"
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
              />
            </button>
            <div className="daily-heading premium-heading">
              <span aria-hidden="true" />
              <div>
                <small>SWITCH DROP</small>
                <h2>DAILY REWARDS</h2>
              </div>
              <span aria-hidden="true" />
            </div>
            <div className="daily-grid">
              {DAILY_REWARDS.map((reward, index) => {
                const day = index + 1;
                const claimed = day <= (dailyStatus?.claimedDay ?? 0);
                const current = day === (dailyStatus?.nextDay ?? 1);
                return (
                  <div
                    className={`daily-day${current ? " is-current" : ""}${claimed ? " is-claimed" : ""}${day === 7 ? " is-jackpot" : ""}`}
                    key={day}
                  >
                    <span>DAY {day}</span>
                    <img
                      src="/shop-coins.png?v=1"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      decoding="async"
                    />
                    <strong>{reward}</strong>
                    {claimed && <small>CLAIMED</small>}
                  </div>
                );
              })}
            </div>
            <button
              className="daily-claim premium-action"
              type="button"
              disabled={
                dailyLoading || Boolean(dailyStatus && !dailyStatus.canClaim)
              }
              onClick={
                dailyError && !dailyStatus
                  ? () => void loadDailyStatus()
                  : () => void claimDailyReward()
              }
            >
              {dailyLoading
                ? "CHECKING..."
                : dailyError && !dailyStatus
                  ? "RETRY"
                  : dailyStatus?.canClaim
                    ? "CLAIM"
                    : `NEXT IN ${formatCountdown(dailyRemaining)}`}
            </button>
            <div className="daily-status" aria-live="polite">
              {dailyError ||
                (dailyStatus?.canClaim
                  ? `DAY ${dailyStatus.nextDay} IS READY`
                  : "COME BACK WHEN THE TIMER ENDS")}
            </div>
          </div>
        </section>
      )}
      {claimedReward && (
        <section
          className="reward-popup-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Reward received"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="reward-popup premium-modal">
            <small>DAY {claimedReward.day} REWARD</small>
            <img
              src="/shop-coins.png?v=1"
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
            />
            <strong>+{claimedReward.amount}</strong>
            <b>COINS</b>
            <button
              className="reward-continue premium-action"
              type="button"
              onClick={closeRewardPopup}
            >
              CONTINUE
            </button>
          </div>
        </section>
      )}
      {!over && !lobby && (
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
      {!over && !lobby && score < 45 && (
        <div className="hint">
          <b>TAP TO SWITCH</b>
          <span className="switch-arrow" aria-hidden="true" />
        </div>
      )}
      {paused && !over && !lobby && (
        <section
          className="pause-screen"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span>PAUSED</span>
          <button type="button" onClick={togglePause}>
            RESUME
          </button>
          <button
            className="pause-lobby-button"
            type="button"
            onClick={enterLobby}
          >
            LOBBY
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
          <button
            className="restart-button"
            type="button"
            onClick={enterLobby}
          >
            <span>RESTART</span>
            <i className="restart-glyph" aria-hidden="true" />
          </button>
        </section>
      )}
    </main>
  );
}
