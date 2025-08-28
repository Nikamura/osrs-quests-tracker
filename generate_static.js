import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import https from "node:https";

function getDisplayName(playerDir) {
  const nameMap = {
    'anime irl': 'Martynas',
    'swamp party': 'Petras',
    'clintonhill': 'Karolis',
    'serasvasalas': 'Mangirdas',
    'juozulis': 'Minvydas',
    'scarycorpse': 'Darius',
    'dedspirit': 'Egle'
  };
  return nameMap[playerDir] || playerDir;
}

function getQuestComparisonData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const latestPlayerData = {};
  const allQuests = new Set();

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    const latestFile = files.sort().pop();
    const filePath = path.join(playerDir, latestFile);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    latestPlayerData[player] = data.quests;
    Object.keys(data.quests).forEach(quest => allQuests.add(quest));
  }

  return {
    players: Object.keys(latestPlayerData).sort(),
    quests: [...allQuests].sort(),
    playerQuests: latestPlayerData
  };
}

function generateQuestComparisonTable(comparisonData) {
  const { players, quests, playerQuests } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare quests.</p>";
  }

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Quest</th>';
  for (const player of players) {
    tableHtml += `<th>${getDisplayName(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const quest of quests) {
    const statuses = players.map(player => playerQuests[player]?.[quest] ?? 0);

    let rowClass = '';
    if (statuses.every(s => s === 2)) {
      rowClass = 'all-completed';
    } else if (statuses.filter(s => s === 2).length === 1) {
      rowClass = 'completed-by-one';
    } else if (statuses.every(s => s === 0)) {
      rowClass = 'not-started-by-any';
    }

    tableHtml += `<tr class="${rowClass}">`;
    tableHtml += `<td>${quest}</td>`;
    for (const status of statuses) {
      let statusClass = 'status-not-started';
      if (status === 1) statusClass = 'status-in-progress';
      if (status === 2) statusClass = 'status-completed';
      tableHtml += `<td class="${statusClass}"></td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function getLevelComparisonData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const latestPlayerData = {};
  const allSkills = new Set();

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    const latestFile = files.sort().pop();
    const filePath = path.join(playerDir, latestFile);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    if (data.levels) {
      latestPlayerData[player] = data.levels;
      Object.keys(data.levels).forEach(skill => allSkills.add(skill));
    }
  }

  return {
    players: Object.keys(latestPlayerData).sort(),
    skills: [...allSkills].sort(),
    playerLevels: latestPlayerData
  };
}

function generateLevelComparisonTable(comparisonData) {
  const { players, skills, playerLevels } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare levels.</p>";
  }

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive level-comparison-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Skill</th>';
  for (const player of players) {
    tableHtml += `<th>${getDisplayName(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const skill of skills) {
    tableHtml += '<tr>';
    tableHtml += `<td>${skill}</td>`;

    // Get all levels for this skill to determine rankings
    const skillLevels = players.map(player => ({
      player,
      level: playerLevels[player]?.[skill] ?? 0
    }));

    // Sort by level (highest first) and assign rankings
    const sortedLevels = [...skillLevels].sort((a, b) => b.level - a.level);
    const rankings = {};
    let currentRank = 1;
    for (let i = 0; i < sortedLevels.length; i++) {
      const { player, level } = sortedLevels[i];
      if (i > 0 && sortedLevels[i - 1].level > level) {
        currentRank = i + 1;
      }
      rankings[player] = currentRank;
    }

    for (const player of players) {
      const level = playerLevels[player]?.[skill] ?? 0;
      let levelClass = 'level-low';
      if (level >= 80) levelClass = 'level-high';
      else if (level >= 50) levelClass = 'level-medium';

      // Add ranking class if level > 0
      let rankingClass = '';
      if (level > 0) {
        const rank = rankings[player];
        if (rank === 1) rankingClass = ' rank-1st';
        else if (rank === 2) rankingClass = ' rank-2nd';
        else if (rank === 3) rankingClass = ' rank-3rd';
      }

      tableHtml += `<td class="level-cell ${levelClass}${rankingClass}" data-player="${player}" data-skill="${skill}" data-level="${level}">${level}</td>`;
    }
    tableHtml += '</tr>';
  }

  // Add total level row
  tableHtml += '<tr style="border-top: 3px solid #000; background-color: #f0f0f0; font-weight: bold;">';
  tableHtml += '<td style="font-weight: bold; font-size: 1.1em;">Total Level</td>';

  // Calculate total levels for each player
  const totalLevels = players.map(player => {
    const total = skills.reduce((sum, skill) => {
      return sum + (playerLevels[player]?.[skill] ?? 0);
    }, 0);
    return { player, total };
  });

  // Sort by total (highest first) and assign rankings
  const sortedTotals = [...totalLevels].sort((a, b) => b.total - a.total);
  const totalRankings = {};
  let currentRank = 1;
  for (let i = 0; i < sortedTotals.length; i++) {
    const { player, total } = sortedTotals[i];
    if (i > 0 && sortedTotals[i - 1].total > total) {
      currentRank = i + 1;
    }
    totalRankings[player] = currentRank;
  }

  for (const player of players) {
    const totalLevel = totalLevels.find(t => t.player === player)?.total ?? 0;
    let levelClass = 'level-low';
    if (totalLevel >= 1600) levelClass = 'level-high';
    else if (totalLevel >= 1000) levelClass = 'level-medium';

    // Add ranking class
    let rankingClass = '';
    if (totalLevel > 0) {
      const rank = totalRankings[player];
      if (rank === 1) rankingClass = ' rank-1st';
      else if (rank === 2) rankingClass = ' rank-2nd';
      else if (rank === 3) rankingClass = ' rank-3rd';
    }

    tableHtml += `<td class="level-cell ${levelClass}${rankingClass}" data-player="${player}" data-skill="Total Level" data-level="${totalLevel}" style="font-size: 1.1em;">${totalLevel}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function getAchievementDiaryComparisonData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const latestPlayerData = {};
  const allAchievements = new Set();

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    const latestFile = files.sort().pop();
    const filePath = path.join(playerDir, latestFile);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    if (data.achievement_diaries) {
      latestPlayerData[player] = data.achievement_diaries;
      Object.keys(data.achievement_diaries).forEach(achievement => allAchievements.add(achievement));
    }
  }

  return {
    players: Object.keys(latestPlayerData).sort(),
    achievements: [...allAchievements].sort(),
    playerAchievements: latestPlayerData
  };
}

