import express from "express";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  const playerData = getPlayerData();
  const chartData = generateChartData(playerData);
  const questComparisonData = getQuestComparisonData();
  const questTableHtml = generateQuestComparisonTable(questComparisonData);

  const levelComparisonData = getLevelComparisonData();
  const levelTableHtml = generateLevelComparisonTable(levelComparisonData);

  const achievementDiaryComparisonData = getAchievementDiaryComparisonData();
  const achievementDiaryTableHtml = generateAchievementDiaryComparisonTable(achievementDiaryComparisonData);

  const musicTracksComparisonData = getMusicTracksComparisonData();
  const musicTracksTableHtml = generateMusicTracksComparisonTable(musicTracksComparisonData);

  const achievementsData = getAchievementsData();
  const achievementsTableHtml = generateAchievementsTable(achievementsData);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>OSRS Quest Tracker</title>
      <link rel="stylesheet" href="https://unpkg.com/98.css">
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
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
          width: 850px;
        }
        .level-cell {
          text-align: center;
          font-weight: bold;
        }
        .level-high { color: #006600; }
        .level-medium { color: #cc6600; }
        .level-low { color: #cc0000; }
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
        .achievement-league { background-color: #ff9f40; }
        .window.minimized .window-body { display: none; }
        .window.minimized { margin-bottom: 10px; }
      </style>
    </head>
    <body style="background-color: #008080;">
      <div class="container">
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">OSRS Quest Progress</div>
            <div class="title-bar-controls">
              <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
            </div>
          </div>
          <div class="window-body">
            <div style="max-width: 800px; max-height: 600px;">
              <canvas id="questChart"></canvas>
            </div>
          </div>
        </div>
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">Quest Comparison</div>
            <div class="title-bar-controls">
              <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
            </div>
          </div>
          <div class="window-body">
            ${questTableHtml}
          </div>
        </div>
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">Level Comparison</div>
            <div class="title-bar-controls">
              <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
            </div>
          </div>
          <div class="window-body">
            ${levelTableHtml}
          </div>
        </div>
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">Achievement Diaries Comparison</div>
            <div class="title-bar-controls">
              <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
            </div>
          </div>
          <div class="window-body">
            ${achievementDiaryTableHtml}
          </div>
        </div>
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">Music Tracks Comparison</div>
            <div class="title-bar-controls">
              <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
            </div>
          </div>
          <div class="window-body">
            ${musicTracksTableHtml}
          </div>
        </div>
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">Recent Achievements & Progress</div>
            <div class="title-bar-controls">
              <button aria-label="Minimize" onclick="toggleWindow(this)"></button>
            </div>
          </div>
          <div class="window-body">
            ${achievementsTableHtml}
          </div>
        </div>
      </div>
      <script>
        // Get window ID from title text
        function getWindowId(windowElement) {
          const titleText = windowElement.querySelector('.title-bar-text').textContent;
          return titleText.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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

        // Listen for storage changes from other windows/tabs
        window.addEventListener('storage', function(e) {
          if (e.key === 'osrs-window-change') {
            const change = JSON.parse(e.newValue);
            syncWindowStates(change.windowId, change.isMinimized);
          }
        });

        // Load states when page loads
        document.addEventListener('DOMContentLoaded', loadMinimizedStates);

        // Also load states immediately in case DOMContentLoaded already fired
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', loadMinimizedStates);
        } else {
          loadMinimizedStates();
        }

        const ctx = document.getElementById('questChart').getContext('2d');
        new Chart(ctx, {
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
      </script>
    </body>
    </html>
  `);
});

app.listen(port, (err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(`Server running at http://localhost:${port}`);
});

function getDisplayName(playerDir) {
  const nameMap = {
    'anime irl': 'Martynas',
    'swamp party': 'Petras',
    'clintonhill': 'Karolis',
    'serasvasalas': 'Mangirdas',
    'juozulis': 'Minvydas'
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
  tableHtml += '<table class="interactive" style="width: 100%;">';

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

    for (const player of players) {
      const level = playerLevels[player]?.[skill] ?? 0;
      let levelClass = 'level-low';
      if (level >= 80) levelClass = 'level-high';
      else if (level >= 50) levelClass = 'level-medium';

      tableHtml += `<td class="level-cell ${levelClass}">${level}</td>`;
    }
    tableHtml += '</tr>';
  }
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
        if (!playerData || !playerData[difficulty]) return null;
        return playerData[difficulty].complete;
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

function getAchievementsData() {
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
                  if (previousDifficulty && !previousDifficulty.complete && currentDifficulty.complete) {
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
          const currentCount = currentData.combat_achievements.length;
          const previousCount = previousData.combat_achievements.length;
          if (currentCount > previousCount) {
            allAchievements.push({
              player: player,
              type: 'combat',
              name: `Combat Achievement (${previousCount} → ${currentCount})`,
              timestamp: currentTimestamp,
              previousTimestamp: previousTimestamp,
              displayName: getDisplayName(player)
            });
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
    'juozulis': '#9966FF'
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
    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
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
    tableHtml += `<td>${achievement.name}</td>`;
    tableHtml += `<td>${achievement.type.charAt(0).toUpperCase() + achievement.type.slice(1)}</td>`;
    tableHtml += `<td>${dateWithTime}</td>`;
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}
