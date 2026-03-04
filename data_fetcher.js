import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { PLAYER_CONFIG } from "./config.js";

async function getPlayerData(player) {
  const response = await fetch(`https://sync.runescape.wiki/runelite/player/${player}/STANDARD`, {
    "headers": {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.5",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
    },
    "referrer": "https://oldschool.runescape.wiki/",
    "method": "GET",
    "mode": "cors"
  }).then(res => res.json())

  if (response.error) {
    throw new Error(response.error)
  }

  return response
}

async function getHighscoreData(player) {
  try {
    const res = await fetch(`https://secure.runescape.com/m=${PLAYER_CONFIG.ironmanPlayers.includes(player) ? 'hiscore_oldschool_ironman' : 'hiscore_oldschool'}/index_lite.json?player=${player}`);

    if (res.ok) {
      return await res.json();
    } else {
      console.warn(`Failed to fetch highscores for ${player}, status: ${res.status}`)
      return null;
    }
  } catch (error) {
    console.error(`Error fetching highscores for ${player}:`, error);
    return null;
  }
}

mkdirSync("player_data", { recursive: true });

const timeStamp = new Date().toISOString();

await Promise.all(PLAYER_CONFIG.players.map(async (player) => {
  try {
    mkdirSync(`player_data/${player}`, { recursive: true });
    const [data, highscoreData] = await Promise.all([
      getPlayerData(player),
      getHighscoreData(player)
    ]);

    if (highscoreData) {
      data.skills = highscoreData.skills;
      data.activities = highscoreData.activities;
    }

    const fileName = `${player}_${timeStamp}.json`
    writeFileSync(`player_data/${player}/${fileName}`, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error(`Error getting player data for ${player}:`, error)
  }
}));

