import express from "express";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  const playerData = getPlayerData();
  const chartData = generateChartData(playerData);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>OSRS Quest Tracker</title>
      <link rel="stylesheet" href="https://unpkg.com/98.css">
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body style="background-color: #008080;">
      <div class="window" style="margin: 32px; width: 850px;">
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

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
      label: player,
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
