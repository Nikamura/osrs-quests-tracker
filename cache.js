import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CACHE_DIR = "cache";
const CACHE_VERSION = 1;

/**
 * Load cache index and validate version
 */
export function loadCacheIndex() {
  const indexPath = path.join(CACHE_DIR, "index.json");
  if (!existsSync(indexPath)) {
    return { version: CACHE_VERSION, players: {} };
  }

  try {
    const data = JSON.parse(readFileSync(indexPath, "utf-8"));
    // Invalidate cache if version mismatch
    if (data.version !== CACHE_VERSION) {
      console.log(`Cache version mismatch (got ${data.version}, expected ${CACHE_VERSION}), rebuilding...`);
      return { version: CACHE_VERSION, players: {} };
    }
    return data;
  } catch (error) {
    console.warn("Failed to load cache index:", error.message);
    return { version: CACHE_VERSION, players: {} };
  }
}

/**
 * Save cache index to disk
 */
export function saveCacheIndex(index) {
  ensureCacheDir();
  const indexPath = path.join(CACHE_DIR, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

/**
 * Load cached data from a specific cache file
 */
export function loadCacheData(filename) {
  const filePath = path.join(CACHE_DIR, filename);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.warn(`Failed to load cache file ${filename}:`, error.message);
    return null;
  }
}

/**
 * Save data to a cache file
 */
export function saveCacheData(filename, data) {
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, filename);
  writeFileSync(filePath, JSON.stringify(data));
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get the latest file for a player from their data directory
 */
export function getLatestFileForPlayer(player) {
  const playerDir = path.join("player_data", player);
  if (!existsSync(playerDir)) {
    return null;
  }

  const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    return null;
  }

  return files.sort().pop();
}

/**
 * Check if a player's cache is still valid (latest file hasn't changed)
 */
export function isPlayerCacheValid(cacheIndex, player) {
  const latestFile = getLatestFileForPlayer(player);
  if (!latestFile) {
    return false;
  }

  const cachedLatest = cacheIndex.players[player]?.latestFile;
  return cachedLatest === latestFile;
}

/**
 * Get all player directories
 */
export function getPlayerList() {
  if (!existsSync("player_data")) {
    return [];
  }
  return readdirSync("player_data").filter(p => !p.startsWith('.'));
}

/**
 * Load ALL player snapshots into memory (bulk load)
 * Returns: { player: { latestFile, latestData, allFiles: [{ filename, data }] } }
 */
export function loadAllPlayerData(players) {
  const result = {};

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json')).sort();

    if (files.length === 0) {
      continue;
    }

    const latestFile = files[files.length - 1];
    const latestPath = path.join(playerDir, latestFile);
    const latestData = JSON.parse(readFileSync(latestPath, "utf-8"));

    // For comparison functions, we only need latest data
    // For charts/achievements, we load all files lazily
    result[player] = {
      latestFile,
      latestData,
      allFiles: files,
      playerDir
    };
  }

  return result;
}

/**
 * Load all snapshot data for a player (for chart/achievement processing)
 */
export function loadAllSnapshotsForPlayer(playerInfo) {
  const { playerDir, allFiles } = playerInfo;
  return allFiles.map(file => {
    const filePath = path.join(playerDir, file);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return { filename: file, data };
  });
}

/**
 * Get files that are newer than the cached latest file
 */
export function getNewFilesForPlayer(playerInfo, cachedLatestFile) {
  const { allFiles } = playerInfo;

  if (!cachedLatestFile) {
    return allFiles;
  }

  const cachedIndex = allFiles.indexOf(cachedLatestFile);
  if (cachedIndex === -1) {
    // Cached file not found, process all
    return allFiles;
  }

  // Return files after the cached one
  return allFiles.slice(cachedIndex);
}

/**
 * Load game metadata (quests, combat achievements, collection log, music tracks)
 */
export function loadGameData() {
  const gameData = {
    quests: null,
    questMetaByName: {},
    knownQuestNames: null,
    questCapeRequiredNames: null,
    combatAchievements: {},
    collectionLog: {},
    musicTracks: {}
  };

  // Load quests
  try {
    const questsJson = readFileSync("game_data/quests.json", "utf-8");
    const quests = JSON.parse(questsJson);
    gameData.quests = quests;
    gameData.questMetaByName = quests.reduce((acc, q) => {
      acc[q.name] = q;
      return acc;
    }, {});
    gameData.knownQuestNames = new Set(quests.map(q => q.name));
    gameData.questCapeRequiredNames = new Set(quests.filter(q => !q.isMiniquest).map(q => q.name));
  } catch (error) {
    console.warn("Failed to load quests data:", error.message);
  }

  // Load combat achievements
  try {
    const combatAchievementsFile = readFileSync("game_data/combat_achievements.json", "utf-8");
    const combatAchievements = JSON.parse(combatAchievementsFile);
    combatAchievements.forEach(achievement => {
      gameData.combatAchievements[achievement.taskId] = achievement;
    });
  } catch (error) {
    console.warn("Failed to load combat achievements data:", error.message);
  }

  // Load collection log
  try {
    const collectionLogFile = readFileSync("game_data/collection_log.json", "utf-8");
    const collectionLogItems = JSON.parse(collectionLogFile);
    collectionLogItems.forEach(item => {
      gameData.collectionLog[item.itemId] = item;
    });
  } catch (error) {
    console.warn("Failed to load collection log data:", error.message);
  }

  // Load music tracks
  try {
    const musicTracksFile = readFileSync("game_data/music_tracks.json", "utf-8");
    const tracks = JSON.parse(musicTracksFile);
    tracks.forEach(track => {
      gameData.musicTracks[track.name] = track;
    });
  } catch (error) {
    console.warn("Failed to load music tracks data:", error.message);
  }

  return gameData;
}
