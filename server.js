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
      </style>
    </head>
    <body style="background-color: #008080;">
      <div class="container">
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">OSRS Quest Progress</div>
            <div class="title-bar-controls">
              <button aria-label="Minimize"></button>
              <button aria-label="Maximize"></button>
              <button aria-label="Close"></button>
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
          </div>
          <div class="window-body">
            ${questTableHtml}
          </div>
        </div>
        <div class="window main-window">
          <div class="title-bar">
            <div class="title-bar-text">Level Comparison</div>
          </div>
          <div class="window-body">
            ${levelTableHtml}
          </div>
        </div>
      </div>
      <script>
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
    datasets.push({
      label: getDisplayName(player),
      data: data.map(d => ({ x: d.timestamp, y: d.completedQuests })),
      borderColor: color,
      backgroundColor: color + '33',
      fill: false,
    });
    data.forEach(d => labels.add(d.timestamp.toISOString().split('T')[0]));
  }

  return {
    labels: [...labels].sort(),
    datasets
  };
}