function generateAchievementDiaryComparisonTable(comparisonData) {
  const { players, achievements, playerAchievements } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare achievement diaries.</p>";
  }

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Achievement Diary</th>';
  for (const player of players) {
    tableHtml += `<th>${getDisplayName(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const achievement of achievements) {
    tableHtml += `<tr><td colspan="${players.length + 1}" style="background-color: #e0e0e0; font-weight: bold; text-align: center;">${achievement}</td></tr>`;

    // Add rows for each difficulty level
    const difficulties = ['Easy', 'Medium', 'Hard', 'Elite'];
    for (const difficulty of difficulties) {
      const statuses = players.map(player => {
        const playerData = playerAchievements[player]?.[achievement];
        const difficultyData = playerData?.[difficulty];
        if (!difficultyData) {
          return null; // Not started
        }

        if (Array.isArray(difficultyData.tasks) && difficultyData.tasks.length > 0) {
          return difficultyData.tasks.every(task => task);
        }

        return false; // In-progress if tasks array is missing/empty, but entry exists
      });

      let rowClass = '';
      const completedCount = statuses.filter(s => s === true).length;
      if (completedCount === players.length) {
        rowClass = 'diary-complete';
      } else if (completedCount > 0) {
        rowClass = 'diary-partial';
      } else {
        rowClass = 'diary-not-started';
      }

      tableHtml += `<tr class="${rowClass}">`;
      tableHtml += `<td style="padding-left: 20px;">${difficulty}</td>`;

      for (const status of statuses) {
        let statusClass = '';
        let statusText = '';
        if (status === true) {
          statusClass = 'diary-complete';
          statusText = '✓';
        } else if (status === false) {
          statusClass = 'diary-partial';
          statusText = '✗';
        } else {
          statusClass = 'diary-not-started';
          statusText = '-';
        }
        tableHtml += `<td class="${statusClass}" style="text-align: center;">${statusText}</td>`;
      }
      tableHtml += '</tr>';
    }
  }
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function loadCombatAchievementsData() {
  let combatAchievementsData = {};
  try {
    const combatAchievementsFile = readFileSync("game_data/combat_achievements.json", "utf-8");
    const combatAchievements = JSON.parse(combatAchievementsFile);
    combatAchievements.forEach(achievement => {
      combatAchievementsData[achievement.taskId] = achievement;
    });
  } catch (error) {
    console.error('Error loading combat achievements data:', error);
  }
  return combatAchievementsData;
}

function loadCollectionLogData() {
  let collectionLogData = {};
  try {
    const collectionLogFile = readFileSync("game_data/collection_log.json", "utf-8");
    const collectionLogItems = JSON.parse(collectionLogFile);
    collectionLogItems.forEach(item => {
      collectionLogData[item.itemId] = item;
    });
  } catch (error) {
    console.error('Error loading collection log data:', error);
  }
  return collectionLogData;
}

function getCombatAchievementsComparisonData(combatAchievementsData) {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const latestPlayerData = {};

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    const latestFile = files.sort().pop();
    const filePath = path.join(playerDir, latestFile);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    if (data.combat_achievements) {
      latestPlayerData[player] = data.combat_achievements;
    }
  }

  return {
    players: Object.keys(latestPlayerData).sort(),
    playerCombatAchievements: latestPlayerData,
    combatAchievementsData: combatAchievementsData
  };
}

function generateCombatAchievementsComparisonTable(comparisonData) {
  const { players, playerCombatAchievements, combatAchievementsData } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare combat achievements.</p>";
  }

  // Get all available achievements from the metadata and filter for completed ones
  const allAchievements = Object.values(combatAchievementsData).filter(achievement => {
    return players.some(player => {
      const playerAchievements = playerCombatAchievements[player] || [];
      return playerAchievements.includes(parseInt(achievement.taskId));
    });
  });

  // Sort achievements by tier and name
  const sortedAchievements = allAchievements.sort((a, b) => {
    // First sort by tier (Easy, Medium, Hard, Elite, Master, Grandmaster)
    const tierOrder = {
      'Easy (1 pt)': 1,
      'Medium (2 pts)': 2,
      'Hard (3 pts)': 3,
      'Elite (4 pts)': 4,
      'Master (5 pts)': 5,
      'Grandmaster (6 pts)': 6
    };

    const tierA = tierOrder[a.tier] || 999;
    const tierB = tierOrder[b.tier] || 999;

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Then sort by name
    return a.name.localeCompare(b.name);
  });

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive combat-achievements-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th style="width: 50px;">Tier</th><th>Monster</th><th>Achievement</th>';
  for (const player of players) {
    tableHtml += `<th style="width: 80px;">${getDisplayName(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';

  for (const achievement of sortedAchievements) {
    const achievementId = achievement.taskId;
    const statuses = players.map(player => {
      const playerAchievements = playerCombatAchievements[player] || [];
      return playerAchievements.includes(parseInt(achievementId));
    });

    let rowClass = '';
    const completedCount = statuses.filter(s => s === true).length;
    if (completedCount === players.length) {
      rowClass = 'combat-achievement-complete';
    } else if (completedCount > 0) {
      rowClass = 'combat-achievement-partial';
    } else {
      rowClass = 'combat-achievement-none';
    }

    tableHtml += `<tr class="${rowClass}">`;

    // Tier icon
    tableHtml += `<td style="text-align: center;"><img src="${achievement.tierIconUrl}" alt="${achievement.tier}" width="24" height="24" style="image-rendering: pixelated;"></td>`;

    // Monster name with link (if available)
    if (achievement.monster && achievement.monster !== 'N/A' && achievement.monsterWikiLink) {
      tableHtml += `<td><a href="${achievement.monsterWikiLink}" target="_blank" style="text-decoration: none; color: inherit;">${achievement.monster}</a></td>`;
    } else {
      tableHtml += `<td style="color: #666; font-style: italic;">${achievement.monster || 'Various'}</td>`;
    }

    // Achievement name with link
    tableHtml += `<td><a href="${achievement.nameWikiLink}" target="_blank" style="text-decoration: none; color: inherit;" title="${achievement.description}">${achievement.name}</a></td>`;

    // Player columns
    for (const status of statuses) {
      let statusClass = status ? 'combat-achievement-completed' : 'combat-achievement-not-completed';
      let statusText = status ? '✓' : '✗';
      tableHtml += `<td class="${statusClass}" style="text-align: center;">${statusText}</td>`;
    }

    tableHtml += '</tr>';
  }

  // Add total achievements row (sticky at bottom)
  tableHtml += '<tr class="combat-achievements-total-row">';
  tableHtml += '<td></td>';
  tableHtml += '<td></td>';
  tableHtml += '<td style="font-size: 1.1em;">Total Achievements</td>';

  // Calculate total achievements for each player
  const totalAchievements = players.map(player => ({
    player,
    total: playerCombatAchievements[player]?.length ?? 0
  }));

  // Sort by total (highest first) and assign rankings
  const sortedTotals = [...totalAchievements].sort((a, b) => b.total - a.total);
  const totalRankings = {};
  let currentRank = 1;
  for (let i = 0; i < sortedTotals.length; i++) {
    const { player, total } = sortedTotals[i];
    if (i > 0 && sortedTotals[i - 1].total > total) {
      currentRank = i + 1;
    }
    totalRankings[player] = currentRank;
  }

  for (const player of players) {
    const total = totalAchievements.find(t => t.player === player)?.total ?? 0;

    let rankingClass = '';
    if (total > 0) {
      const rank = totalRankings[player];
      if (rank === 1) rankingClass = ' rank-1st';
      else if (rank === 2) rankingClass = ' rank-2nd';
      else if (rank === 3) rankingClass = ' rank-3rd';
    }

    tableHtml += `<td class="level-cell${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function getMusicTracksComparisonData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const latestPlayerData = {};
  const allMusicTracks = new Set();

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    const latestFile = files.sort().pop();
    const filePath = path.join(playerDir, latestFile);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    if (data.music_tracks) {
      latestPlayerData[player] = data.music_tracks;
      Object.keys(data.music_tracks).forEach(track => allMusicTracks.add(track));
    }
  }

  return {
    players: Object.keys(latestPlayerData).sort(),
    musicTracks: [...allMusicTracks].sort(),
    playerMusicTracks: latestPlayerData
  };
}

function generateMusicTracksComparisonTable(comparisonData) {
  const { players, musicTracks, playerMusicTracks } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare music tracks.</p>";
  }

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Music Track</th>';
  for (const player of players) {
    tableHtml += `<th>${getDisplayName(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const track of musicTracks) {
    const statuses = players.map(player => {
      const playerData = playerMusicTracks[player]?.[track];
      return playerData === true;
    });

    let rowClass = '';
    const unlockedCount = statuses.filter(s => s === true).length;
    if (unlockedCount === players.length) {
      rowClass = 'music-track-unlocked';
    } else if (unlockedCount > 0) {
      rowClass = 'diary-partial';
    } else {
      rowClass = 'music-track-locked';
    }

    tableHtml += `<tr class="${rowClass}">`;
    tableHtml += `<td>${track}</td>`;

    for (const status of statuses) {
      let statusClass = '';
      let statusText = '';
      if (status === true) {
        statusClass = 'music-track-unlocked';
        statusText = '✓';
      } else {
        statusClass = 'music-track-locked';
        statusText = '✗';
      }
      tableHtml += `<td class="${statusClass}" style="text-align: center;">${statusText}</td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function getPlayerData() {
  const players = readdirSync("player_data");
  const playerData = {};

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir);
    playerData[player] = [];

    for (const file of files) {
      const filePath = path.join(playerDir, file);
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      const completedQuests = Object.values(data.quests).filter(status => status === 2).length;
      const timestamp = new Date(file.split('_')[1].replace('.json', ''));
      playerData[player].push({
        timestamp,
        completedQuests
      });
    }
    playerData[player].sort((a, b) => a.timestamp - b.timestamp);
  }

  return playerData;
}

function getTotalLevelProgressData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const playerData = {};

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    playerData[player] = [];

    for (const file of files) {
      const filePath = path.join(playerDir, file);
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      const timestamp = new Date(file.split('_')[1].replace('.json', ''));

      // Calculate total level
      let totalLevel = 0;
      if (data.levels) {
        totalLevel = Object.values(data.levels).reduce((sum, level) => sum + (level || 0), 0);
      }

      playerData[player].push({
        timestamp,
        totalLevel
      });
    }
    playerData[player].sort((a, b) => a.timestamp - b.timestamp);
  }

  return playerData;
}

function getSkillLevelProgressData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const playerData = {};
  const allSkills = new Set();

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    playerData[player] = [];

    for (const file of files) {
      const filePath = path.join(playerDir, file);
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      const timestamp = new Date(file.split('_')[1].replace('.json', ''));

      // Store all skill levels for this timestamp
      let skillLevels = {};
      if (data.levels) {
        Object.keys(data.levels).forEach(skill => allSkills.add(skill));
        skillLevels = { ...data.levels };
      }

      playerData[player].push({
        timestamp,
        skillLevels
      });
    }
    playerData[player].sort((a, b) => a.timestamp - b.timestamp);
  }

  return {
    playerData,
    availableSkills: [...allSkills].sort()
  };
}

function generateChartData(playerData) {
  const datasets = [];
  const labels = new Set();
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#E7E9ED', '#7C9989', '#B7D5D4'
  ];
  let colorIndex = 0;

  for (const player in playerData) {
    const data = playerData[player];
    const color = colors[colorIndex % colors.length];
    colorIndex++;

    const formattedData = data.map(d => {
      const formattedTimestamp = d.timestamp.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Vilnius'
      });
      labels.add(formattedTimestamp);
      return { x: formattedTimestamp, y: d.completedQuests };
    });

    datasets.push({
      label: getDisplayName(player),
      data: formattedData,
      borderColor: color,
      backgroundColor: color + '33',
      fill: false,
    });
  }

  return {
    labels: [...labels].sort(),
    datasets
  };
}

function generateTotalLevelChartData(playerData) {
  const datasets = [];
  const labels = new Set();
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#E7E9ED', '#7C9989', '#B7D5D4'
  ];
  let colorIndex = 0;

  for (const player in playerData) {
    const data = playerData[player];
    const color = colors[colorIndex % colors.length];
    colorIndex++;

    const formattedData = data.map(d => {
      const formattedTimestamp = d.timestamp.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Vilnius'
      });
      labels.add(formattedTimestamp);
      return { x: formattedTimestamp, y: d.totalLevel };
    });

    datasets.push({
      label: getDisplayName(player),
      data: formattedData,
      borderColor: color,
      backgroundColor: color + '33',
      fill: false,
    });
  }

  return {
    labels: [...labels].sort(),
    datasets
  };
}

function generateSkillLevelChartData(playerData, selectedSkill) {
  const datasets = [];
  const labels = new Set();
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#E7E9ED', '#7C9989', '#B7D5D4'
  ];
  let colorIndex = 0;

  for (const player in playerData) {
    const data = playerData[player];
    const color = colors[colorIndex % colors.length];
    colorIndex++;

    const formattedData = data.map(d => {
      const formattedTimestamp = d.timestamp.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Vilnius'
      });
      labels.add(formattedTimestamp);
      const skillLevel = d.skillLevels[selectedSkill] || 1;
      return { x: formattedTimestamp, y: skillLevel };
    });

    datasets.push({
      label: getDisplayName(player),
      data: formattedData,
      borderColor: color,
      backgroundColor: color + '33',
      fill: false,
    });
  }

  return {
    labels: [...labels].sort(),
    datasets
  };
}

function getAchievementsData(combatAchievementsData, collectionLogData) {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const allAchievements = [];

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json')).sort();
    if (files.length === 0) continue;

    // Process all files to build complete achievement history
    for (let i = 1; i < files.length; i++) {
      const currentFile = files[i];
      const previousFile = files[i - 1];

      try {
        const currentData = JSON.parse(readFileSync(path.join(playerDir, currentFile), "utf-8"));
        const previousData = JSON.parse(readFileSync(path.join(playerDir, previousFile), "utf-8"));

        const currentTimestamp = new Date(currentFile.split('_')[1].replace('.json', ''));
        const previousTimestamp = new Date(previousFile.split('_')[1].replace('.json', ''));

        // Check for quest completions
        if (currentData.quests && previousData.quests) {
          for (const [questName, currentStatus] of Object.entries(currentData.quests)) {
            const previousStatus = previousData.quests[questName] || 0;
            if (previousStatus !== 2 && currentStatus === 2) {
              allAchievements.push({
                player: player,
                type: 'quest',
                name: questName,
                timestamp: currentTimestamp,
                previousTimestamp: previousTimestamp,
                displayName: getDisplayName(player)
              });
            }
          }
        }

        // Check for achievement diary completions
        if (currentData.achievement_diaries && previousData.achievement_diaries) {
          for (const [diaryName, currentDiary] of Object.entries(currentData.achievement_diaries)) {
            const previousDiary = previousData.achievement_diaries[diaryName];
            if (previousDiary) {
              for (const [difficulty, currentDifficulty] of Object.entries(currentDiary)) {
                if (difficulty !== 'tasks') {
                  const previousDifficulty = previousDiary[difficulty];
                  if (previousDifficulty) {
                    const wasCompleted = Array.isArray(previousDifficulty.tasks) && previousDifficulty.tasks.length > 0 && previousDifficulty.tasks.every(task => task);
                    const isCompleted = Array.isArray(currentDifficulty.tasks) && currentDifficulty.tasks.length > 0 && currentDifficulty.tasks.every(task => task);

                    if (!wasCompleted && isCompleted) {
                      allAchievements.push({
                        player: player,
                        type: 'diary',
                        name: `${diaryName} ${difficulty}`,
                        timestamp: currentTimestamp,
                        previousTimestamp: previousTimestamp,
                        displayName: getDisplayName(player)
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // Check for level increases
        if (currentData.levels && previousData.levels) {
          for (const [skillName, currentLevel] of Object.entries(currentData.levels)) {
            const previousLevel = previousData.levels[skillName] || 1;
            if (currentLevel > previousLevel) {
              allAchievements.push({
                player: player,
                type: 'level',
                name: `${skillName} (${previousLevel} → ${currentLevel})`,
                timestamp: currentTimestamp,
                previousTimestamp: previousTimestamp,
                displayName: getDisplayName(player)
              });
            }
          }
        }

        // Check for combat achievement progress
        if (currentData.combat_achievements && previousData.combat_achievements) {
          const currentAchievements = new Set(currentData.combat_achievements);
          const previousAchievements = new Set(previousData.combat_achievements);

          // Find newly completed achievements
          const newAchievements = [...currentAchievements].filter(id => !previousAchievements.has(id));

          // Add each new achievement as a separate entry
          for (const achievementId of newAchievements) {
            const achievementData = combatAchievementsData[achievementId];
            if (achievementData) {
              allAchievements.push({
                player: player,
                type: 'combat',
                name: achievementData.name,
                tierIconUrl: achievementData.tierIconUrl,
                nameWikiLink: achievementData.nameWikiLink,
                description: achievementData.description,
                timestamp: currentTimestamp,
                previousTimestamp: previousTimestamp,
                displayName: getDisplayName(player)
              });
            }
          }
        }

        // Check for collection log progress
        if (currentData.collectionLogItemCount !== null && previousData.collectionLogItemCount !== null) {
          const currentCount = currentData.collectionLogItemCount;
          const previousCount = previousData.collectionLogItemCount;
          if (currentCount > previousCount) {
            allAchievements.push({
              player: player,
              type: 'collection',
              name: `Collection Log (${previousCount} → ${currentCount} items)`,
              timestamp: currentTimestamp,
              previousTimestamp: previousTimestamp,
              displayName: getDisplayName(player)
            });
          }
        }

        // Check for individual collection log item completions
        if (currentData.collection_log && previousData.collection_log && previousData.collectionLogItemCount !== null) {
          const currentItems = new Set(currentData.collection_log);
          const previousItems = new Set(previousData.collection_log);

          // Find newly obtained items
          const newItems = [...currentItems].filter(itemId => !previousItems.has(itemId));

          // Add each new item as a separate entry
          for (const itemId of newItems) {
            const itemData = collectionLogData[itemId];
            if (itemData) {
              allAchievements.push({
                player: player,
                type: 'collection_item',
                name: itemData.itemName,
                itemIcon: itemData.itemIcon,
                itemLink: itemData.itemLink,
                timestamp: currentTimestamp,
                previousTimestamp: previousTimestamp,
                displayName: getDisplayName(player)
              });
            }
          }
        }

        // Check for league task completions
        if (currentData.league_tasks && previousData.league_tasks) {
          const currentCount = currentData.league_tasks.length;
          const previousCount = previousData.league_tasks.length;
          if (currentCount > previousCount) {
            allAchievements.push({
              player: player,
              type: 'league',
              name: `League Task (${previousCount} → ${currentCount} completed)`,
              timestamp: currentTimestamp,
              previousTimestamp: previousTimestamp,
              displayName: getDisplayName(player)
            });
          }
        }

        // Check for activity score increases
        if (currentData.activities && previousData.activities) {
          const currentActivitiesMap = new Map(currentData.activities.map(a => [a.name, a.score]));
          const previousActivitiesMap = new Map(previousData.activities.map(a => [a.name, a.score]));

          for (const [activityName, currentScore] of currentActivitiesMap) {
            const previousScore = previousActivitiesMap.get(activityName) ?? -1;
            if (currentScore > previousScore) {
              allAchievements.push({
                player: player,
                type: 'activity',
                name: previousScore === -1 ? `${activityName} (Score: ${currentScore})` : `${activityName} (${previousScore} -> ${currentScore})`,
                timestamp: currentTimestamp,
                previousTimestamp: previousTimestamp,
                displayName: getDisplayName(player)
              });
            }
          }
        }

      } catch (error) {
        console.error(`Error processing files for ${player}:`, error);
        continue;
      }
    }
  }

  // Sort achievements by timestamp (most recent first)
  allAchievements.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Filter to show only achievements from the last 30 days by default
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentAchievements = allAchievements.filter(achievement =>
    achievement.timestamp > thirtyDaysAgo
  );

  return recentAchievements;
}

function generateAchievementsTable(achievementsData) {
  if (achievementsData.length === 0) {
    return "<p>No recent achievements found. Check back after more player data is collected!</p>";
  }

  // Generate summary statistics
  const playerStats = {};
  const typeStats = {};
  const playerColors = {
    'anime irl': '#FF6384',
    'swamp party': '#36A2EB',
    'clintonhill': '#FFCE56',
    'serasvasalas': '#4BC0C0',
    'juozulis': '#9966FF',
    'scarycorpse': '#FF9F40',
    'dedspirit': '#C9CBCF'
  };

  for (const achievement of achievementsData) {
    // Player stats
    if (!playerStats[achievement.player]) {
      playerStats[achievement.player] = { count: 0, displayName: achievement.displayName };
    }
    playerStats[achievement.player].count++;

    // Type stats
    if (!typeStats[achievement.type]) {
      typeStats[achievement.type] = 0;
    }
    typeStats[achievement.type]++;
  }

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';

  // Summary section
  tableHtml += '<div style="margin-bottom: 20px;">';
  tableHtml += '<h3>Achievement Summary (Last 30 Days)</h3>';

  // Player summary
  tableHtml += '<div style="display: flex; gap: 20px; margin-bottom: 15px;">';
  tableHtml += '<div><strong>By Player:</strong><br>';
  for (const [player, stats] of Object.entries(playerStats)) {
    tableHtml += `${stats.displayName}: ${stats.count}<br>`;
  }
  tableHtml += '</div>';

  // Type summary
  tableHtml += '<div><strong>By Type:</strong><br>';
  for (const [type, count] of Object.entries(typeStats)) {
    let typeName = type.charAt(0).toUpperCase() + type.slice(1);
    // Special handling for collection_item type
    if (type === 'collection_item') {
      typeName = 'Collection Items';
    }
    if (type === 'activity') {
      typeName = 'Activities';
    }
    tableHtml += `${typeName}: ${count}<br>`;
  }
  tableHtml += '</div>';
  tableHtml += '</div>';

  tableHtml += '</div>';

  // Achievements table
  tableHtml += '<table class="interactive" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Player</th><th>Achievement</th><th>Type</th><th>Date</th></tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const achievement of achievementsData) {
    const timeDiff = achievement.timestamp.getTime() - achievement.previousTimestamp.getTime();
    const playerColor = playerColors[achievement.player] || '#999999';

    let rowStyle = `background-color: ${playerColor}33;`; // 33 for transparency
    if (timeDiff < 1000 * 60 * 60 * 24) { // Less than 24 hours
      rowStyle += ' font-weight: bold;';
    }

    // Format date with hours and minutes in Lithuanian timezone
    const dateWithTime = achievement.timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Vilnius'
    });

    tableHtml += `<tr style="${rowStyle}">`;
    tableHtml += `<td><strong style="color: ${playerColor};">${achievement.displayName}</strong></td>`;

    // Handle combat achievements with tier icons and links
    if (achievement.type === 'combat' && achievement.tierIconUrl && achievement.nameWikiLink) {
      tableHtml += `<td style="display: flex; align-items: center; gap: 8px;">`;
      tableHtml += `<img src="${achievement.tierIconUrl}" alt="Tier" width="20" height="20" style="image-rendering: pixelated;">`;
      tableHtml += `<a href="${achievement.nameWikiLink}" target="_blank" style="text-decoration: none; color: inherit;" title="${achievement.description || ''}">${achievement.name}</a>`;
      tableHtml += `</td>`;
    }
    // Handle collection log items with item icons and links
    else if (achievement.type === 'collection_item' && achievement.itemIcon && achievement.itemLink) {
      tableHtml += `<td style="display: flex; align-items: center; gap: 8px;">`;
      tableHtml += `<img src="${achievement.itemIcon}" alt="${achievement.name}" width="20" height="20" style="image-rendering: pixelated;" onerror="this.src='https://oldschool.runescape.wiki/images/Bank_filler.png'">`;
      tableHtml += `<a href="${achievement.itemLink}" target="_blank" style="text-decoration: none; color: inherit;">${achievement.name}</a>`;
      tableHtml += `</td>`;
    } else if (achievement.type === 'activity' && achievement.activityIcon && achievement.activityLink) {
      tableHtml += `<td style="display: flex; align-items: center; gap: 8px;">`;
      tableHtml += `<img src="${achievement.activityIcon}" alt="${achievement.name}" width="20" height="20" style="image-rendering: pixelated;" onerror="this.src='https://oldschool.runescape.wiki/images/Bank_filler.png'">`;
      tableHtml += `<a href="${achievement.activityLink}" target="_blank" style="text-decoration: none; color: inherit;">${achievement.name}</a>`;
      tableHtml += `</td>`;
    } else {
      tableHtml += `<td>${achievement.name}</td>`;
    }

    let typeDisplayName = achievement.type.charAt(0).toUpperCase() + achievement.type.slice(1);
    // Special handling for collection_item type
    if (achievement.type === 'collection_item') {
      typeDisplayName = 'Collection Item';
    }
    if (achievement.type === 'activity') {
      typeDisplayName = 'Activity';
    }
    tableHtml += `<td>${typeDisplayName}</td>`;
    tableHtml += `<td>${dateWithTime}</td>`;
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function getCollectionLogComparisonData(collectionLogData) {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const latestPlayerData = {};

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    const latestFile = files.sort().pop();
    const filePath = path.join(playerDir, latestFile);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    if (data.collection_log) {
      latestPlayerData[player] = data.collection_log;
    }
  }

  return {
    players: Object.keys(latestPlayerData).sort(),
    playerCollectionLogs: latestPlayerData,
    collectionLogData: collectionLogData,
  };
}

async function generateCollectionLogComparisonTable(comparisonData) {
  const { players, playerCollectionLogs, collectionLogData } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare collection logs.</p>";
  }

  const allItems = Object.values(collectionLogData).filter(item => {
    const itemId = item.itemId;
    return players.some(player =>
      playerCollectionLogs[player] && playerCollectionLogs[player].includes(parseInt(itemId))
    );
  });

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';

  tableHtml += '<table class="interactive collection-log-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr>';
  tableHtml += '<th style="width: 50px;">Icon</th>';
  tableHtml += '<th>Item</th>';
  for (const player of players) {
    tableHtml += `<th style="width: 80px;">${getDisplayName(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';

  for (const item of allItems) {
    const itemId = item.itemId;

    // Calculate how many players have this item
    const playersWithItem = players.filter(player =>
      playerCollectionLogs[player] && playerCollectionLogs[player].includes(parseInt(itemId))
    );

    // Row class based on completion
    let rowClass = '';
    if (playersWithItem.length === players.length) {
      rowClass = 'collection-complete';
    } else if (playersWithItem.length > 0) {
      rowClass = 'collection-partial';
    }

    tableHtml += `<tr class="${rowClass}">`;

    // Item icon
    tableHtml += `<td style="text-align: center;"><img src="${item.itemIcon}" alt="${item.itemName}" width="32" height="32" onerror="this.src='https://oldschool.runescape.wiki/images/Bank_filler.png'" style="image-rendering: pixelated;"></td>`;

    // Item name
    tableHtml += `<td><a href="${item.itemLink}" target="_blank" style="text-decoration: none; color: inherit;">${item.itemName}</a></td>`;

    // Player columns
    for (const player of players) {
      const hasItem = playerCollectionLogs[player] && playerCollectionLogs[player].includes(parseInt(itemId));
      let statusClass = hasItem ? 'collection-has-item' : 'collection-missing-item';
      let statusText = hasItem ? '✓' : '✗';
      tableHtml += `<td class="${statusClass}" style="text-align: center;">${statusText}</td>`;
    }

    tableHtml += '</tr>';
  }

  // Add total items row
  tableHtml += '<tr class="collection-log-total-row">';
  tableHtml += '<td></td>';
  tableHtml += '<td style="font-size: 1.1em;">Total Items</td>';

  // Calculate total items for each player
  const totalItems = players.map(player => ({
    player,
    total: playerCollectionLogs[player]?.length ?? 0
  }));

  // Sort by total (highest first) and assign rankings
  const sortedTotals = [...totalItems].sort((a, b) => b.total - a.total);
  const totalRankings = {};
  let currentRank = 1;
  for (let i = 0; i < sortedTotals.length; i++) {
    const { player, total } = sortedTotals[i];
    if (i > 0 && sortedTotals[i - 1].total > total) {
      currentRank = i + 1;
    }
    totalRankings[player] = currentRank;
  }

  for (const player of players) {
    const total = totalItems.find(t => t.player === player)?.total ?? 0;

    let rankingClass = '';
    if (total > 0) {
      const rank = totalRankings[player];
      if (rank === 1) rankingClass = ' rank-1st';
      else if (rank === 2) rankingClass = ' rank-2nd';
      else if (rank === 3) rankingClass = ' rank-3rd';
    }

    tableHtml += `<td class="level-cell${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function generatePlayerSelectionUI() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  if (players.length === 0) {
    return "<p>No players found.</p>";
  }

  let selectionHtml = '<div class="player-selection" style="margin-bottom: 20px;">';
  selectionHtml += '<h3>Player Selection</h3>';
  selectionHtml += '<div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 10px;">';

  for (const player of players.sort()) {
    const displayName = getDisplayName(player);
    selectionHtml += `
      <label style="display: flex; align-items: center; gap: 5px;" class="player-label">
        <input type="checkbox" id="player-${player}" value="${player}" checked onchange="updatePlayerSelection()">
        <span class="player-name">${displayName}</span>
      </label>
    `;
  }

  selectionHtml += '</div>';
  selectionHtml += '<div style="margin-top: 10px;">';
  selectionHtml += '<button onclick="selectAllPlayers()">Select All</button>';
  selectionHtml += '<button onclick="deselectAllPlayers()" style="margin-left: 10px;">Deselect All</button>';
  selectionHtml += '</div>';
  selectionHtml += '</div>';

  return selectionHtml;
}

function generateWindowVisibilityUI() {
  const windows = [
    { id: 'quest-progress', name: 'Quest Progress', enabled: true },
    { id: 'total-level-progress', name: 'Total Level Progress', enabled: true },
    { id: 'total-exp-progress', name: 'Total XP Progress', enabled: true },
    { id: 'skill-level-progress', name: 'Skill Level Progress', enabled: true },
    { id: 'quest-comparison', name: 'Quest Comparison', enabled: true },
    { id: 'level-comparison', name: 'Level Comparison', enabled: true },
    { id: 'achievement-diaries-comparison', name: 'Achievement Diaries Comparison', enabled: true },
    { id: 'combat-achievements-comparison', name: 'Combat Achievements Comparison', enabled: true },
    { id: 'music-tracks-comparison', name: 'Music Tracks Comparison', enabled: true },
    { id: 'collection-log-comparison', name: 'Collection Log Comparison', enabled: true },
    { id: 'activities-comparison', name: 'Activities Comparison', enabled: true },
    { id: 'recent-achievements--progress', name: 'Recent Achievements & Progress', enabled: true }
  ];

  let visibilityHtml = '<div class="window-visibility" style="margin-bottom: 15px;">';
  visibilityHtml += '<h3>Window Visibility</h3>';
  visibilityHtml += '<div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 10px;">';

  for (const window of windows) {
    visibilityHtml += `
      <label style="display: flex; align-items: center; gap: 5px;" class="window-label">
        <input type="checkbox" id="window-${window.id}" value="${window.id}" ${window.enabled ? 'checked' : ''} onchange="updateWindowVisibility()">
        <span class="window-name">${window.name}</span>
      </label>
    `;
  }

  visibilityHtml += '</div>';
  visibilityHtml += '<div style="margin-top: 10px;">';
  visibilityHtml += '<button onclick="showAllWindows()">Show All</button>';
  visibilityHtml += '<button onclick="hideAllWindows()" style="margin-left: 10px;">Hide All</button>';
  visibilityHtml += '</div>';
  visibilityHtml += '</div>';

  return visibilityHtml;
}

function getTotalExpProgressData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const playerData = {};

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    playerData[player] = [];

    for (const file of files) {
      const filePath = path.join(playerDir, file);
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      const timestamp = new Date(file.split('_')[1].replace('.json', ''));

      let totalExp = 0;
      if (data.skills && Array.isArray(data.skills)) {
        const overallSkill = data.skills.find(s => s.name === 'Overall');
        if (overallSkill) {
          totalExp = overallSkill.xp;
        }
      }

      if (totalExp > 0) {
        playerData[player].push({
          timestamp,
          totalExp
        });
      }
    }
    playerData[player].sort((a, b) => a.timestamp - b.timestamp);
  }

  return playerData;
}

function generateTotalExpChartData(playerData) {
  const datasets = [];
  const labels = new Set();
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#E7E9ED', '#7C9989', '#B7D5D4'
  ];
  let colorIndex = 0;

  for (const player in playerData) {
    const data = playerData[player];
    const color = colors[colorIndex % colors.length];
    colorIndex++;

    const formattedData = data.map(d => {
      const formattedTimestamp = d.timestamp.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Vilnius'
      });
      labels.add(formattedTimestamp);
      return { x: formattedTimestamp, y: d.totalExp };
    });

    datasets.push({
      label: getDisplayName(player),
      data: formattedData,
      borderColor: color,
      backgroundColor: color + '33',
      fill: false,
    });
  }

  return {
    labels: [...labels].sort(),
    datasets
  };
}

function getActivitiesComparisonData() {
  const players = readdirSync("player_data").filter(p => !p.startsWith('.'));
  const latestPlayerData = {};
  const allActivities = new Set();

  for (const player of players) {
    const playerDir = path.join("player_data", player);
    const files = readdirSync(playerDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;

    const latestFile = files.sort().pop();
    const filePath = path.join(playerDir, latestFile);
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    if (data.activities && Array.isArray(data.activities)) {
      const playerActivities = {};
      data.activities.forEach(activity => {
        if (activity.score > -1) {
          playerActivities[activity.name] = activity.score;
          allActivities.add(activity.name);
        }
      });
      latestPlayerData[player] = playerActivities;
    }
  }

  return {
    players: Object.keys(latestPlayerData).sort(),
    activities: [...allActivities].sort(),
    playerActivities: latestPlayerData
  };
}

async function generateActivitiesComparisonTable(comparisonData) {
  const { players, activities, playerActivities } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare activities.</p>";
  }

  let tableHtml = '<div class="sunken-panel" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive activities-comparison-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Activity</th>';
  for (const player of players) {
    tableHtml += `<th>${getDisplayName(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const activity of activities) {
    tableHtml += '<tr>';
    tableHtml += `<td>${activity}</td>`;

    const activityScores = players.map(player => ({
      player,
      score: playerActivities[player]?.[activity] ?? 0
    }));

    const sortedScores = [...activityScores].sort((a, b) => b.score - a.score);
    const rankings = {};
    let currentRank = 1;
    for (let i = 0; i < sortedScores.length; i++) {
      const { player, score } = sortedScores[i];
      if (i > 0 && sortedScores[i - 1].score > score) {
        currentRank = i + 1;
      }
      rankings[player] = currentRank;
    }

    for (const player of players) {
      const score = playerActivities[player]?.[activity] ?? 0;
      let scoreClass = 'level-low'; // reuse level classes for now
      if (score >= 100) scoreClass = 'level-high';
      else if (score >= 10) scoreClass = 'level-medium';

      let rankingClass = '';
      if (score > 0) {
        const rank = rankings[player];
        if (rank === 1) rankingClass = ' rank-1st';
        else if (rank === 2) rankingClass = ' rank-2nd';
        else if (rank === 3) rankingClass = ' rank-3rd';
      }

      tableHtml += `<td class="level-cell ${scoreClass}${rankingClass}" data-player="${player}" data-activity="${activity}" data-score="${score}">${score}</td>`;
    }
    tableHtml += '</tr>';
  }

  // Add total activities row
  tableHtml += '<tr class="activities-total-row">';
  tableHtml += '<td style="font-weight: bold; font-size: 1.1em;">Total Activities</td>';

  // Calculate total activities for each player (sum of all activity scores)
  const totalActivities = players.map(player => ({
    player,
    total: playerActivities[player] ? Object.values(playerActivities[player]).reduce((sum, score) => sum + (score || 0), 0) : 0
  }));

  // Sort by total (highest first) and assign rankings
  const sortedTotals = [...totalActivities].sort((a, b) => b.total - a.total);
  const totalRankings = {};
  let currentRank = 1;
  for (let i = 0; i < sortedTotals.length; i++) {
    const { player, total } = sortedTotals[i];
    if (i > 0 && sortedTotals[i - 1].total > total) {
      currentRank = i + 1;
    }
    totalRankings[player] = currentRank;
  }

  for (const player of players) {
    const total = totalActivities.find(t => t.player === player)?.total ?? 0;

    let rankingClass = '';
    if (total > 0) {
      const rank = totalRankings[player];
      if (rank === 1) rankingClass = ' rank-1st';
      else if (rank === 2) rankingClass = ' rank-2nd';
      else if (rank === 3) rankingClass = ' rank-3rd';
    }

    tableHtml += `<td class="level-cell ${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

async function generateStaticHTML() {
  if (!existsSync('public')) {
    mkdirSync('public');
  }

  console.log('Generating static HTML...');

  try {
    const combatAchievementsData = loadCombatAchievementsData();
    const collectionLogData = loadCollectionLogData();

    const playerData = getPlayerData();
    const chartData = generateChartData(playerData);
    const totalLevelProgressData = getTotalLevelProgressData();
    const totalLevelChartData = generateTotalLevelChartData(totalLevelProgressData);
    const totalExpProgressData = getTotalExpProgressData();
    const totalExpChartData = generateTotalExpChartData(totalExpProgressData);
    const skillLevelProgressData = getSkillLevelProgressData();
    const defaultSkill = skillLevelProgressData.availableSkills[0] || 'Attack';
    const skillLevelChartData = generateSkillLevelChartData(skillLevelProgressData.playerData, defaultSkill);
    const questComparisonData = getQuestComparisonData();
    const questTableHtml = generateQuestComparisonTable(questComparisonData);

    const levelComparisonData = getLevelComparisonData();
    const levelTableHtml = generateLevelComparisonTable(levelComparisonData);

    const achievementDiaryComparisonData = getAchievementDiaryComparisonData();
    const achievementDiaryTableHtml = generateAchievementDiaryComparisonTable(achievementDiaryComparisonData);

    const combatAchievementsComparisonData = getCombatAchievementsComparisonData(combatAchievementsData);
    const combatAchievementsTableHtml = generateCombatAchievementsComparisonTable(combatAchievementsComparisonData);

    const musicTracksComparisonData = getMusicTracksComparisonData();
    const musicTracksTableHtml = generateMusicTracksComparisonTable(musicTracksComparisonData);

    const collectionLogComparisonData = getCollectionLogComparisonData(collectionLogData);
    const collectionLogTableHtml = await generateCollectionLogComparisonTable(collectionLogComparisonData);

    const activitiesComparisonData = getActivitiesComparisonData();
    const activitiesTableHtml = await generateActivitiesComparisonTable(activitiesComparisonData);

    const achievementsData = getAchievementsData(combatAchievementsData, collectionLogData);
    const achievementsTableHtml = generateAchievementsTable(achievementsData);

    const playerSelectionHtml = generatePlayerSelectionUI();
    const windowVisibilityHtml = generateWindowVisibilityUI();

    const generatedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Europe/Vilnius'
    });

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>OSRS Tracker</title>
  <link rel="stylesheet" href="https://unpkg.com/98.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- 100% privacy-first analytics -->
  <script data-collect-dnt="true" async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
  <style>
    /* Loading screen styles */
    .loading-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #008080;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      font-family: 'MS Sans Serif', sans-serif;
    }

    .loading-content {
      text-align: center;
      color: white;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-text {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .loading-subtext {
      font-size: 12px;
      opacity: 0.8;
    }

    /* Hide main content during loading */
    body.loading .container {
      visibility: hidden;
    }

    body.loading .generated-at {
      visibility: hidden;
    }

    tbody tr:not(.all-completed):not(.not-started-by-any):not(.completed-by-one):nth-child(even) { background-color: #ececec; }
    .status-in-progress { background-color: yellow; }
    .status-completed { background-color: lime; }
    tr.all-completed { background-color: #3a8e3a; color: white; font-weight: bold; }
    table.interactive tbody tr.all-completed:hover { background-color: #2a7e2a !important; }
    tr.all-completed td { background-color: inherit !important; }
    tr.not-started-by-any { background-color: #cccccc; }
    tr.completed-by-one { background-color: #a6d8f0; }
    .container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
    }
    .main-window {
      margin: 32px;
      width: 800px;
    }
    .level-cell {
      text-align: center;
      font-weight: bold;
    }
    .level-high { color: #006600; }
    .level-medium { color: #cc6600; }
    .level-low { color: #cc0000; }
    .rank-1st {
      background: linear-gradient(135deg, #ffd700, #ffed4e) !important;
      border: 2px solid #b8860b !important;
      color: #000 !important;
      font-weight: bold !important;
      position: relative;
    }
    .rank-1st::before {
      content: "🥇";
      position: absolute;
      top: -2px;
      right: -2px;
      font-size: 12px;
    }
    .rank-2nd {
      background: linear-gradient(135deg, #c0c0c0, #e8e8e8) !important;
      border: 2px solid #a0a0a0 !important;
      color: #000 !important;
      font-weight: bold !important;
      position: relative;
    }
    .rank-2nd::before {
      content: "🥈";
      position: absolute;
      top: -2px;
      right: -2px;
      font-size: 12px;
    }
    .rank-3rd {
      background: linear-gradient(135deg, #cd7f32, #d4a574) !important;
      border: 2px solid #8b5a2b !important;
      color: #000 !important;
      font-weight: bold !important;
      position: relative;
    }
    .rank-3rd::before {
      content: "🥉";
      position: absolute;
      top: -2px;
      right: -2px;
      font-size: 12px;
    }
    .level-comparison-table thead th {
      position: sticky;
      top: 0;
      background-color: #c0c0c0;
      z-index: 10;
      border-bottom: 2px solid #808080;
    }
    .diary-complete { background-color: #3a8e3a; color: white; font-weight: bold; }
    .diary-partial { background-color: #ffcc00; }
    .diary-not-started { background-color: #cccccc; }
    .music-track-unlocked { background-color: #3a8e3a; color: white; font-weight: bold; }
    .music-track-locked { background-color: #cccccc; }
    .achievement-new { background-color: #ffcc00; font-weight: bold; }
    .achievement-quest { background-color: #4bc0c0; }
    .achievement-level { background-color: #ff9f40; }
    .achievement-diary { background-color: #9966ff; }
    .achievement-music { background-color: #36a2eb; }
    .achievement-combat { background-color: #ff6384; }
    .achievement-collection { background-color: #9966ff; }
    .achievement-collection_item { background-color: #c9cbcf; }
    .achievement-league { background-color: #ff9f40; }
    .achievement-activity { background-color: #b7d5d4; }
    .window.minimized .window-body { display: none; }
    .window.minimized { margin-bottom: 10px; }
    .window.dragging { opacity: 0.5; z-index: 1000; }
    .window { transition: transform 0.2s ease; }
    .title-bar { cursor: grab; }
    .title-bar:active { cursor: grabbing; }
    .container.drag-over { background-color: rgba(255, 255, 255, 0.1); }
    .drop-indicator {
      position: absolute;
      background-color: #00ff00;
      height: 4px;
      width: 100%;
      border-radius: 2px;
      z-index: 999;
      display: none;
    }
    .generated-at {
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 1000;
    }
    .player-label.unselected .player-name {
      text-decoration: line-through;
      color: #888;
      opacity: 0.6;
    }
    .player-label {
      transition: all 0.2s ease;
    }
    .window-label.unselected .window-name {
      text-decoration: line-through;
      color: #888;
      opacity: 0.6;
    }
    .window.hidden {
      display: none !important;
    }
    .collection-log-table thead th {
      position: sticky;
      top: 0;
      background-color: #c0c0c0;
      z-index: 10;
      border-bottom: 2px solid #808080;
    }
    .collection-complete { background-color: #3a8e3a; color: white; font-weight: bold; }
    .collection-partial { background-color: #ffcc00; }
    .collection-has-item { background-color: #3a8e3a; color: white; font-weight: bold; }
    .collection-missing-item { background-color: #cccccc; }
    .collection-log-table .collection-log-total-row td {
      position: sticky;
      bottom: 0;
      background: #f0f0f0;
      font-weight: bold;
      border-top: 3px solid #000;
      z-index: 5;
    }
    .combat-achievements-table thead th {
      position: sticky;
      top: 0;
      background-color: #c0c0c0;
      z-index: 10;
      border-bottom: 2px solid #808080;
    }
    .combat-achievement-complete { background-color: #3a8e3a; color: white; font-weight: bold; }
    .combat-achievement-partial { background-color: inherit; }
    .combat-achievement-none { background-color: inherit; }
    .combat-achievement-completed { background-color: #3a8e3a; color: white; font-weight: bold; }
    .combat-achievement-not-completed { background-color: #cccccc; }
    .combat-achievements-total-row td {
      position: sticky;
      bottom: 0;
      background: #f0f0f0;
      font-weight: bold;
      border-top: 3px solid #000;
      z-index: 5;
    }

    .collection-complete { background-color: #3a8e3a; color: white; font-weight: bold; }
    .collection-partial { background-color: inherit; }
    .collection-none { background-color: inherit; }
    .collection-has-item { background-color: #3a8e3a; color: white; font-weight: bold; }
    .collection-missing-item { background-color: #cccccc; }
    .activities-comparison-table thead th {
      position: sticky;
      top: 0;
      background-color: #c0c0c0;
      z-index: 10;
      border-bottom: 2px solid #808080;
    }

    .activities-comparison-table .activities-total-row td {
      position: sticky;
      bottom: 0;
      background: #f0f0f0;
      font-weight: bold;
      border-top: 3px solid #000;
      z-index: 5;
    }
  </style>
</head>
<body class="loading" style="background-color: #008080;">
  <noscript><img src="https://queue.simpleanalyticscdn.com/noscript.gif?collect-dnt=true" alt="" referrerpolicy="no-referrer-when-downgrade"/></noscript>
  <!-- Loading screen -->
  <div class="loading-screen" id="loadingScreen">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading OSRS Tracker</div>
      <div class="loading-subtext">Initializing windows and applying saved settings...</div>
    </div>
  </div>

  <div class="generated-at">Generated: ${generatedAt}</div>
  <div class="container">
    <div class="window main-window">
      <div class="title-bar">
        <div class="title-bar-text">Configuration</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${playerSelectionHtml}
        ${windowVisibilityHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="quest-progress">
      <div class="title-bar">
        <div class="title-bar-text">Quest Progress</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        <div style="max-width: 800px; max-height: 600px;">
          <canvas id="questChart"></canvas>
        </div>
      </div>
    </div>
    <div class="window main-window" data-window-id="total-level-progress">
      <div class="title-bar">
        <div class="title-bar-text">Total Level Progress</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        <div style="max-width: 800px; max-height: 600px;">
          <canvas id="totalLevelChart"></canvas>
        </div>
      </div>
    </div>
    <div class="window main-window" data-window-id="total-exp-progress">
      <div class="title-bar">
        <div class="title-bar-text">Total XP Progress</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        <div style="max-width: 800px; max-height: 600px;">
          <canvas id="totalExpChart"></canvas>
        </div>
      </div>
    </div>
    <div class="window main-window" data-window-id="skill-level-progress">
      <div class="title-bar">
        <div class="title-bar-text">Skill Level Progress</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        <div style="margin-bottom: 15px;">
          <label for="skillSelect">Select Skill: </label>
          <select id="skillSelect" onchange="updateSkillChart()" style="margin-left: 10px; padding: 5px;">
            ${skillLevelProgressData.availableSkills.map(skill =>
      `<option value="${skill}" ${skill === defaultSkill ? 'selected' : ''}>${skill}</option>`
    ).join('')}
          </select>
        </div>
        <div style="max-width: 800px; max-height: 600px;">
          <canvas id="skillLevelChart"></canvas>
        </div>
      </div>
    </div>
    <div class="window main-window" data-window-id="quest-comparison">
      <div class="title-bar">
        <div class="title-bar-text">Quest Comparison</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${questTableHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="level-comparison">
      <div class="title-bar">
        <div class="title-bar-text">Level Comparison</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${levelTableHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="achievement-diaries-comparison">
      <div class="title-bar">
        <div class="title-bar-text">Achievement Diaries Comparison</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${achievementDiaryTableHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="combat-achievements-comparison">
      <div class="title-bar">
        <div class="title-bar-text">Combat Achievements Comparison</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${combatAchievementsTableHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="music-tracks-comparison">
      <div class="title-bar">
        <div class="title-bar-text">Music Tracks Comparison</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${musicTracksTableHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="collection-log-comparison">
      <div class="title-bar">
        <div class="title-bar-text">Collection Log Comparison</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${collectionLogTableHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="activities-comparison">
      <div class="title-bar">
        <div class="title-bar-text">Activities Comparison</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${activitiesTableHtml}
      </div>
    </div>
    <div class="window main-window" data-window-id="recent-achievements--progress">
      <div class="title-bar">
        <div class="title-bar-text">Recent Achievements & Progress</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
          <button aria-label="Close" onclick="closeWindow(this)"></button>
        </div>
      </div>
      <div class="window-body">
        ${achievementsTableHtml}
      </div>
    </div>
  </div>
  <script>
    // Apply initial states immediately to prevent flashing
    (function() {
      try {
        // Apply window visibility immediately
        const savedWindows = localStorage.getItem('osrs-selected-windows');
        if (savedWindows) {
          const selectedWindows = JSON.parse(savedWindows);
          const allWindows = document.querySelectorAll('.window[data-window-id]');
          allWindows.forEach(function(windowElement) {
            const windowId = windowElement.dataset.windowId;
            if (selectedWindows.indexOf(windowId) === -1) {
              windowElement.classList.add('hidden');
            }
          });
        }

        // Apply minimized states immediately
        const savedStates = JSON.parse(localStorage.getItem('osrs-minimized-windows') || '{}');
        document.querySelectorAll('.window').forEach(function(windowElement) {
          const titleText = windowElement.querySelector('.title-bar-text');
          if (titleText) {
            const windowId = titleText.textContent.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            if (savedStates[windowId]) {
              windowElement.classList.add('minimized');
            }
          }
        });
      } catch (e) {
        // If localStorage fails, continue normally
        console.warn('Failed to apply initial states:', e);
      }
    })();
  </script>
  <script>
    // Store original data for filtering
    let originalChartData = ${JSON.stringify(chartData)};
    let originalTotalLevelChartData = ${JSON.stringify(totalLevelChartData)};
    let originalTotalExpChartData = ${JSON.stringify(totalExpChartData)};
    let originalSkillLevelProgressData = ${JSON.stringify(skillLevelProgressData)};
    let originalSkillLevelChartData = ${JSON.stringify(skillLevelChartData)};
    let questChart = null;
    let totalLevelChart = null;
    let totalExpChart = null;
    let skillLevelChart = null;

    // Player filtering functions
    function getSelectedPlayers() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="player-"]:checked');
      return Array.from(checkboxes).map(cb => cb.value);
    }

    function updatePlayerVisualIndicators() {
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="player-"]');
      allCheckboxes.forEach(checkbox => {
        const label = checkbox.closest('.player-label');
        if (label) {
          if (checkbox.checked) {
            label.classList.remove('unselected');
          } else {
            label.classList.add('unselected');
          }
        }
      });
    }

        function updatePlayerSelection() {
      const selectedPlayers = getSelectedPlayers();

      // Update visual indicators
      updatePlayerVisualIndicators();

      // Update charts
      updateChart(selectedPlayers);
      updateTotalLevelChart(selectedPlayers);
      updateTotalExpChart(selectedPlayers);
      updateSkillLevelChart(selectedPlayers);

      // Update all tables
      updateQuestTable(selectedPlayers);
      updateLevelTable(selectedPlayers);
      updateDiaryTable(selectedPlayers);
      updateCombatAchievementsTable(selectedPlayers);
      updateMusicTable(selectedPlayers);
      updateCollectionLogTable(selectedPlayers);
      updateAchievementsTable(selectedPlayers);
      updateActivitiesTable(selectedPlayers);

      // Save selection state
      savePlayerSelection(selectedPlayers);
    }

    // Window visibility functions
    function getSelectedWindows() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="window-"]:checked');
      return Array.from(checkboxes).map(cb => cb.value);
    }

    function updateWindowVisualIndicators() {
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="window-"]');
      allCheckboxes.forEach(checkbox => {
        const label = checkbox.closest('.window-label');
        if (label) {
          if (checkbox.checked) {
            label.classList.remove('unselected');
          } else {
            label.classList.add('unselected');
          }
        }
      });
    }

    function updateWindowVisibility() {
      const selectedWindows = getSelectedWindows();

      // Update visual indicators
      updateWindowVisualIndicators();

      // Show/hide windows based on selection
      const allWindows = document.querySelectorAll('.window[data-window-id]');
      allWindows.forEach(windowElement => {
        const windowId = windowElement.dataset.windowId;
        if (selectedWindows.includes(windowId)) {
          windowElement.classList.remove('hidden');
        } else {
          windowElement.classList.add('hidden');
        }
      });

      // Save selection state
      saveWindowVisibility(selectedWindows);
    }

    function showAllWindows() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="window-"]');
      checkboxes.forEach(cb => cb.checked = true);
      updateWindowVisibility();
    }

    function hideAllWindows() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="window-"]');
      checkboxes.forEach(cb => cb.checked = false);
      updateWindowVisibility();
    }

    function saveWindowVisibility(selectedWindows) {
      localStorage.setItem('osrs-selected-windows', JSON.stringify(selectedWindows));
    }

    function loadWindowVisibility() {
      const saved = localStorage.getItem('osrs-selected-windows');
      if (saved) {
        const selectedWindows = JSON.parse(saved);
        const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="window-"]');
        checkboxes.forEach(cb => {
          cb.checked = selectedWindows.includes(cb.value);
        });
        updateWindowVisibility();
      } else {
        // If no saved state, just update visual indicators for initial state
        updateWindowVisualIndicators();
      }
    }

    // Apply initial window states from localStorage before DOM is fully loaded
    function applyInitialStates() {
      // Apply window visibility immediately
      const savedWindows = localStorage.getItem('osrs-selected-windows');
      if (savedWindows) {
        const selectedWindows = JSON.parse(savedWindows);
        const allWindows = document.querySelectorAll('.window[data-window-id]');
        allWindows.forEach(windowElement => {
          const windowId = windowElement.dataset.windowId;
          if (!selectedWindows.includes(windowId)) {
            windowElement.classList.add('hidden');
          }
        });
      }

      // Apply minimized states immediately
      const savedStates = JSON.parse(localStorage.getItem('osrs-minimized-windows') || '{}');
      document.querySelectorAll('.window').forEach(windowElement => {
        const titleText = windowElement.querySelector('.title-bar-text');
        if (titleText) {
          const windowId = titleText.textContent.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          if (savedStates[windowId]) {
            windowElement.classList.add('minimized');
          }
        }
      });
    }

    function selectAllPlayers() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="player-"]');
      checkboxes.forEach(cb => cb.checked = true);
      updatePlayerSelection();
    }

    function deselectAllPlayers() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="player-"]');
      checkboxes.forEach(cb => cb.checked = false);
      updatePlayerSelection();
    }

    function savePlayerSelection(selectedPlayers) {
      localStorage.setItem('osrs-selected-players', JSON.stringify(selectedPlayers));
    }

    function loadPlayerSelection() {
      const saved = localStorage.getItem('osrs-selected-players');
      if (saved) {
        const selectedPlayers = JSON.parse(saved);
        const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="player-"]');
        checkboxes.forEach(cb => {
          cb.checked = selectedPlayers.includes(cb.value);
        });
        updatePlayerSelection();
      } else {
        // If no saved state, just update visual indicators for initial state
        updatePlayerVisualIndicators();
      }
    }

    function updateChart(selectedPlayers) {
      if (!questChart) return;

      // Create mapping objects
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      // Filter datasets to only show selected players
      const filteredDatasets = originalChartData.datasets.filter(dataset => {
        // Find the player key that matches this dataset label
        const playerKey = displayToPlayer[dataset.label];
        return playerKey && selectedPlayers.includes(playerKey);
      });

      questChart.data.datasets = filteredDatasets;
      questChart.update();
    }

    function updateTotalLevelChart(selectedPlayers) {
      if (!totalLevelChart) return;

      // Create mapping objects
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      // Filter datasets to only show selected players
      const filteredDatasets = originalTotalLevelChartData.datasets.filter(dataset => {
        // Find the player key that matches this dataset label
        const playerKey = displayToPlayer[dataset.label];
        return playerKey && selectedPlayers.includes(playerKey);
      });

      totalLevelChart.data.datasets = filteredDatasets;
      totalLevelChart.update();
    }

    function updateTotalExpChart(selectedPlayers) {
      if (!totalExpChart) return;

      // Create mapping objects
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      // Filter datasets to only show selected players
      const filteredDatasets = originalTotalExpChartData.datasets.filter(dataset => {
        // Find the player key that matches this dataset label
        const playerKey = displayToPlayer[dataset.label];
        return playerKey && selectedPlayers.includes(playerKey);
      });

      totalExpChart.data.datasets = filteredDatasets;
      totalExpChart.update();
    }

    function updateSkillLevelChart(selectedPlayers) {
      if (!skillLevelChart) return;

      // Get the currently selected skill
      const skillSelect = document.getElementById('skillSelect');
      const selectedSkill = skillSelect ? skillSelect.value : originalSkillLevelProgressData.availableSkills[0];

      // Generate new chart data for the selected skill and players
      const filteredPlayerData = {};
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      // Filter player data to only include selected players
      for (const [player, data] of Object.entries(originalSkillLevelProgressData.playerData)) {
        if (selectedPlayers.includes(player)) {
          filteredPlayerData[player] = data;
        }
      }

      // Generate new chart data
      const newChartData = generateSkillLevelChartDataJS(filteredPlayerData, selectedSkill);
      skillLevelChart.data.datasets = newChartData.datasets;
      skillLevelChart.update();
    }

    function updateSkillChart() {
      const selectedPlayers = getSelectedPlayers();
      updateSkillLevelChart(selectedPlayers);
    }

    // JavaScript version of generateSkillLevelChartData for client-side updates
    function generateSkillLevelChartDataJS(playerData, selectedSkill) {
      const datasets = [];
      const labels = new Set();
      const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#C9CBCF', '#E7E9ED', '#7C9989', '#B7D5D4'
      ];
      let colorIndex = 0;

      const displayNames = {
        'anime irl': 'Martynas',
        'swamp party': 'Petras',
        'clintonhill': 'Karolis',
        'serasvasalas': 'Mangirdas',
        'juozulis': 'Minvydas',
        'scarycorpse': 'Darius',
        'dedspirit': 'Egle'
      };

      for (const player in playerData) {
        const data = playerData[player];
        const color = colors[colorIndex % colors.length];
        colorIndex++;

        const formattedData = data.map(d => {
          const timestamp = new Date(d.timestamp);
          const formattedTimestamp = timestamp.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Europe/Vilnius'
          });
          labels.add(formattedTimestamp);
          const skillLevel = d.skillLevels[selectedSkill] || 1;
          return { x: formattedTimestamp, y: skillLevel };
        });

        datasets.push({
          label: displayNames[player] || player,
          data: formattedData,
          borderColor: color,
          backgroundColor: color + '33',
          fill: false,
        });
      }

      return {
        labels: [...labels].sort(),
        datasets
      };
    }

    function updateQuestTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Quest Comparison')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      updateTable(table, selectedPlayers, 'quest');
    }

    function updateLevelTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Level Comparison')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      updateTable(table, selectedPlayers, 'level');
      updateLevelRankings(table, selectedPlayers);
    }

        function updateLevelRankings(table, selectedPlayers) {
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      // Get all rows (skills)
      const bodyRows = table.querySelectorAll('tbody tr');

      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return;

        // Skip the first cell (skill name)
        const levelCells = Array.from(cells).slice(1);

        // Check if this is the Total Level row
        const firstCell = cells[0];
        const isTotalLevelRow = firstCell && firstCell.textContent.trim() === 'Total Level';

        // Get levels for selected players only
        const selectedLevels = [];
        levelCells.forEach((cell, index) => {
          const playerData = cell.dataset.player;
          const level = parseInt(cell.dataset.level) || 0;

          if (playerData && selectedPlayers.includes(playerData)) {
            selectedLevels.push({
              cell: cell,
              player: playerData,
              level: level,
              index: index
            });
          }
        });

        // For Total Level row, recalculate totals based on selected players
        if (isTotalLevelRow) {
          // Recalculate total levels for selected players only
          selectedLevels.forEach(({ cell, player }) => {
            // Get all skill rows (excluding total level row)
            const skillRows = Array.from(bodyRows).filter(r => {
              const firstCellText = r.querySelector('td')?.textContent?.trim();
              return firstCellText && firstCellText !== 'Total Level';
            });

            let newTotal = 0;
            skillRows.forEach(skillRow => {
              const skillCells = skillRow.querySelectorAll('td');
              const playerCell = Array.from(skillCells).find(c =>
                c.dataset.player === player && skillRow.style.display !== 'none'
              );
              if (playerCell && playerCell.style.display !== 'none') {
                newTotal += parseInt(playerCell.dataset.level) || 0;
              }
            });

            // Update the cell's data and display
            cell.dataset.level = newTotal.toString();
            cell.textContent = newTotal.toString();
          });

          // Update selectedLevels array with new totals
          selectedLevels.forEach(item => {
            item.level = parseInt(item.cell.dataset.level) || 0;
          });
        }

        // Sort by level (highest first) and assign rankings
        const sortedLevels = [...selectedLevels].sort((a, b) => b.level - a.level);
        const rankings = {};
        let currentRank = 1;

        for (let i = 0; i < sortedLevels.length; i++) {
          const { player, level } = sortedLevels[i];
          if (i > 0 && sortedLevels[i - 1].level > level) {
            currentRank = i + 1;
          }
          rankings[player] = currentRank;
        }

        // Clear all ranking classes first
        levelCells.forEach(cell => {
          cell.classList.remove('rank-1st', 'rank-2nd', 'rank-3rd');
        });

        // Apply ranking classes to selected players only
        selectedLevels.forEach(({ cell, player, level }) => {
          if (level > 0) {
            const rank = rankings[player];
            if (rank === 1) cell.classList.add('rank-1st');
            else if (rank === 2) cell.classList.add('rank-2nd');
            else if (rank === 3) cell.classList.add('rank-3rd');
          }
        });
      });
    }

    function updateDiaryTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Achievement Diaries')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      updateTable(table, selectedPlayers, 'diary');
    }

    function updateCombatAchievementsTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Combat Achievements')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      updateCombatAchievementsTableContent(table, selectedPlayers);
      updateCombatAchievementsRankings(table, selectedPlayers);
    }

    function updateMusicTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Music Tracks')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      updateTable(table, selectedPlayers, 'music');
    }

    function updateCollectionLogTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Collection Log')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      updateCollectionLogTableContent(table, selectedPlayers);
      updateCollectionLogRankings(table, selectedPlayers);
    }

    function updateCollectionLogTableContent(table, selectedPlayers) {
      const headerRow = table.querySelector('thead tr');
      const bodyRows = table.querySelectorAll('tbody tr');

      if (!headerRow) return;

      // Get all header cells (skip first 2 cells: icon, item)
      const headerCells = headerRow.querySelectorAll('th');
      const playerHeaders = Array.from(headerCells).slice(2); // All remaining columns are player columns

      // Create mapping of column indices to show/hide
      const columnsToShow = [0, 1]; // Always show icon, item columns
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      // Track which player columns are selected
      const selectedPlayerIndices = [];
      playerHeaders.forEach((header, index) => {
        const displayName = header.textContent;
        const playerKey = displayToPlayer[displayName];

        if (playerKey && selectedPlayers.includes(playerKey)) {
          columnsToShow.push(index + 2); // +2 for icon, item columns
          selectedPlayerIndices.push(index + 2);
          header.style.display = '';
        } else {
          header.style.display = 'none';
        }
      });



      // Update body rows
      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');

        if (!row.classList.contains('collection-log-total-row')) {
          // Check if any selected player has this item
          let anySelectedPlayerHasItem = false;
          selectedPlayerIndices.forEach(playerIndex => {
            if (cells[playerIndex] && cells[playerIndex].textContent.trim() === '✓') {
              anySelectedPlayerHasItem = true;
            }
          });

          // Hide the entire row if no selected player has this item and players are selected
          if (!anySelectedPlayerHasItem && selectedPlayers.length > 0) {
            row.style.display = 'none';
          } else {
            row.style.display = '';
          }
        }

        // Show/hide individual cells
        cells.forEach((cell, index) => {
          if (columnsToShow.includes(index)) {
            cell.style.display = '';
          } else {
            cell.style.display = 'none';
          }
        });
      });
    }

    function updateCombatAchievementsTableContent(table, selectedPlayers) {
      const headerRow = table.querySelector('thead tr');
      const bodyRows = table.querySelectorAll('tbody tr');

      if (!headerRow) return;

      // Get all header cells (skip first 3 cells: tier icon, monster, achievement name)
      const headerCells = headerRow.querySelectorAll('th');
      const playerHeaders = Array.from(headerCells).slice(3); // All remaining columns are player columns

      // Create mapping of column indices to show/hide
      const columnsToShow = [0, 1, 2]; // Always show tier icon, monster, achievement name columns
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      // Track which player columns are selected
      const selectedPlayerIndices = [];
      playerHeaders.forEach((header, index) => {
        const displayName = header.textContent;
        const playerKey = displayToPlayer[displayName];

        if (playerKey && selectedPlayers.includes(playerKey)) {
          columnsToShow.push(index + 3); // +3 for tier icon, monster, achievement name columns
          selectedPlayerIndices.push(index + 3);
          header.style.display = '';
        } else {
          header.style.display = 'none';
        }
      });

      // Update body rows
      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');

        // Skip total row from filtering logic
        if (!row.classList.contains('combat-achievements-total-row')) {
          // Check if any selected player has this achievement
          let anySelectedPlayerHasAchievement = false;
          selectedPlayerIndices.forEach(playerIndex => {
            if (cells[playerIndex] && cells[playerIndex].textContent.trim() === '✓') {
              anySelectedPlayerHasAchievement = true;
            }
          });

          // Hide the row if no selected player has the achievement
          if (!anySelectedPlayerHasAchievement && selectedPlayers.length > 0) {
            row.style.display = 'none';
          } else {
            row.style.display = '';
          }
        }

        // Show/hide individual cells
        cells.forEach((cell, index) => {
          if (columnsToShow.includes(index)) {
            cell.style.display = '';
          } else {
            cell.style.display = 'none';
          }
        });
      });
    }

    function updateCombatAchievementsRankings(table, selectedPlayers) {
      // The total row is the last one in tbody
      const totalRow = table.querySelector('tbody tr:last-child');
      if (!totalRow || !totalRow.classList.contains('combat-achievements-total-row')) return;

      const cells = totalRow.querySelectorAll('td');
      if (cells.length < 4) return; // need at least tier, monster, name, and one player

      // Skip the first three cells (tier, monster, Total Achievements)
      const totalCells = Array.from(cells).slice(3);

      // Get totals for selected players only
      const selectedTotals = [];
      totalCells.forEach(cell => {
        const playerData = cell.dataset.player;
        if (!playerData) return;
        const total = parseInt(cell.dataset.total) || 0;

        if (selectedPlayers.includes(playerData)) {
          selectedTotals.push({
            cell: cell,
            player: playerData,
            total: total,
          });
        }
      });

      // Sort by total (highest first) and assign rankings
      const sortedTotals = [...selectedTotals].sort((a, b) => b.total - a.total);
      const rankings = {};
      let currentRank = 1;

      for (let i = 0; i < sortedTotals.length; i++) {
        const { player, total } = sortedTotals[i];
        if (i > 0 && sortedTotals[i - 1].total > total) {
          currentRank = i + 1;
        }
        rankings[player] = currentRank;
      }

      // Clear all ranking classes first
      totalCells.forEach(cell => {
        cell.classList.remove('rank-1st', 'rank-2nd', 'rank-3rd');
      });

      // Apply ranking classes to selected players only
      selectedTotals.forEach(({ cell, player, total }) => {
        if (total > 0) {
          const rank = rankings[player];
          if (rank === 1) cell.classList.add('rank-1st');
          else if (rank === 2) cell.classList.add('rank-2nd');
          else if (rank === 3) cell.classList.add('rank-3rd');
        }
      });
    }

    function updateCollectionLogRankings(table, selectedPlayers) {
      // The total row is the last one in tbody
      const totalRow = table.querySelector('tbody tr:last-child');
      if (!totalRow || !totalRow.classList.contains('collection-log-total-row')) return;

      const cells = totalRow.querySelectorAll('td');
      if (cells.length < 3) return; // need at least icon, name, and one player

      // Skip the first two cells (icon, Total Items)
      const totalCells = Array.from(cells).slice(2);

      // Get totals for selected players only
      const selectedTotals = [];
      totalCells.forEach(cell => {
        const playerData = cell.dataset.player;
        if (!playerData) return;
        const total = parseInt(cell.dataset.total) || 0;

        if (selectedPlayers.includes(playerData)) {
          selectedTotals.push({
            cell: cell,
            player: playerData,
            total: total,
          });
        }
      });

      // Sort by total (highest first) and assign rankings
      const sortedTotals = [...selectedTotals].sort((a, b) => b.total - a.total);
      const rankings = {};
      let currentRank = 1;

      for (let i = 0; i < sortedTotals.length; i++) {
        const { player, total } = sortedTotals[i];
        if (i > 0 && sortedTotals[i - 1].total > total) {
          currentRank = i + 1;
        }
        rankings[player] = currentRank;
      }

      // Clear all ranking classes first
      totalCells.forEach(cell => {
        cell.classList.remove('rank-1st', 'rank-2nd', 'rank-3rd');
      });

      // Apply ranking classes to selected players only
      selectedTotals.forEach(({ cell, player, total }) => {
        if (total > 0) {
          const rank = rankings[player];
          if (rank === 1) cell.classList.add('rank-1st');
          else if (rank === 2) cell.classList.add('rank-2nd');
          else if (rank === 3) cell.classList.add('rank-3rd');
        }
      });
    }

    function updateAchievementsTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Recent Achievements')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      // For achievements table, filter rows by selected players
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const playerCell = row.querySelector('td:first-child strong');
        if (playerCell) {
          const playerName = playerCell.textContent;
          // Create mapping object
          const displayToPlayer = {
            'Martynas': 'anime irl',
            'Petras': 'swamp party',
            'Karolis': 'clintonhill',
            'Mangirdas': 'serasvasalas',
            'Minvydas': 'juozulis',
            'Darius': 'scarycorpse',
            'Egle': 'dedspirit'
          };

          const playerKey = displayToPlayer[playerName];
          if (playerKey && selectedPlayers.includes(playerKey)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        }
      });
    }

    function updateActivitiesTable(selectedPlayers) {
      const windows = document.querySelectorAll('.window');
      let table = null;
      for (const window of windows) {
        const titleText = window.querySelector('.title-bar-text');
        if (titleText && titleText.textContent.includes('Activities Comparison')) {
          table = window.querySelector('table');
          break;
        }
      }
      if (!table) return;

      updateTable(table, selectedPlayers, 'activity');
      updateActivityRankings(table, selectedPlayers);
    }

    function updateActivityRankings(table, selectedPlayers) {
      const bodyRows = table.querySelectorAll('tbody tr');

      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return;

        const scoreCells = Array.from(cells).slice(1);

        const selectedScores = [];
        scoreCells.forEach((cell, index) => {
          const playerData = cell.dataset.player;
          // Handle both data-score and data-total attributes
          const score = parseInt(cell.dataset.score || cell.dataset.total) || 0;

          if (playerData && selectedPlayers.includes(playerData)) {
            selectedScores.push({
              cell: cell,
              player: playerData,
              score: score,
            });
          }
        });

        const sortedScores = [...selectedScores].sort((a, b) => b.score - a.score);
        const rankings = {};
        let currentRank = 1;

        for (let i = 0; i < sortedScores.length; i++) {
          const { player, score } = sortedScores[i];
          if (i > 0 && sortedScores[i - 1].score > score) {
            currentRank = i + 1;
          }
          rankings[player] = currentRank;
        }

        scoreCells.forEach(cell => {
          cell.classList.remove('rank-1st', 'rank-2nd', 'rank-3rd');
        });

        selectedScores.forEach(({ cell, player, score }) => {
          if (score > 0) {
            const rank = rankings[player];
            if (rank === 1) cell.classList.add('rank-1st');
            else if (rank === 2) cell.classList.add('rank-2nd');
            else if (rank === 3) cell.classList.add('rank-3rd');
          }
        });
      });
    }

    function updateTable(table, selectedPlayers, tableType) {
      const headerRow = table.querySelector('thead tr');
      const bodyRows = table.querySelectorAll('tbody tr');

      if (!headerRow) return;

      // Get all header cells (skip first cell which is the item name)
      const headerCells = headerRow.querySelectorAll('th');
      const playerHeaders = Array.from(headerCells).slice(1);

      // Create mapping of column indices to show/hide
      const columnsToShow = [0]; // Always show first column (item name)
      const displayToPlayer = {
        'Martynas': 'anime irl',
        'Petras': 'swamp party',
        'Karolis': 'clintonhill',
        'Mangirdas': 'serasvasalas',
        'Minvydas': 'juozulis',
        'Darius': 'scarycorpse',
        'Egle': 'dedspirit'
      };

      playerHeaders.forEach((header, index) => {
        const displayName = header.textContent;
        const playerKey = displayToPlayer[displayName];

        if (playerKey && selectedPlayers.includes(playerKey)) {
          columnsToShow.push(index + 1);
          header.style.display = '';
        } else {
          header.style.display = 'none';
        }
      });

      // Update body rows
      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
          if (columnsToShow.includes(index)) {
            cell.style.display = '';
          } else {
            cell.style.display = 'none';
          }
        });

        // For achievement diary tables, handle special formatting
        if (tableType === 'diary' && row.querySelector('td[colspan]')) {
          // This is a section header row, always show it
          row.style.display = '';
        }
      });
    }

    // Get window ID from title text
    function getWindowId(windowElement) {
      const titleText = windowElement.querySelector('.title-bar-text').textContent;
      return titleText.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    // Load minimized states from localStorage
    function loadMinimizedStates() {
      const savedStates = JSON.parse(localStorage.getItem('osrs-minimized-windows') || '{}');
      document.querySelectorAll('.window').forEach(windowElement => {
        const windowId = getWindowId(windowElement);
        if (savedStates[windowId]) {
          windowElement.classList.add('minimized');
        }
      });
    }

    // Save minimized states to localStorage
    function saveMinimizedStates() {
      const states = {};
      document.querySelectorAll('.window').forEach(windowElement => {
        const windowId = getWindowId(windowElement);
        states[windowId] = windowElement.classList.contains('minimized');
      });
      localStorage.setItem('osrs-minimized-windows', JSON.stringify(states));
    }

    // Load window order from localStorage
    function loadWindowOrder() {
      const savedOrder = JSON.parse(localStorage.getItem('osrs-window-order') || '[]');
      if (savedOrder.length === 0) return;

      const container = document.querySelector('.container');
      const windows = Array.from(container.querySelectorAll('.window'));

      // Create a map of window IDs to elements
      const windowMap = {};
      windows.forEach(windowElement => {
        const windowId = getWindowId(windowElement);
        windowMap[windowId] = windowElement;
      });

      // Reorder windows based on saved order
      savedOrder.forEach(windowId => {
        if (windowMap[windowId]) {
          container.appendChild(windowMap[windowId]);
        }
      });

      // Append any windows not in the saved order (new windows)
      windows.forEach(windowElement => {
        const windowId = getWindowId(windowElement);
        if (!savedOrder.includes(windowId)) {
          container.appendChild(windowElement);
        }
      });
    }

    // Save window order to localStorage
    function saveWindowOrder() {
      const container = document.querySelector('.container');
      const windowOrder = Array.from(container.querySelectorAll('.window')).map(windowElement =>
        getWindowId(windowElement)
      );
      localStorage.setItem('osrs-window-order', JSON.stringify(windowOrder));
    }

    // Sync states across all open windows/tabs
    function syncWindowStates(changedWindowId, isMinimized) {
      document.querySelectorAll('.window').forEach(windowElement => {
        const windowId = getWindowId(windowElement);
        if (windowId === changedWindowId) {
          if (isMinimized) {
            windowElement.classList.add('minimized');
          } else {
            windowElement.classList.remove('minimized');
          }
        }
      });
    }

    // Sync window order across all open windows/tabs
    function syncWindowOrder(newOrder) {
      const container = document.querySelector('.container');
      const windows = Array.from(container.querySelectorAll('.window'));

      // Create a map of window IDs to elements
      const windowMap = {};
      windows.forEach(windowElement => {
        const windowId = getWindowId(windowElement);
        windowMap[windowId] = windowElement;
      });

      // Reorder windows based on new order
      newOrder.forEach(windowId => {
        if (windowMap[windowId]) {
          container.appendChild(windowMap[windowId]);
        }
      });
    }

    function toggleWindow(button) {
      const windowElement = button.closest('.window');
      const windowId = getWindowId(windowElement);
      const isMinimized = windowElement.classList.toggle('minimized');

      // Save state and notify other windows
      saveMinimizedStates();

      // Broadcast change to other windows/tabs
      localStorage.setItem('osrs-window-change', JSON.stringify({
        windowId: windowId,
        isMinimized: isMinimized,
        timestamp: Date.now()
      }));
    }

    function closeWindow(button) {
      const windowElement = button.closest('.window');
      const windowDataId = windowElement.dataset.windowId;

      // Don't allow closing the Configuration window (it doesn't have data-window-id)
      if (!windowDataId) {
        return;
      }

      // Find and uncheck the corresponding checkbox in Configuration
      const checkbox = document.querySelector('input[type="checkbox"][id="window-' + windowDataId + '"]');
      if (checkbox) {
        checkbox.checked = false;
        // Trigger the existing window visibility update function
        updateWindowVisibility();
      }
    }

    // Initialize drag and drop functionality
    function initializeDragAndDrop() {
      const container = document.querySelector('.container');
      let draggedElement = null;
      let dropIndicator = null;

      // Create drop indicator
      dropIndicator = document.createElement('div');
      dropIndicator.className = 'drop-indicator';
      document.body.appendChild(dropIndicator);

      document.querySelectorAll('.window').forEach(windowElement => {
        // Make only the title bar draggable
        const titleBar = windowElement.querySelector('.title-bar');
        if (titleBar) {
          titleBar.draggable = true;
          titleBar.style.cursor = 'grab';

          titleBar.addEventListener('dragstart', function(e) {
            draggedElement = windowElement;
            windowElement.classList.add('dragging');
            container.classList.add('drag-over');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', windowElement.outerHTML);
          });

          titleBar.addEventListener('dragend', function(e) {
            windowElement.classList.remove('dragging');
            container.classList.remove('drag-over');
            dropIndicator.style.display = 'none';
            draggedElement = null;
          });

          titleBar.addEventListener('dragenter', function(e) {
            titleBar.style.cursor = 'grabbing';
          });

          titleBar.addEventListener('dragleave', function(e) {
            titleBar.style.cursor = 'grab';
          });
        }

        // Handle drop zones for other windows
        windowElement.addEventListener('dragover', function(e) {
          if (draggedElement && draggedElement !== this) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const rect = this.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            if (e.clientY < midY) {
              // Show indicator above this element
              dropIndicator.style.display = 'block';
              dropIndicator.style.top = (rect.top - 2) + 'px';
              dropIndicator.style.left = rect.left + 'px';
              dropIndicator.style.width = rect.width + 'px';
            } else {
              // Show indicator below this element
              dropIndicator.style.display = 'block';
              dropIndicator.style.top = (rect.bottom - 2) + 'px';
              dropIndicator.style.left = rect.left + 'px';
              dropIndicator.style.width = rect.width + 'px';
            }
          }
        });

        windowElement.addEventListener('drop', function(e) {
          if (draggedElement && draggedElement !== this) {
            e.preventDefault();

            const rect = this.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            if (e.clientY < midY) {
              // Insert before this element
              container.insertBefore(draggedElement, this);
            } else {
              // Insert after this element
              container.insertBefore(draggedElement, this.nextSibling);
            }

            // Save and sync the new order
            saveWindowOrder();

            // Broadcast order change to other windows/tabs
            const newOrder = Array.from(container.querySelectorAll('.window')).map(w => getWindowId(w));
            localStorage.setItem('osrs-order-change', JSON.stringify({
              order: newOrder,
              timestamp: Date.now()
            }));
          }
        });
      });

      // Handle drag over container (for empty spaces)
      container.addEventListener('dragover', function(e) {
        if (draggedElement) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';

          // Find the closest window element
          const afterElement = getDragAfterElement(container, e.clientY);
          if (!afterElement) {
            // Show indicator at the end
            const lastWindow = container.lastElementChild;
            if (lastWindow) {
              const rect = lastWindow.getBoundingClientRect();
              dropIndicator.style.display = 'block';
              dropIndicator.style.top = (rect.bottom + 10) + 'px';
              dropIndicator.style.left = rect.left + 'px';
              dropIndicator.style.width = rect.width + 'px';
            }
          }
        }
      });

      container.addEventListener('drop', function(e) {
        if (draggedElement) {
          e.preventDefault();
          const afterElement = getDragAfterElement(container, e.clientY);
          if (!afterElement) {
            container.appendChild(draggedElement);
          } else {
            container.insertBefore(draggedElement, afterElement);
          }

          // Save and sync the new order
          saveWindowOrder();

          // Broadcast order change to other windows/tabs
          const newOrder = Array.from(container.querySelectorAll('.window')).map(w => getWindowId(w));
          localStorage.setItem('osrs-order-change', JSON.stringify({
            order: newOrder,
            timestamp: Date.now()
          }));
        }
      });
    }

    function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.window:not(.dragging)')];

      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Listen for storage changes from other windows/tabs
    window.addEventListener('storage', function(e) {
      if (e.key === 'osrs-window-change') {
        const change = JSON.parse(e.newValue);
        syncWindowStates(change.windowId, change.isMinimized);
      } else if (e.key === 'osrs-order-change') {
        const change = JSON.parse(e.newValue);
        syncWindowOrder(change.order);
      }
    });

    // Initialize everything and hide loading screen
    function initializeApp() {
      // Apply initial states immediately to prevent flashing
      applyInitialStates();

      // Load all saved states (this will update checkboxes and other UI elements)
      loadWindowOrder();
      loadPlayerSelection();
      loadWindowVisibility();

      // Initialize interactive features
      initializeDragAndDrop();

      // Small delay to ensure all DOM updates are applied
      setTimeout(() => {
        // Hide loading screen and show content
        const loadingScreen = document.getElementById('loadingScreen');
        const body = document.body;

        if (loadingScreen) {
          loadingScreen.style.display = 'none';
        }
        body.classList.remove('loading');
      }, 50);
    }

    // Load states when page loads
    document.addEventListener('DOMContentLoaded', initializeApp);

    // Also load states immediately in case DOMContentLoaded already fired
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      initializeApp();
    }

    const ctx = document.getElementById('questChart').getContext('2d');
    questChart = new Chart(ctx, {
      type: 'line',
      data: ${JSON.stringify(chartData)},
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Quests Completed'
            }
          }
        }
      }
    });

    const totalLevelCtx = document.getElementById('totalLevelChart').getContext('2d');
    totalLevelChart = new Chart(totalLevelCtx, {
      type: 'line',
      data: ${JSON.stringify(totalLevelChartData)},
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Total Level'
            }
          }
        }
      }
    });

    const totalExpCtx = document.getElementById('totalExpChart').getContext('2d');
    totalExpChart = new Chart(totalExpCtx, {
      type: 'line',
      data: ${JSON.stringify(totalExpChartData)},
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Total XP'
            }
          }
        }
      }
    });

    const skillLevelCtx = document.getElementById('skillLevelChart').getContext('2d');
    skillLevelChart = new Chart(skillLevelCtx, {
      type: 'line',
      data: ${JSON.stringify(skillLevelChartData)},
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Level'
            },
            min: 1,
            max: 99
          }
        }
      }
    });
  </script>
</body>
</html>`;

    writeFileSync('public/index.html', htmlContent, 'utf-8');
    console.log('Static HTML generated successfully at public/index.html');
    console.log(`Generated at: ${generatedAt}`);

  } catch (error) {
    console.error('Error generating static HTML:', error);
    process.exit(1);
  }
}

// Run the generator
generateStaticHTML().catch(error => {
  console.error('Error in generateStaticHTML:', error);
  process.exit(1);
});
