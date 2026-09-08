// Store original data for filtering
let originalChartData = null;
let originalTotalLevelChartData = null;
let originalTotalExpChartData = null;
let xpHistory = {};
let originalSkillLevelProgressData = null;
let originalSkillLevelChartData = null;
let questChart = null;
let totalLevelChart = null;
let totalExpChart = null;
let skillLevelChart = null;
let showOnlyMajorAchievements = false;
let sailingExplorerPlayer = null;
let sailingExplorerStatus = 'missing';
let sailingExplorerGroup = 'all';

const GENERAL_TRACKER_REBALANCE_VERSION = 3;
const SAILING_WINDOW_IDS = new Set(['sailing-progress', 'sea-charting-explorer']);

// Create player mapping objects from config
let displayToPlayer = {};
let playerToDisplay = {};

// Create player colors mapping from config
let playerColors = {};

// Chart colors for client-side use
let CHART_COLORS = [];

// Table data loaded from JSON
let tableData = null;

const TIER_ORDER = {
  'Easy (1 pt)': 1,
  'Medium (2 pts)': 2,
  'Hard (3 pts)': 3,
  'Elite (4 pts)': 4,
  'Master (5 pts)': 5,
  'Grandmaster (6 pts)': 6
};

async function loadAppData() {
  const v = document.body.dataset.version || '';
  const [chartResponse, configResponse, tableResponse] = await Promise.all([
    fetch('data/chart-data.json?v=' + v),
    fetch('data/player-config.json?v=' + v),
    fetch('data/table-data.json?v=' + v)
  ]);
  const failedResponse = [chartResponse, configResponse, tableResponse].find(response => !response.ok);
  if (failedResponse) {
    throw new Error(`Dashboard data request failed with HTTP ${failedResponse.status}`);
  }
  const chartData = await chartResponse.json();
  const configData = await configResponse.json();
  tableData = await tableResponse.json();

  originalChartData = chartData.questChart;
  originalTotalLevelChartData = chartData.totalLevelChart;
  originalTotalExpChartData = chartData.totalExpChart;
  xpHistory = chartData.xpHistory || {};
  originalSkillLevelProgressData = chartData.skillLevelProgress;
  originalSkillLevelChartData = chartData.skillLevelChart;

  displayToPlayer = configData.displayToPlayer;
  playerToDisplay = configData.playerToDisplay;
  playerColors = configData.playerColors;
  CHART_COLORS = configData.chartColors;
  const palette = ['#c32727', '#005ddd', '#697800', '#168039', '#853acb', '#a85d00', '#008c9e', '#be1680', '#424242'];
  Object.keys(playerToDisplay).forEach((player, index) => { playerColors[player] = palette[index % palette.length]; });
  for (const data of [originalChartData, originalTotalLevelChartData, originalTotalExpChartData, originalSkillLevelChartData]) {
    data?.datasets.forEach(dataset => {
      const color = playerColors[displayToPlayer[dataset.label]] || '#605443';
      dataset.borderColor = color;
      dataset.backgroundColor = color;
    });
  }
  CHART_COLORS = palette;
  document.querySelectorAll('input[type="checkbox"][id^="player-"]').forEach(input => {
    const label = input.nextElementSibling;
    if (label?.classList.contains('player-label')) label.style.color = safePlayerColor(input.value);
  });
}

function computeRankings(items, valueKey) {
  const sorted = [...items].sort((a, b) => b[valueKey] - a[valueKey]);
  const rankings = {};
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i - 1][valueKey] > sorted[i][valueKey]) {
      currentRank = i + 1;
    }
    rankings[sorted[i].player] = currentRank;
  }
  return rankings;
}

function getDisplayName(player) {
  return playerToDisplay[player] || player;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function safeWikiUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'oldschool.runescape.wiki') {
      return escapeHtml(url.href);
    }
  } catch {
    // Invalid or absent upstream URL.
  }
  return '#';
}

function safePlayerColor(player) {
  const configuredColor = playerColors[player];
  return /^#[0-9a-f]{6}$/i.test(configuredColor || '') ? configuredColor : '#008080';
}

function playerNameHtml(player, name = getDisplayName(player)) {
  return `<span class="player-identity" style="color:${safePlayerColor(player)}">${escapeHtml(name)}</span>`;
}

function readStoredStringArray(key) {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return null;
    return [...new Set(parsed.filter(value => typeof value === 'string'))];
  } catch {
    return null;
  }
}

function readStoredObject(key) {
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readWindowCatalogVersion() {
  const value = Number(localStorage.getItem('osrs-window-catalog-version'));
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

function getRankingClass(value, rank) {
  if (value > 0) {
    if (rank === 1) return ' rank-1st';
    if (rank === 2) return ' rank-2nd';
    if (rank === 3) return ' rank-3rd';
  }
  return '';
}

function applyRankingClasses(allCells, selectedItems, valueKey) {
  const rankings = computeRankings(selectedItems, valueKey);
  allCells.forEach(cell => {
    cell.classList.remove('rank-1st', 'rank-2nd', 'rank-3rd');
  });
  selectedItems.forEach(item => {
    if (item[valueKey] > 0) {
      const rank = rankings[item.player];
      if (rank === 1) item.cell.classList.add('rank-1st');
      else if (rank === 2) item.cell.classList.add('rank-2nd');
      else if (rank === 3) item.cell.classList.add('rank-3rd');
    }
  });
}

// Player filtering functions
function getSelectedPlayers() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="player-"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// Time period filtering functions
function getSelectedTimePeriod() {
  const select = document.getElementById('timePeriodSelect');
  return select ? select.value : '30';
}

function filterDatasetsByTime(datasets, days) {
  if (days === 'all') return { datasets, labels: null };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

  const filteredDatasets = datasets.map(dataset => ({
    ...dataset,
    data: dataset.data.filter(point => {
      // Parse the formatted date string back to Date
      const pointDate = new Date(point.x);
      return pointDate >= cutoffDate;
    })
  }));

  // Collect all unique x values from filtered datasets for labels
  const allXValues = new Set();
  filteredDatasets.forEach(dataset => {
    dataset.data.forEach(point => allXValues.add(point.x));
  });

  // Sort labels chronologically
  const labels = [...allXValues].sort((a, b) => new Date(a) - new Date(b));

  return { datasets: filteredDatasets, labels };
}

function updateTimePeriod() {
  const timePeriod = getSelectedTimePeriod();
  localStorage.setItem('osrs-chart-time-period', timePeriod);

  const selectedPlayers = getSelectedPlayers();
  updateChart(selectedPlayers);
  updateTotalLevelChart(selectedPlayers);
  updateTotalExpChart(selectedPlayers);
  updateSkillLevelChart(selectedPlayers);
}

// Chart options (Total XP scale) persistence and UI
function saveTotalXpLogScalePreference(isLog) {
  localStorage.setItem('osrs-totalxp-log-scale', JSON.stringify(isLog));
}

function loadTotalXpLogScalePreference() {
  const saved = localStorage.getItem('osrs-totalxp-log-scale');
  if (!saved) return true;
  try {
    const parsed = JSON.parse(saved);
    return typeof parsed === 'boolean' ? parsed : true;
  } catch {
    return true;
  }
}

function applyTotalXpScale(isLog) {
  if (!totalExpChart) return;
  updateTotalExpChart(getSelectedPlayers());
}

function initializeTotalXpScaleButton() {
  const button = document.getElementById('btn-totalxp-scale');
  if (!button) return;
  function setLabel(isLog) {
    button.textContent = isLog ? 'Log scale: On' : 'Log scale: Off';
  }
  const saved = loadTotalXpLogScalePreference();
  setLabel(saved);
  button.addEventListener('click', function() {
    const current = loadTotalXpLogScalePreference();
    const next = !current;
    saveTotalXpLogScalePreference(next);
    setLabel(next);
    applyTotalXpScale(next);
  });
}

function updateAchievementsFilterButtonLabel() {
  const toggleButton = document.getElementById('toggle-major-achievements');
  if (!toggleButton || toggleButton.disabled) {
    return;
  }

  let achievementsTable = null;
  const windows = document.querySelectorAll('.window');
  for (const window of windows) {
    const titleText = window.querySelector('.title-bar-text');
    if (titleText && titleText.textContent.includes('Recent Achievements')) {
      achievementsTable = window.querySelector('table');
      break;
    }
  }

  let totalMajor = 0;
  if (achievementsTable) {
    const majorRows = achievementsTable.querySelectorAll('tbody tr[data-is-major="true"]');
    totalMajor = Array.from(majorRows).filter(row => row.style.display !== 'none').length;
  }

  toggleButton.setAttribute('aria-pressed', String(showOnlyMajorAchievements));
  toggleButton.textContent = showOnlyMajorAchievements ? 'Show all updates' : `Major only (${totalMajor})`;

}

function initializeAchievementsFilter() {
  const toggleButton = document.getElementById('toggle-major-achievements');
  if (!toggleButton || toggleButton.disabled) {
    return;
  }

  updateAchievementsFilterButtonLabel();

  toggleButton.addEventListener('click', function() {
    showOnlyMajorAchievements = !showOnlyMajorAchievements;
    toggleButton.dataset.filterState = showOnlyMajorAchievements ? 'major' : 'all';
    const selectedPlayers = getSelectedPlayers();
    updateAchievementsTable(selectedPlayers);
    updateAchievementsFilterButtonLabel();
  });
}

function updateCheckboxVisualIndicators(checkboxPrefix, labelClass) {
  document.querySelectorAll(`input[type="checkbox"][id^="${checkboxPrefix}"]`).forEach(checkbox => {
    const label = checkbox.nextElementSibling?.classList.contains(labelClass)
      ? checkbox.nextElementSibling
      : null;
    if (label) {
      label.classList.toggle('unselected', !checkbox.checked);
    }
  });
}

function updatePlayerVisualIndicators() {
  updateCheckboxVisualIndicators('player-', 'player-label');
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
  renderSailingProgress(selectedPlayers);
  renderSeaChartingExplorer(selectedPlayers);

  // Recount searches after the player filters have updated row visibility.
  document.querySelectorAll('.table-search input').forEach(input => input.dispatchEvent(new Event('input')));
  // Save selection state
  savePlayerSelection(selectedPlayers);
}

// Window visibility functions
function getSelectedWindows() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="window-"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

function updateWindowVisualIndicators() {
  updateCheckboxVisualIndicators('window-', 'window-label');
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
  const configuredCatalogVersion = Number(document.body.dataset.windowCatalogVersion);
  const currentCatalogVersion = Number.isInteger(configuredCatalogVersion) && configuredCatalogVersion >= 1
    ? configuredCatalogVersion
    : 1;
  const seenCatalogVersion = readWindowCatalogVersion();
  const selectedWindows = readStoredStringArray('osrs-selected-windows');
  if (selectedWindows) {
    const shouldRebalance = seenCatalogVersion < GENERAL_TRACKER_REBALANCE_VERSION
      && currentCatalogVersion >= GENERAL_TRACKER_REBALANCE_VERSION;
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="window-"]');
    checkboxes.forEach(cb => {
      const introducedVersion = Number(cb.dataset.introducedVersion || 1);
      cb.checked = shouldRebalance && SAILING_WINDOW_IDS.has(cb.value)
        ? false
        : selectedWindows.includes(cb.value) || introducedVersion > seenCatalogVersion;
    });
    updateWindowVisibility();
  } else {
    // Apply and persist the generated defaults on a first visit.
    updateWindowVisibility();
  }
  localStorage.setItem('osrs-window-catalog-version', String(currentCatalogVersion));
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
  const selectedPlayers = readStoredStringArray('osrs-selected-players');
  if (selectedPlayers) {
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

function loadTimePeriodPreference() {
  const saved = localStorage.getItem('osrs-chart-time-period');
  if (saved) {
    const select = document.getElementById('timePeriodSelect');
    if (select) {
      select.value = saved;
    }
  }
}

function updateChartInstance(chartInstance, originalData, selectedPlayers) {
  if (!chartInstance) return;
  const timePeriod = getSelectedTimePeriod();
  let filteredDatasets = originalData.datasets.filter(dataset => {
    const playerKey = displayToPlayer[dataset.label];
    return playerKey && selectedPlayers.includes(playerKey);
  });
  const { datasets, labels } = filterDatasetsByTime(filteredDatasets, timePeriod);
  renderProgressChart(chartInstance, datasets);
}

function updateChart(selectedPlayers) {
  updateChartInstance(questChart, originalChartData, selectedPlayers);
}

function updateTotalLevelChart(selectedPlayers) {
  updateChartInstance(totalLevelChart, originalTotalLevelChartData, selectedPlayers);
}

function updateTotalExpChart(selectedPlayers) {
  renderXpTrends(selectedPlayers);
  if (!totalExpChart) return;
  const datasets = selectedPlayers.map(player => ({
    label: getDisplayName(player), borderColor: playerColors[player],
    data: xpSeriesData(xpHistory[player] || [], getSelectedTimePeriod(), xpChartMode === 'gained')
  }));
  renderProgressChart(totalExpChart, datasets, { xp: true });
}

function updateSkillLevelChart(selectedPlayers) {
  if (!skillLevelChart) return;

  const timePeriod = getSelectedTimePeriod();

  // Get the currently selected skill
  const skillSelect = document.getElementById('skillSelect');
  const selectedSkill = skillSelect ? skillSelect.value : originalSkillLevelProgressData.availableSkills[0];

  // Generate new chart data for the selected skill and players
  const filteredPlayerData = {};

  // Filter player data to only include selected players
  for (const [player, data] of Object.entries(originalSkillLevelProgressData.playerData)) {
    if (selectedPlayers.includes(player)) {
      filteredPlayerData[player] = data;
    }
  }

  // Generate new chart data
  let newChartData = generateSkillLevelChartDataJS(filteredPlayerData, selectedSkill);

  // Apply time period filter
  const { datasets, labels } = filterDatasetsByTime(newChartData.datasets, timePeriod);

  renderProgressChart(skillLevelChart, datasets, { skill: selectedSkill });
}

function updateSkillChart() {
  const selectedPlayers = getSelectedPlayers();
  updateSkillLevelChart(selectedPlayers);
}

function generateTimeSeriesChartDataJS(playerData, valueExtractor) {
  const datasets = [];
  const allTimestamps = new Set();
  const colors = CHART_COLORS;
  let colorIndex = 0;

  for (const player in playerData) {
    const data = playerData[player];
    data.forEach(d => allTimestamps.add(new Date(d.timestamp).getTime()));
  }

  const sortedTimestamps = [...allTimestamps].sort((a, b) => a - b);

  const labels = sortedTimestamps.map(timestamp => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Vilnius'
    });
  });

  for (const player in playerData) {
    const data = playerData[player];
    const color = playerColors[player] || colors[colorIndex % colors.length];
    colorIndex++;

    const formattedData = data.map(d => ({
      x: new Date(d.timestamp).getTime(),
      y: valueExtractor(d)
    }));

    datasets.push({
      label: playerToDisplay[player] || player,
      data: formattedData,
      borderColor: color,
      backgroundColor: color + '33',
      fill: false,
    });
  }

  return { labels, datasets };
}

function generateSkillLevelChartDataJS(playerData, selectedSkill) {
  return generateTimeSeriesChartDataJS(playerData, d => d.skillLevels[selectedSkill] || 1);
}

function findTableByWindowTitle(titleSubstring) {
  for (const win of document.querySelectorAll('.window')) {
    const titleText = win.querySelector('.title-bar-text');
    if (titleText && titleText.textContent.includes(titleSubstring)) {
      return win.querySelector('table');
    }
  }
  return null;
}

function updateQuestTable(selectedPlayers) {
  const table = findTableByWindowTitle('Quest Comparison');
  if (!table) return;

  updateTable(table, selectedPlayers, 'quest');
}

function updateLevelTable(selectedPlayers) {
  const table = findTableByWindowTitle('Level Comparison');
  if (!table) return;

  updateTable(table, selectedPlayers, 'level');
  updateLevelRankings(table, selectedPlayers);
}

function updateLevelRankings(table, selectedPlayers) {

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

    applyRankingClasses(levelCells, selectedLevels, 'level');
  });
}

function updateDiaryTable(selectedPlayers) {
  const table = findTableByWindowTitle('Achievement Diaries');
  if (!table) return;

  updateTable(table, selectedPlayers, 'diary');
}

function updateCombatAchievementsTable(selectedPlayers) {
  const table = findTableByWindowTitle('Combat Achievements');
  if (!table) return;

  updateCombatAchievementsTableContent(table, selectedPlayers);
  updateCombatAchievementsRankings(table, selectedPlayers);
}

function updateMusicTable(selectedPlayers) {
  const table = findTableByWindowTitle('Music Tracks');
  if (!table) return;

  updateTable(table, selectedPlayers, 'music');
  updateMusicTotalsRankings(table, selectedPlayers);
}

function updateTotalRowRankings(table, selectedPlayers, totalRowClass, skipColumns) {
  const totalRow = table.querySelector('tbody tr:last-child');
  if (!totalRow || !totalRow.classList.contains(totalRowClass)) return;

  const cells = totalRow.querySelectorAll('td');
  if (cells.length <= skipColumns) return;

  const totalCells = Array.from(cells).slice(skipColumns);

  const selectedTotals = [];
  totalCells.forEach(cell => {
    const playerData = cell.dataset.player;
    if (!playerData) return;
    const total = parseInt(cell.dataset.total) || 0;

    if (selectedPlayers.includes(playerData)) {
      selectedTotals.push({ cell, player: playerData, total });
    }
  });

  applyRankingClasses(totalCells, selectedTotals, 'total');
}

function updateMusicTotalsRankings(table, selectedPlayers) {
  updateTotalRowRankings(table, selectedPlayers, 'music-tracks-total-row', 1);
}

function updateCollectionLogTable(selectedPlayers) {
  const table = findTableByWindowTitle('Collection Log');
  if (!table) return;

  updateCollectionLogTableContent(table, selectedPlayers);
  updateCollectionLogRankings(table, selectedPlayers);
}

function updateMultiColumnTableContent(table, selectedPlayers, fixedColumns, totalRowClass) {
  const headerRow = table.querySelector('thead tr');
  const bodyRows = table.querySelectorAll('tbody tr');

  if (!headerRow) return;

  const headerCells = headerRow.querySelectorAll('th');
  const playerHeaders = Array.from(headerCells).slice(fixedColumns);

  const columnsToShow = new Set(Array.from({ length: fixedColumns }, (_, i) => i));
  const selectedPlayerIndices = [];

  playerHeaders.forEach((header, index) => {
    const displayName = header.textContent;
    const playerKey = displayToPlayer[displayName];

    if (playerKey && selectedPlayers.includes(playerKey)) {
      columnsToShow.add(index + fixedColumns);
      selectedPlayerIndices.push(index + fixedColumns);
      header.style.display = '';
    } else {
      header.style.display = 'none';
    }
  });

  bodyRows.forEach(row => {
    const cells = row.querySelectorAll('td');

    if (!row.classList.contains(totalRowClass)) {
      let anySelectedPlayerHasIt = false;
      for (const playerIndex of selectedPlayerIndices) {
        if (cells[playerIndex] && cells[playerIndex].textContent.trim() === '\u2713') {
          anySelectedPlayerHasIt = true;
          break;
        }
      }

      row.style.display = (!anySelectedPlayerHasIt && selectedPlayers.length > 0) ? 'none' : '';
    }

    cells.forEach((cell, index) => {
      cell.style.display = columnsToShow.has(index) ? '' : 'none';
    });
  });
}

function updateCollectionLogTableContent(table, selectedPlayers) {
  updateMultiColumnTableContent(table, selectedPlayers, 2, 'collection-log-total-row');
}

function updateCombatAchievementsTableContent(table, selectedPlayers) {
  updateMultiColumnTableContent(table, selectedPlayers, 3, 'combat-achievements-total-row');
}

function updateCombatAchievementsRankings(table, selectedPlayers) {
  updateTotalRowRankings(table, selectedPlayers, 'combat-achievements-total-row', 3);
}

function updateCollectionLogRankings(table, selectedPlayers) {
  updateTotalRowRankings(table, selectedPlayers, 'collection-log-total-row', 2);
}

function updateAchievementsTable(selectedPlayers) {
  const table = findTableByWindowTitle('Recent Achievements');
  if (!table) return;

  // For achievements table, filter rows by selected players
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const playerCell = row.querySelector('td:first-child strong');
    if (playerCell) {
      const playerName = playerCell.textContent;
      // Use global displayToPlayer mapping

      const playerKey = displayToPlayer[playerName];
      const matchesPlayer = playerKey && selectedPlayers.includes(playerKey);
      const isMajor = row.dataset.isMajor === 'true';
      const matchesMajorFilter = !showOnlyMajorAchievements || isMajor;
      row.style.display = matchesPlayer && matchesMajorFilter ? '' : 'none';
    }
  });

  const summary = document.getElementById('achievement-summary');
  if (summary) summary.innerHTML = generateAchievementSummary((tableData?.achievements || []).filter(item =>
    selectedPlayers.includes(item.player) && (!showOnlyMajorAchievements || item.isMajorAchievement)));
  updateAchievementsFilterButtonLabel();
}

function updateActivitiesTable(selectedPlayers) {
  const table = findTableByWindowTitle('Activities Comparison');
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

    applyRankingClasses(scoreCells, selectedScores, 'score');
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
  const columnsToShow = new Set([0]); // Always show first column (item name)

  playerHeaders.forEach((header, index) => {
    const displayName = header.textContent;
    const playerKey = displayToPlayer[displayName];

    if (playerKey && selectedPlayers.includes(playerKey)) {
      columnsToShow.add(index + 1);
      header.style.display = '';
    } else {
      header.style.display = 'none';
    }
  });

  // Update body rows
  bodyRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    cells.forEach((cell, index) => {
      cell.style.display = columnsToShow.has(index) ? '' : 'none';
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
  return titleText.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function updateWindowAccessibilityState(windowElement) {
  const title = windowElement.querySelector('.title-bar-text')?.textContent.trim() || 'window';
  const windowBody = windowElement.querySelector('.window-body');
  const minimizeButton = windowElement.querySelector('.title-bar-controls button[onclick^="toggleWindow"]');
  const closeButton = windowElement.querySelector('.title-bar-controls button[onclick^="closeWindow"]');
  const isMinimized = windowElement.classList.contains('minimized');

  if (windowBody && minimizeButton) {
    const bodyId = `window-body-${getWindowId(windowElement)}`;
    windowBody.id = bodyId;
    minimizeButton.setAttribute('aria-controls', bodyId);
    minimizeButton.setAttribute('aria-expanded', String(!isMinimized));
    minimizeButton.setAttribute('aria-label', `${isMinimized ? 'Expand' : 'Collapse'} ${title}`);
    minimizeButton.textContent = isMinimized ? 'Show' : 'Hide';
    minimizeButton.setAttribute('title', `${isMinimized ? 'Expand' : 'Collapse'} ${title}`);
  }

  if (closeButton) {
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.setAttribute('title', `Close ${title}`);
  }
}

function initializeWindowAccessibility() {
  document.querySelectorAll('.window').forEach(updateWindowAccessibilityState);
}

// Load minimized states from localStorage
function loadMinimizedStates() {
  const savedStates = readStoredObject(document.body.dataset.layout === 'wiki' ? 'osrs-collapsed-sections' : 'osrs-minimized-windows') || {};
  document.querySelectorAll('.window').forEach(windowElement => {
    const windowId = getWindowId(windowElement);
    if (savedStates[windowId]) {
      windowElement.classList.add('minimized');
    }
    updateWindowAccessibilityState(windowElement);
  });
}

// Save minimized states to localStorage
function saveMinimizedStates() {
  const states = {};
  document.querySelectorAll('.window').forEach(windowElement => {
    const windowId = getWindowId(windowElement);
    states[windowId] = windowElement.classList.contains('minimized');
  });
  localStorage.setItem(document.body.dataset.layout === 'wiki' ? 'osrs-collapsed-sections' : 'osrs-minimized-windows', JSON.stringify(states));
}

// Load window order from localStorage
function loadWindowOrder() {
  const savedOrder = readStoredStringArray('osrs-window-order') || [];
  if (savedOrder.length === 0) return;

  const container = document.querySelector('.container');
  const windows = Array.from(container.querySelectorAll('.window'));

  // Create a map of window IDs to elements
  const windowMap = {};
  windows.forEach(windowElement => {
    const windowId = getWindowId(windowElement);
    windowMap[windowId] = windowElement;
  });

  const seenCatalogVersion = readWindowCatalogVersion();
  const configuredCatalogVersion = Number(document.body.dataset.windowCatalogVersion);
  const currentCatalogVersion = Number.isInteger(configuredCatalogVersion) && configuredCatalogVersion >= 1
    ? configuredCatalogVersion
    : 1;
  const shouldRebalance = seenCatalogVersion < GENERAL_TRACKER_REBALANCE_VERSION
    && currentCatalogVersion >= GENERAL_TRACKER_REBALANCE_VERSION;
  const introducedWindows = windows.filter(windowElement => {
    const windowId = getWindowId(windowElement);
    const introducedVersion = Number(windowElement.dataset.introducedVersion || 1);
    return !savedOrder.includes(windowId) && introducedVersion > seenCatalogVersion;
  });
  const introducedWindowIds = new Set(introducedWindows.map(getWindowId));
  let orderedWindows = savedOrder.map(windowId => windowMap[windowId]).filter(Boolean);

  for (const windowElement of windows) {
    const windowId = getWindowId(windowElement);
    if (!savedOrder.includes(windowId) && !introducedWindowIds.has(windowId)) {
      orderedWindows.push(windowElement);
    }
  }

  const configurationIndex = orderedWindows.findIndex(windowElement => getWindowId(windowElement) === 'configuration');
  orderedWindows.splice(configurationIndex >= 0 ? configurationIndex + 1 : 0, 0, ...introducedWindows);
  if (shouldRebalance) {
    const sailingWindows = orderedWindows.filter(windowElement => SAILING_WINDOW_IDS.has(getWindowId(windowElement)));
    orderedWindows = orderedWindows
      .filter(windowElement => !SAILING_WINDOW_IDS.has(getWindowId(windowElement)))
      .concat(sailingWindows);
  }
  orderedWindows.forEach(windowElement => container.appendChild(windowElement));

  // Persist catalog migrations before the version is marked as seen.
  if (introducedWindows.length > 0 || shouldRebalance) saveWindowOrder();
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
      updateWindowAccessibilityState(windowElement);
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
  updateWindowAccessibilityState(windowElement);

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

// Listen for storage changes from other windows/tabs
window.addEventListener('storage', function(e) {
  if (document.body.dataset.layout === 'wiki') return;
  try {
    if (e.key === 'osrs-window-change') {
      const change = JSON.parse(e.newValue);
      if (typeof change?.windowId === 'string' && typeof change?.isMinimized === 'boolean') {
        syncWindowStates(change.windowId, change.isMinimized);
      }
    } else if (e.key === 'osrs-order-change') {
      const change = JSON.parse(e.newValue);
      if (Array.isArray(change?.order)) {
        syncWindowOrder(change.order.filter(windowId => typeof windowId === 'string'));
      }
    }
  } catch {
    // Ignore malformed cross-tab state and keep the current page usable.
  }
});

// === TABLE RENDERING FUNCTIONS ===

function generateQuestComparisonTable(comparisonData) {
  const { players, quests, playerQuests, questMetaByName } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare quests.</p>";
  }

  let tableHtml = '<div class="sunken-panel" role="region" aria-label="Quest comparison" tabindex="0" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive sticky-header quest-comparison-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Quest</th>';
  for (const player of players) {
    tableHtml += `<th>${playerNameHtml(player)}</th>`;
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
    const meta = questMetaByName ? questMetaByName[quest] : null;
    if (meta && meta.nameWikiLink) {
      tableHtml += `<td><a href="${safeWikiUrl(meta.nameWikiLink)}" target="_blank" rel="noopener noreferrer" ><span class="icon-label">${osrsIcon('Quest_point_icon')}${escapeHtml(quest)}</span></a></td>`;
    } else {
      tableHtml += `<td><span class="icon-label">${osrsIcon('Quest_point_icon')}${escapeHtml(quest)}</span></td>`;
    }
    for (const status of statuses) {
      let statusClass = 'status-not-started';
      let statusLabel = 'Not started';
      if (status === 1) {
        statusClass = 'status-in-progress';
        statusLabel = 'In progress';
      }
      if (status === 2) {
        statusClass = 'status-completed';
        statusLabel = 'Completed';
      }
      tableHtml += `<td class="${statusClass}" aria-label="${statusLabel}" title="${statusLabel}"><span aria-hidden="true">${status === 2 ? '✓' : status === 1 ? '◐' : '—'}</span></td>`;
    }
    tableHtml += '</tr>';
  }
  // Add total quests completed row (sticky)
  const totalCompleted = players.map(player => {
    const pq = playerQuests[player] || {};
    return Object.values(pq).reduce((sum, status) => sum + (status === 2 ? 1 : 0), 0);
  });

  // Rankings for totals
  const totalsForRanking = players.map((player, idx) => ({ player, total: totalCompleted[idx] }));
  const totalRankings = computeRankings(totalsForRanking, 'total');

  tableHtml += '<tr class="sticky-total-row quest-total-row">';
  tableHtml += '<td style="font-size: 1.1em; font-weight: bold;">Total Quests Completed</td>';
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const total = totalCompleted[i];
    const rankingClass = getRankingClass(total, totalRankings[player]);
    tableHtml += `<td class="level-cell${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function generateLevelComparisonTable(comparisonData) {
  const { players, skills, playerLevels } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare levels.</p>";
  }

  let tableHtml = '<div class="sunken-panel" role="region" aria-label="Level comparison" tabindex="0" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive sticky-header level-comparison-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Skill</th>';
  for (const player of players) {
    tableHtml += `<th>${playerNameHtml(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const skill of skills) {
    tableHtml += '<tr>';
    tableHtml += `<td><span class="icon-label">${osrsIcon(SKILL_ICONS.has(skill) ? `${skill}_icon` : null)}${escapeHtml(skill)}</span></td>`;

    // Get all levels for this skill to determine rankings
    const skillLevels = players.map(player => ({
      player,
      level: playerLevels[player]?.[skill] ?? 0
    }));

    const rankings = computeRankings(skillLevels, 'level');

    for (const player of players) {
      const level = playerLevels[player]?.[skill] ?? 0;
      let levelClass = 'level-low';
      if (level >= 80) levelClass = 'level-high';
      else if (level >= 50) levelClass = 'level-medium';

      const rankingClass = getRankingClass(level, rankings[player]);

      tableHtml += `<td class="level-cell ${levelClass}${rankingClass}" data-player="${escapeHtml(player)}" data-skill="${escapeHtml(skill)}" data-level="${level}">${level}</td>`;
    }
    tableHtml += '</tr>';
  }

  // Add total level row (sticky)
  tableHtml += '<tr class="sticky-total-row level-total-row">';
  tableHtml += '<td style="font-weight: bold; font-size: 1.1em;">Total Level</td>';

  // Calculate total levels for each player
  const totalLevels = players.map(player => {
    const total = skills.reduce((sum, skill) => {
      return sum + (playerLevels[player]?.[skill] ?? 0);
    }, 0);
    return { player, total };
  });

  const totalRankings = computeRankings(totalLevels, 'total');

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const totalLevel = totalLevels[i].total;
    let levelClass = 'level-low';
    if (totalLevel >= 1600) levelClass = 'level-high';
    else if (totalLevel >= 1000) levelClass = 'level-medium';

    const rankingClass = getRankingClass(totalLevel, totalRankings[player]);

    tableHtml += `<td class="level-cell ${levelClass}${rankingClass}" data-player="${player}" data-skill="Total Level" data-level="${totalLevel}" style="font-size: 1.1em;">${totalLevel}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function generateAchievementDiaryComparisonTable(comparisonData) {
  const { players, achievements, playerAchievements } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare achievement diaries.</p>";
  }

  let tableHtml = '<div class="sunken-panel" role="region" aria-label="Achievement diary comparison" tabindex="0" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive sticky-header achievement-diaries-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Achievement Diary</th>';
  for (const player of players) {
    tableHtml += `<th>${playerNameHtml(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const achievement of achievements) {
    tableHtml += `<tr><td colspan="${players.length + 1}" style="background-color: var(--body-mid); font-weight: bold; text-align: center;"><span class="icon-label">${osrsIcon('Achievement_Diaries_icon')}${escapeHtml(achievement)}</span></td></tr>`;

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
          statusText = '\u2713';
        } else if (status === false) {
          statusClass = 'diary-partial';
          statusText = '\u2717';
        } else {
          statusClass = 'diary-not-started';
          statusText = '-';
        }
        const statusLabel = status === true ? 'Completed' : status === false ? 'In progress' : 'Not started';
        tableHtml += `<td class="${statusClass}" aria-label="${statusLabel}" title="${statusLabel}" style="text-align: center;">${statusText}</td>`;
      }
      tableHtml += '</tr>';
    }
  }
  // Add sticky totals row for diaries
  tableHtml += '<tr class="sticky-total-row achievement-diaries-total-row">';
  tableHtml += '<td style="font-weight: bold; font-size: 1.1em;">Total Completed</td>';

  // Calculate total number of completed diary difficulties per player
  const difficulties = ['Easy', 'Medium', 'Hard', 'Elite'];
  const totals = players.map(player => {
    let total = 0;
    for (const achievement of achievements) {
      const playerData = playerAchievements[player]?.[achievement];
      if (!playerData) continue;
      for (const diff of difficulties) {
        const d = playerData[diff];
        if (d && Array.isArray(d.tasks) && d.tasks.length > 0 && d.tasks.every(t => t)) {
          total += 1;
        }
      }
    }
    return total;
  });

  // Rankings
  const totalsForRanking = players.map((player, idx) => ({ player, total: totals[idx] }));
  const totalRankings = computeRankings(totalsForRanking, 'total');

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const total = totals[i];
    const rankingClass = getRankingClass(total, totalRankings[player]);
    tableHtml += `<td class="level-cell${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function generateCombatAchievementsComparisonTable(comparisonData) {
  const { players, playerCombatAchievements, combatAchievementsData } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare combat achievements.</p>";
  }

  // Get all available achievements from the metadata and filter for completed ones
  const allAchievements = Object.values(combatAchievementsData).filter(achievement => {
    const numericTaskId = parseInt(achievement.taskId);
    return players.some(player => {
      const playerAchievements = playerCombatAchievements[player] || [];
      return playerAchievements.includes(numericTaskId);
    });
  });

  // Sort achievements by tier and name
  const sortedAchievements = allAchievements.sort((a, b) => {
    const tierA = TIER_ORDER[a.tier] || 999;
    const tierB = TIER_ORDER[b.tier] || 999;

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Then sort by name
    return a.name.localeCompare(b.name);
  });

  let tableHtml = '<div class="sunken-panel" role="region" aria-label="Combat achievement comparison" tabindex="0" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive sticky-header combat-achievements-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th style="width: 50px;">Tier</th><th>Monster</th><th>Achievement</th>';
  for (const player of players) {
    tableHtml += `<th style="width: 80px;">${playerNameHtml(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';

  for (const achievement of sortedAchievements) {
    const numericTaskId = parseInt(achievement.taskId);
    const statuses = players.map(player => {
      const playerAchievements = playerCombatAchievements[player] || [];
      return playerAchievements.includes(numericTaskId);
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
    tableHtml += `<td style="text-align: center;"><img src="${safeWikiUrl(achievement.tierIconUrl)}" alt="${escapeHtml(achievement.tier)}" width="24" height="24" style="image-rendering: pixelated;"></td>`;

    // Monster name with link (if available)
    if (achievement.monster && achievement.monster !== 'N/A' && achievement.monsterWikiLink) {
      tableHtml += `<td><a href="${safeWikiUrl(achievement.monsterWikiLink)}" target="_blank" rel="noopener noreferrer" ><span class="icon-label">${entityIcon(achievement.monster)}${escapeHtml(achievement.monster)}</span></a></td>`;
    } else {
      tableHtml += `<td style="color: #666; font-style: italic;">${escapeHtml(achievement.monster || 'Various')}</td>`;
    }

    // Achievement name with link
    tableHtml += `<td><a href="${safeWikiUrl(achievement.nameWikiLink)}" target="_blank" rel="noopener noreferrer"  title="${escapeHtml(achievement.description)}">${escapeHtml(achievement.name)}</a></td>`;

    // Player columns
    for (const status of statuses) {
      let statusClass = status ? 'combat-achievement-completed' : 'combat-achievement-not-completed';
      let statusText = status ? '\u2713' : '\u2717';
      const statusLabel = status ? 'Completed' : 'Not completed';
      tableHtml += `<td class="${statusClass}" aria-label="${statusLabel}" title="${statusLabel}" style="text-align: center;">${statusText}</td>`;
    }

    tableHtml += '</tr>';
  }

  // Add total achievements row (sticky at bottom)
  tableHtml += '<tr class="sticky-total-row combat-achievements-total-row">';
  tableHtml += '<td></td>';
  tableHtml += '<td></td>';
  tableHtml += '<td style="font-size: 1.1em;">Total Achievements</td>';

  // Calculate total achievements for each player
  const totalAchievements = players.map(player => ({
    player,
    total: playerCombatAchievements[player]?.length ?? 0
  }));

  const totalRankings = computeRankings(totalAchievements, 'total');

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const total = totalAchievements[i].total;
    const rankingClass = getRankingClass(total, totalRankings[player]);

    tableHtml += `<td class="level-cell${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function generateMusicTracksComparisonTable(comparisonData, musicTracksData) {
  const { players, musicTracks, playerMusicTracks } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare music tracks.</p>";
  }

  let tableHtml = '<div class="sunken-panel" role="region" aria-label="Music track comparison" tabindex="0" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive sticky-header music-tracks-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Music Track</th>';
  for (const player of players) {
    tableHtml += `<th>${playerNameHtml(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const track of musicTracks) {
    const statuses = players.map(player => {
      const playerData = playerMusicTracks[player];
      if (!playerData || !Object.hasOwn(playerData, track)) return null;
      return playerData[track] === true;
    });

    let rowClass = '';
    const unlockedCount = statuses.filter(s => s === true).length;
    const knownCount = statuses.filter(s => s !== null).length;
    if (knownCount === 0) {
      rowClass = 'music-track-unknown';
    } else if (unlockedCount === players.length) {
      rowClass = 'music-track-unlocked';
    } else if (unlockedCount > 0) {
      rowClass = 'diary-partial';
    } else {
      rowClass = 'music-track-locked';
    }

    tableHtml += `<tr class="${rowClass}">`;
    const meta = musicTracksData && musicTracksData[track];
    if (meta && meta.nameWikiLink) {
      tableHtml += `<td><a href="${safeWikiUrl(meta.nameWikiLink)}" target="_blank" rel="noopener noreferrer" ><span class="icon-label">${osrsIcon('Music')}${escapeHtml(track)}</span></a></td>`;
    } else {
      tableHtml += `<td><span class="icon-label">${osrsIcon('Music')}${escapeHtml(track)}</span></td>`;
    }

    for (const status of statuses) {
      let statusClass = '';
      let statusText = '';
      if (status === true) {
        statusClass = 'music-track-unlocked';
        statusText = '\u2713';
      } else if (status === false) {
        statusClass = 'music-track-locked';
        statusText = '\u2717';
      } else {
        statusClass = 'music-track-unknown';
        statusText = '?';
      }
      const statusLabel = status === true ? 'Unlocked' : status === false ? 'Locked' : 'Not exposed by WikiSync';
      tableHtml += `<td class="${statusClass}" aria-label="${statusLabel}" title="${statusLabel}" style="text-align: center;">${statusText}</td>`;
    }
    tableHtml += '</tr>';
  }

  // Add total music tracks row
  tableHtml += '<tr class="sticky-total-row music-tracks-total-row">';
  tableHtml += '<td style="font-size: 1.1em; font-weight: bold;">Total Tracks</td>';

  // Calculate total unlocked tracks for each player
  const totalTracks = players.map(player => {
    const tracksObj = playerMusicTracks[player] || {};
    const total = Object.values(tracksObj).reduce((sum, unlocked) => sum + (unlocked === true ? 1 : 0), 0);
    return { player, total };
  });

  const totalRankings = computeRankings(totalTracks, 'total');

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const total = totalTracks[i].total;
    const rankingClass = getRankingClass(total, totalRankings[player]);

    tableHtml += `<td class="level-cell${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function generateCollectionLogComparisonTable(comparisonData) {
  const { players, playerCollectionLogs, playerCollectionTotals = {}, collectionLogData } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare collection logs.</p>";
  }

  const allItems = Object.values(collectionLogData).filter(item => {
    const numericId = parseInt(item.itemId);
    return players.some(player =>
      playerCollectionLogs[player] && playerCollectionLogs[player].includes(numericId)
    );
  });

  let tableHtml = '<div class="sunken-panel" role="region" aria-label="Collection log comparison" tabindex="0" style="height: 400px; overflow: auto;">';

  tableHtml += '<table class="interactive sticky-header collection-log-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr>';
  tableHtml += '<th style="width: 50px;">Icon</th>';
  tableHtml += '<th>Item</th>';
  for (const player of players) {
    tableHtml += `<th style="width: 80px;">${playerNameHtml(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';

  for (const item of allItems) {
    const numericId = parseInt(item.itemId);

    // Calculate how many players have this item
    const playersWithItem = players.filter(player =>
      playerCollectionLogs[player] && playerCollectionLogs[player].includes(numericId)
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
    tableHtml += `<td style="text-align: center;"><img src="${safeWikiUrl(item.itemIcon)}" alt="${escapeHtml(item.itemName)}" width="32" height="32" loading="lazy" onerror="this.onerror=null;this.src='/icons/osrs/Collection_log.png'" style="image-rendering: pixelated;"></td>`;

    // Item name
    tableHtml += `<td><a href="${safeWikiUrl(item.itemLink)}" target="_blank" rel="noopener noreferrer" >${escapeHtml(item.itemName)}</a></td>`;

    // Player columns
    for (const player of players) {
      const hasItem = playerCollectionLogs[player] && playerCollectionLogs[player].includes(numericId);
      let statusClass = hasItem ? 'collection-has-item' : 'collection-missing-item';
      let statusText = hasItem ? '\u2713' : '\u2717';
      const statusLabel = hasItem ? 'Collected' : 'Not collected';
      tableHtml += `<td class="${statusClass}" aria-label="${statusLabel}" title="${statusLabel}" style="text-align: center;">${statusText}</td>`;
    }

    tableHtml += '</tr>';
  }

  // Add total items row
  tableHtml += '<tr class="sticky-total-row collection-log-total-row">';
  tableHtml += '<td></td>';
  tableHtml += '<td style="font-size: 1.1em;">Total Items</td>';

  // Calculate total items for each player
  const totalItems = players.map(player => ({
    player,
    total: Number.isFinite(playerCollectionTotals[player])
      ? playerCollectionTotals[player]
      : (playerCollectionLogs[player]?.length ?? 0)
  }));

  const totalRankings = computeRankings(totalItems, 'total');

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const total = totalItems[i].total;
    const rankingClass = getRankingClass(total, totalRankings[player]);

    tableHtml += `<td class="level-cell${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function generateActivitiesComparisonTable(comparisonData) {
  const { players, activities, playerActivities } = comparisonData;
  if (players.length === 0) {
    return "<p>No player data found to compare activities.</p>";
  }

  let tableHtml = '<div class="sunken-panel" role="region" aria-label="Activities comparison" tabindex="0" style="height: 400px; overflow: auto;">';
  tableHtml += '<table class="interactive sticky-header activities-comparison-table" style="width: 100%;">';

  // Header
  tableHtml += '<thead><tr><th>Activity</th>';
  for (const player of players) {
    tableHtml += `<th>${playerNameHtml(player)}</th>`;
  }
  tableHtml += '</tr></thead>';

  // Body
  tableHtml += '<tbody>';
  for (const activity of activities) {
    tableHtml += '<tr>';
    tableHtml += `<td><span class="icon-label">${entityIcon(activity)}${escapeHtml(activity)}</span></td>`;

    const activityScores = players.map(player => ({
      player,
      score: playerActivities[player]?.[activity] ?? 0
    }));

    const rankings = computeRankings(activityScores, 'score');

    for (const player of players) {
      const score = playerActivities[player]?.[activity] ?? 0;
      let scoreClass = 'level-low';
      if (score >= 100) scoreClass = 'level-high';
      else if (score >= 10) scoreClass = 'level-medium';

      const rankingClass = getRankingClass(score, rankings[player]);

      tableHtml += `<td class="level-cell ${scoreClass}${rankingClass}" data-player="${escapeHtml(player)}" data-activity="${escapeHtml(activity)}" data-score="${score}">${score}</td>`;
    }
    tableHtml += '</tr>';
  }

  // Add total activities row
  tableHtml += '<tr class="sticky-total-row activities-total-row">';
  tableHtml += '<td style="font-weight: bold; font-size: 1.1em;">Activities with Progress</td>';

  // Different activities use incomparable units, so count active categories rather than summing scores.
  const totalActivities = players.map(player => ({
    player,
    total: playerActivities[player] ? Object.values(playerActivities[player]).filter(score => score > 0).length : 0
  }));

  const totalRankings = computeRankings(totalActivities, 'total');

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const total = totalActivities[i].total;
    const rankingClass = getRankingClass(total, totalRankings[player]);

    tableHtml += `<td class="level-cell ${rankingClass}" data-player="${player}" data-total="${total}" style="font-size: 1.1em; text-align: center;">${total}</td>`;
  }
  tableHtml += '</tr>';

  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

const ENTITY_ICONS = {
  "Abyssal Sire": "Abyssal_Sire_icon",
  "Alchemical Hydra": "Alchemical_Hydra_icon",
  "Amoxliatl": "Amoxliatl",
  "Araxxor": "Araxxor",
  "Artio": "Artio",
  "Basilisk Knight": "Basilisk_Knight_icon",
  "Bloodveld": "Bloodveld_icon",
  "Brutus": "Brutus",
  "Bryophyta": "Bryophyta_icon",
  "Callisto": "Callisto",
  "Calvar'ion": "Calvar'ion",
  "Cerberus": "Cerberus_icon",
  "Chaos Elemental": "Chaos_Elemental",
  "Chaos Fanatic": "Chaos_Fanatic",
  "Clue Scrolls (all)": "Clue_scroll_(master)",
  "Clue Scrolls (beginner)": "Clue_scroll_(master)",
  "Clue Scrolls (easy)": "Clue_scroll_(master)",
  "Clue Scrolls (elite)": "Clue_scroll_(master)",
  "Clue Scrolls (hard)": "Clue_scroll_(master)",
  "Clue Scrolls (master)": "Clue_scroll_(master)",
  "Clue Scrolls (medium)": "Clue_scroll_(master)",
  "Commander Zilyana": "Commander_Zilyana_icon",
  "Corporeal Beast": "Corporeal_Beast_icon",
  "Corrupted Hunllef": "Corrupted_Hunllef",
  "Crystalline Hunllef": "Crystalline_Hunllef_icon",
  "Dagannoth Prime": "Dagannoth_Prime",
  "Dagannoth Rex": "Dagannoth_Rex",
  "Dagannoth Supreme": "Dagannoth_Supreme",
  "Doom of Mokhaiotl": "Doom_of_Mokhaiotl",
  "Duke Sucellus": "Duke_Sucellus",
  "Fortis Colosseum": "Fortis_Colosseum",
  "Fragment of Seren": "Fragment_of_Seren",
  "Galvek": "Galvek",
  "Gargoyle": "Gargoyle_icon",
  "General Graardor": "General_Graardor_icon",
  "Giant Mole": "Giant_Mole_icon",
  "Glough": "Glough",
  "Grotesque Guardians": "Grotesque_Guardians_icon",
  "Hellhound": "Hellhound_icon",
  "Hespori": "Hespori_icon",
  "K'ril Tsutsaroth": "K'ril_Tsutsaroth_icon",
  "Kalphite Queen": "Kalphite_Queen_icon",
  "King Black Dragon": "King_Black_Dragon_icon",
  "Kraken": "Kraken_icon",
  "Kree'arra": "Kree'arra_icon",
  "Kurask": "Kurask_icon",
  "Leviathan": "Leviathan",
  "Mad Angel": "Mad_Angel",
  "Maggot King": "Maggot_King",
  "Mimic": "Mimic",
  "Nex": "Nex_icon",
  "Obor": "Obor_icon",
  "Rifts closed": "Runecraft_icon",
  "Sarachnis": "Sarachnis_icon",
  "Scorpia": "Scorpia",
  "Scurrius": "Scurrius",
  "Sea charting tasks": "Sailing_icon",
  "Shellbane gryphon": "Shellbane_gryphon",
  "Skeletal Wyvern": "Skeletal_Wyvern_icon",
  "Skotizo": "Skotizo_icon",
  "Spindel": "Spindel",
  "Tempoross": "Tempoross_icon",
  "The Corrupted Gauntlet": "Corrupted_Hunllef",
  "The Gauntlet": "Crystalline_Hunllef_icon",
  "The Hueycoatl": "The_Hueycoatl",
  "The Leviathan": "The_Leviathan",
  "The Mimic": "The_Mimic_icon",
  "The Nightmare": "The_Nightmare_icon",
  "The Whisperer": "The_Whisperer",
  "Tombs of Amascut": "Combat_icon",
  "Tombs of Amascut: Expert Mode": "Combat_icon",
  "TzHaar-Ket-Rak's Challenges": "TzHaar-Ket-Rak's_Challenges",
  "TzKal-Zuk": "TzKal-Zuk_icon",
  "TzTok-Jad": "TzTok-Jad",
  "Vardorvis": "Vardorvis",
  "Venenatis": "Venenatis",
  "Vet'ion": "Vet'ion",
  "Vorkath": "Vorkath_icon",
  "Wintertodt": "Wintertodt_icon",
  "Wyrm": "Wyrm_icon",
  "Yama": "Yama",
  "Zalcano": "Zalcano_icon",
  "Zulrah": "Zulrah_icon"
};

function entityIcon(name) {
  const exact = ENTITY_ICONS[name];
  const activity = Object.keys(ENTITY_ICONS).sort((a, b) => b.length - a.length).find(key => name?.startsWith(`${key} (`));
  return osrsIcon(exact || ENTITY_ICONS[activity] || 'Combat_icon');
}

function achievementIcon(achievement) {
  if (achievement.type === 'level' && SKILL_ICONS.has(achievement.skill)) return osrsIcon(`${achievement.skill}_icon`);
  if (achievement.type === 'activity') return entityIcon(achievement.name);
  return osrsIcon(ACTIVITY_ICONS[achievement.type]);
}

const ACTIVITY_ICONS = {
  level: 'Skills_icon', quest: 'Quest_point_icon', diary: 'Achievement_Diaries_icon',
  combat: 'Combat_icon', activity: 'Combat_icon', collection: 'Collection_log',
  collection_item: 'Collection_log', music: 'Music', sea_charting: 'Sailing_icon'
};
const SKILL_ICONS = new Set(["Agility", "Attack", "Construction", "Cooking", "Crafting", "Defence", "Farming", "Firemaking", "Fishing", "Fletching", "Herblore", "Hitpoints", "Hunter", "Magic", "Mining", "Prayer", "Ranged", "Runecraft", "Sailing", "Slayer", "Smithing", "Strength", "Thieving", "Woodcutting"]);
function osrsIcon(filename) {
  return filename ? `<img class="osrs-icon" src="/icons/osrs/${encodeURIComponent(filename)}.png" width="20" height="20" alt="" aria-hidden="true" loading="lazy">` : '';
}

const TYPE_DISPLAY_NAMES = {
  collection_item: { singular: 'Collection Item', plural: 'Collection Items' },
  activity: { singular: 'Activity', plural: 'Activities' },
  sea_charting: { singular: 'Sea Charting', plural: 'Sea Charting' }
};

function formatTypeName(type, plural) {
  const override = TYPE_DISPLAY_NAMES[type];
  if (override) return plural ? override.plural : override.singular;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function generateAchievementSummary(achievements) {
  if (!achievements.length) return '<p class="achievement-summary-empty">No updates match the selected players and filter.</p>';
  const players = new Map();
  const types = new Map();
  for (const item of achievements) {
    const player = players.get(item.player) || { name: item.displayName || getDisplayName(item.player), playerKey: item.player, count: 0 };
    player.count++;
    players.set(item.player, player);
    const name = formatTypeName(item.type, true);
    const entry = types.get(name) || {name, count: 0, icon: ACTIVITY_ICONS[item.type]};
    entry.count++;
    types.set(name, entry);
  }
  const list = entries => `<dl class="achievement-counts">${entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map(item => `<div><dt>${osrsIcon(item.icon)}${item.playerKey ? playerNameHtml(item.playerKey, item.name) : escapeHtml(item.name)}</dt><dd>${item.count.toLocaleString()}</dd></div>`).join('')}</dl>`;
  return `<div class="achievement-summary-heading"><strong>${achievements.length.toLocaleString()} recorded update${achievements.length === 1 ? '' : 's'}</strong><span>Last 30 days · selected players${showOnlyMajorAchievements ? ' · major milestones' : ''}</span></div>
    <div class="achievement-breakdown"><section aria-label="Updates by player"><h3>By player</h3>${list([...players.values()])}</section>
    <section aria-label="Updates by activity"><h3>By activity</h3>${list([...types.values()])}</section></div>`;
}

function generateAchievementsTable(achievementsData) {
  if (achievementsData.length === 0) {
    return "<p>No recent achievements found. Check back after more player data is collected!</p>";
  }

  const majorAchievementsCount = achievementsData.filter(achievement => achievement.isMajorAchievement).length;
  let tableHtml = `<div id="achievement-summary">${generateAchievementSummary(achievementsData)}</div>`;
  tableHtml += '<div class="achievements-controls">';
  tableHtml += `<button id="toggle-major-achievements" type="button" aria-pressed="false" data-filter-state="all"${majorAchievementsCount === 0 ? ' disabled' : ''}>Major only (${majorAchievementsCount})</button>`;
  tableHtml += '<span id="major-achievements-hint">Major milestones: level 99s and newly earned quest capes.</span></div>';
  tableHtml += '<div class="sunken-panel achievement-feed" role="region" aria-label="Recent achievements" tabindex="0"><table class="interactive sticky-header">';

  // Header
  tableHtml += '<thead><tr><th>Player</th><th>Achievement</th><th>Type</th><th>Date</th></tr></thead>';

  // Body
  tableHtml += '<tbody>';
  const now = new Date();
  const nowMs = now.getTime();
  for (const achievement of achievementsData) {
    const ts = new Date(achievement.timestamp);
    const tsMs = ts.getTime();
    const configuredColor = playerColors[achievement.player];
    const playerColor = /^#[0-9a-f]{6}$/i.test(configuredColor || '') ? configuredColor : '#999999';

    const isMajor = achievement.isMajorAchievement === true;

    // Format date as relative time
    const relativeTimeDiff = nowMs - tsMs;
    const minutes = Math.floor(relativeTimeDiff / (1000 * 60));
    const hours = Math.floor(relativeTimeDiff / (1000 * 60 * 60));
    const days = Math.floor(relativeTimeDiff / (1000 * 60 * 60 * 24));

    let dateWithTime;
    if (minutes < 1) {
      dateWithTime = 'Just now';
    } else if (minutes < 60) {
      dateWithTime = `${minutes}min ago`;
    } else if (hours < 24) {
      dateWithTime = `${hours}h ago`;
    } else if (days < 7) {
      dateWithTime = `${days}d ago`;
    } else {
      dateWithTime = ts.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour12: false,
        timeZone: 'Europe/Vilnius'
      });
    }

    tableHtml += `<tr data-is-major="${isMajor ? 'true' : 'false'}">`;
    tableHtml += `<td><strong style="color: ${playerColor};">${escapeHtml(achievement.displayName)}</strong></td>`;

    // Handle combat achievements with tier icons and links
    if (achievement.type === 'combat' && achievement.tierIconUrl && achievement.nameWikiLink) {
      tableHtml += `<td class="achievement-description">`;
      tableHtml += `<img src="${safeWikiUrl(achievement.tierIconUrl)}" alt="Tier" width="20" height="20" style="image-rendering: pixelated;">`;
      tableHtml += `<a href="${safeWikiUrl(achievement.nameWikiLink)}" target="_blank" rel="noopener noreferrer"  title="${escapeHtml(achievement.description || '')}">${escapeHtml(achievement.name)}</a>`;
      tableHtml += `</td>`;
    }
    // Handle collection log items with item icons and links
    else if (achievement.type === 'collection_item' && achievement.itemIcon && achievement.itemLink) {
      tableHtml += `<td class="achievement-description">`;
      tableHtml += `<img src="${safeWikiUrl(achievement.itemIcon)}" alt="${escapeHtml(achievement.name)}" width="20" height="20" style="image-rendering: pixelated;" loading="lazy" onerror="this.onerror=null;this.src='/icons/osrs/Collection_log.png'">`;
      tableHtml += `<a href="${safeWikiUrl(achievement.itemLink)}" target="_blank" rel="noopener noreferrer" >${escapeHtml(achievement.name)}</a>`;
      tableHtml += `</td>`;
    } else if (achievement.type === 'activity' && achievement.activityIcon && achievement.activityLink) {
      tableHtml += `<td class="achievement-description">`;
      tableHtml += `<img src="${safeWikiUrl(achievement.activityIcon)}" alt="${escapeHtml(achievement.name)}" width="20" height="20" style="image-rendering: pixelated;" loading="lazy" onerror="this.onerror=null;this.src='/icons/osrs/Collection_log.png'">`;
      tableHtml += `<a href="${safeWikiUrl(achievement.activityLink)}" target="_blank" rel="noopener noreferrer" >${escapeHtml(achievement.name)}</a>`;
      tableHtml += `</td>`;
    } else if (achievement.type === 'level' && achievement.isMaxLevel) {
      // Highlight level 99 milestones with a golden badge and star
      tableHtml += `<td class="achievement-description">` +
        `${achievementIcon(achievement)}` +
        `<span class="badge-99" style="background: #FFD700; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold;">99</span>` +
        `<span>${escapeHtml(achievement.name)}</span>` +
        `</td>`;
    } else {
      tableHtml += `<td><span class="icon-label">${achievementIcon(achievement)}${escapeHtml(achievement.name)}</span></td>`;
    }

    tableHtml += `<td><span class="icon-label">${osrsIcon(ACTIVITY_ICONS[achievement.type])}${formatTypeName(achievement.type, false)}</span></td>`;
    tableHtml += `<td>${dateWithTime}</td>`;
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table></div>';

  return tableHtml;
}

function formatSnapshotTime(value) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return 'Snapshot time unavailable';
  return `Snapshot ${timestamp.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Vilnius'
  })}`;
}

function sailingProgressPercentage(completed, total) {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (completed / total) * 100));
}

function sailingProgressBar(completed, total, label) {
  const percentage = sailingProgressPercentage(completed, total);
  return `
    <div class="sailing-progress-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}">
      <span style="width: ${percentage.toFixed(2)}%;"></span>
    </div>`;
}

function setSailingExplorerPlayer(player) {
  sailingExplorerPlayer = player;
  renderSeaChartingExplorer(getSelectedPlayers());
  document.getElementById('sailing-explorer-player')?.focus();
}

function setSailingExplorerStatus(status) {
  sailingExplorerStatus = ['all', 'missing', 'completed'].includes(status) ? status : 'missing';
  renderSeaChartingExplorer(getSelectedPlayers());
  document.getElementById('sailing-explorer-status')?.focus();
}

function setSailingExplorerGroup(group) {
  sailingExplorerGroup = group;
  renderSeaChartingExplorer(getSelectedPlayers());
  document.getElementById('sailing-explorer-group')?.focus();
}

function sailingExplorerMarkup(data, player, selectablePlayers) {
  const progress = data.playerProgress[player];
  const allGroups = data.completionGroups.map(group => group.name);
  if (sailingExplorerGroup !== 'all' && !allGroups.includes(sailingExplorerGroup)) {
    sailingExplorerGroup = 'all';
  }

  const groupOptions = data.completionGroups.map(group =>
    `<option value="${escapeHtml(group.name)}" ${group.name === sailingExplorerGroup ? 'selected' : ''}>${escapeHtml(group.name)}</option>`
  ).join('');
  const playerOptions = selectablePlayers.map(playerName =>
    `<option style="color:${safePlayerColor(playerName)}" value="${escapeHtml(playerName)}" ${playerName === player ? 'selected' : ''}>${escapeHtml(getDisplayName(playerName))}</option>`
  ).join('');

  const controls = `
    <div class="sailing-explorer-controls">
      <label>Player
        <select id="sailing-explorer-player" style="color:${safePlayerColor(player)}" onchange="setSailingExplorerPlayer(this.value)">${playerOptions}</select>
      </label>
      <label>Chart area
        <select id="sailing-explorer-group" onchange="setSailingExplorerGroup(this.value)">
          <option value="all" ${sailingExplorerGroup === 'all' ? 'selected' : ''}>All areas</option>
          ${groupOptions}
        </select>
      </label>
      <label>Status
        <select id="sailing-explorer-status" onchange="setSailingExplorerStatus(this.value)">
          <option value="missing" ${sailingExplorerStatus === 'missing' ? 'selected' : ''}>Missing</option>
          <option value="completed" ${sailingExplorerStatus === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="all" ${sailingExplorerStatus === 'all' ? 'selected' : ''}>All</option>
        </select>
      </label>
    </div>`;

  if (!progress?.available) {
    return `${controls}<p class="empty-panel-message">WikiSync has not supplied sea-charting progress for this player yet.</p>`;
  }

  const completed = new Set(progress.completedTaskIds);
  const filteredTasks = data.tasks.filter(task => {
    const groupMatches = sailingExplorerGroup === 'all' || task.completionGroup === sailingExplorerGroup;
    const isCompleted = completed.has(task.taskId);
    const statusMatches = sailingExplorerStatus === 'all'
      || (sailingExplorerStatus === 'completed' && isCompleted)
      || (sailingExplorerStatus === 'missing' && !isCompleted);
    return groupMatches && statusMatches;
  });

  const grouped = new Map();
  for (const task of filteredTasks) {
    if (!grouped.has(task.completionGroup)) grouped.set(task.completionGroup, new Map());
    const seas = grouped.get(task.completionGroup);
    if (!seas.has(task.sea)) seas.set(task.sea, []);
    seas.get(task.sea).push(task);
  }

  const groupOrder = ['Ardent Ocean', 'Unquiet Ocean', 'Shrouded Ocean', 'Western Ocean', 'Northern Ocean', 'Sunset Ocean', 'Miscellaneous'];
  const groupRank = groupName => {
    const index = groupOrder.indexOf(groupName);
    return index === -1 ? groupOrder.length : index;
  };
  const groupHtml = [...grouped.entries()]
    .sort(([left], [right]) => groupRank(left) - groupRank(right) || left.localeCompare(right))
    .map(([groupName, seas]) => {
      const group = data.completionGroups.find(item => item.name === groupName);
      const groupCompleted = group.taskIds.filter(taskId => completed.has(taskId)).length;
      const seaHtml = [...seas.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([seaName, tasks]) => {
        const allSeaTasks = data.tasks.filter(task =>
          task.sea === seaName && task.completionGroup === groupName
        );
        const seaCompleted = allSeaTasks.filter(task => completed.has(task.taskId)).length;
        const seaLink = tasks[0]?.seaWikiLink;
        const taskHtml = tasks.sort((a, b) => a.level - b.level || a.taskId - b.taskId).map(task => {
          const isCompleted = completed.has(task.taskId);
          const details = [
            `Level ${task.level}`,
            task.type,
            task.isBonusChart ? 'Bonus chart' : null,
            task.hazard ? `Hazard: ${task.hazard}` : null
          ].filter(Boolean).join(' \u00b7 ');
          return `
            <li class="sailing-task ${isCompleted ? 'is-complete' : 'is-missing'}">
              <span class="sailing-task-state" aria-hidden="true">${isCompleted ? '\u2713' : '\u25a1'}</span>
              <span>
                <strong>${escapeHtml(details)}</strong>
                <span class="sailing-task-copy">${escapeHtml(task.task)}</span>
                <span class="visually-hidden">${isCompleted ? 'Completed' : 'Missing'}</span>
              </span>
            </li>`;
        }).join('');

        return `
          <details class="sailing-sea-group">
            <summary>
              <span>${escapeHtml(seaName)}</span>
              <strong>${seaCompleted}/${allSeaTasks.length}</strong>
            </summary>
            <div class="sailing-sea-body">
              ${seaLink ? `<a href="${safeWikiUrl(seaLink)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(seaName)} on the OSRS Wiki</a>` : ''}
              <ul class="sailing-task-list">${taskHtml}</ul>
            </div>
          </details>`;
      }).join('');

      const groupIsFiltered = sailingExplorerGroup === groupName;
      return `
        <details class="sailing-chart-group" aria-label="${escapeHtml(groupName)} sea-charting progress" ${groupIsFiltered ? 'open' : ''}>
          <summary class="sailing-chart-group-heading">
            <strong class="sailing-chart-group-title">${escapeHtml(groupName)}</strong>
            <span>${groupCompleted}/${group.taskIds.length}</span>
          </summary>
          <div class="sailing-chart-group-body">
            ${sailingProgressBar(groupCompleted, group.taskIds.length, `${groupName}: ${groupCompleted} of ${group.taskIds.length} tasks completed`)}
            ${seaHtml}
          </div>
        </details>`;
    }).join('');

  return `
    ${controls}
    <div class="sailing-explorer-results">
      ${groupHtml || '<p class="empty-panel-message">No charting tasks match these filters.</p>'}
    </div>`;
}

function renderSailingProgress(selectedPlayers = getSelectedPlayers()) {
  const container = document.getElementById('sailing-progress-container');
  const data = tableData?.sailing;
  if (!container || !data) return;

  const players = data.players.filter(player => selectedPlayers.includes(player));
  if (players.length === 0) {
    container.innerHTML = '<p class="empty-panel-message">Select at least one player to see Sailing progress.</p>';
    return;
  }

  const cards = players.map(player => {
    const progress = data.playerProgress[player];
    const completed = progress.available ? progress.completedTaskIds.length : null;
    const charts = completed === null ? 'No WikiSync data' : `${completed}/${data.totalTasks} charted`;
    const unknown = progress.unknownTaskIds.length > 0
      ? `<span class="sailing-metadata-warning">${progress.unknownTaskIds.length} newer task ID${progress.unknownTaskIds.length === 1 ? '' : 's'} awaiting metadata</span>`
      : '';
    return `
      <article class="sailing-player-card" style="--player-accent: ${safePlayerColor(player)};">
        <div class="sailing-player-heading">
          <strong>${playerNameHtml(player)}</strong>
          <span>Sailing ${progress.sailingLevel ?? '\u2014'}</span>
        </div>
        <div class="sailing-player-total">${escapeHtml(charts)}</div>
        ${completed === null ? '' : sailingProgressBar(completed, data.totalTasks, `${getDisplayName(player)}: ${completed} of ${data.totalTasks} sea-charting tasks completed`)}
        ${unknown}
      </article>`;
  }).join('');

  container.innerHTML = `
    <div class="sailing-intro">
      <strong>Fleet progress</strong>
      <span>Latest Sailing level and Captain's log completion across ${data.totalTasks} charts.</span>
      <a href="${safeWikiUrl(data.sourceUrl)}" target="_blank" rel="noopener noreferrer">OSRS Wiki source</a>
    </div>
    <div class="sailing-player-grid">${cards}</div>
    <p class="sailing-data-note">Completion comes from each player's latest WikiSync snapshot; it does not confirm that an island was visited.</p>`;
}

function renderSeaChartingExplorer(selectedPlayers = getSelectedPlayers()) {
  const container = document.getElementById('sea-charting-explorer-container');
  const data = tableData?.sailing;
  if (!container || !data) return;

  const players = data.players.filter(player => selectedPlayers.includes(player));
  if (players.length === 0) {
    container.innerHTML = '<p class="empty-panel-message">Select at least one player to explore sea-charting tasks.</p>';
    return;
  }

  if (!players.includes(sailingExplorerPlayer)) sailingExplorerPlayer = players[0];
  container.innerHTML = `
    <div class="sailing-intro">
      <strong>Captain's log</strong>
      <span>Filter ${data.totalTasks} exact chart tasks by player, completion area and status.</span>
      <a href="${safeWikiUrl(data.sourceUrl)}" target="_blank" rel="noopener noreferrer">OSRS Wiki source</a>
    </div>
    <p class="sailing-data-note">Chart completion is from WikiSync; it is not proof that an island was visited, docked at or unlocked.</p>
    ${sailingExplorerMarkup(data, sailingExplorerPlayer, players)}`;
}

function renderTables() {
  document.getElementById('quest-table-container').innerHTML = generateQuestComparisonTable(tableData.quests);
  document.getElementById('level-table-container').innerHTML = generateLevelComparisonTable(tableData.levels);
  document.getElementById('diary-table-container').innerHTML = generateAchievementDiaryComparisonTable(tableData.achievementDiaries);
  document.getElementById('combat-achievements-table-container').innerHTML = generateCombatAchievementsComparisonTable(tableData.combatAchievements);
  document.getElementById('music-tracks-table-container').innerHTML = generateMusicTracksComparisonTable(tableData.musicTracks, tableData.musicTracksMetadata);
  document.getElementById('collection-log-table-container').innerHTML = generateCollectionLogComparisonTable(tableData.collectionLog);
  document.getElementById('activities-table-container').innerHTML = generateActivitiesComparisonTable(tableData.activities);
  document.getElementById('achievements-table-container').innerHTML = generateAchievementsTable(tableData.achievements);
  renderSailingProgress();
  renderSeaChartingExplorer();
}

let xpChartMode = 'gained';

function xpSeriesData(history, days, gained) {
  const cutoff = days === 'all' ? -Infinity : Date.now() - Number(days) * 86400000;
  const points = history.map(p => [Date.parse(p.timestamp), p.totalExp])
    .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .sort((a, b) => a[0] - b[0]).filter(p => p[0] >= cutoff);
  const baseline = points[0]?.[1] || 0;
  return points.map((p, i) => ({
    value: [p[0], gained ? p[1] - baseline : p[1]],
    total: p[1], delta: i && p[1] >= points[i - 1][1] ? p[1] - points[i - 1][1] : null
  }));
}

const chartHoveredSeries = new WeakMap();

function highlightTooltipPlayer(chart, seriesIndex) {
  chartHoveredSeries.set(chart, seriesIndex);
  chart.getDom().querySelectorAll('.chart-tooltip-entry').forEach(row => {
    row.classList.toggle('is-highlighted', Number(row.dataset.seriesIndex) === seriesIndex);
  });
}

function formatProgressTooltip(params, icon, xp, selectedSeries) {
  if (!params.length) return '';
  const number = value => Number(value).toLocaleString('en-US');
  const date = new Date(params[0].value[0]).toLocaleString('en-GB', { timeZone: 'Europe/Vilnius', dateStyle: 'medium', timeStyle: 'short' });
  const sorted = [...params].sort((a, b) => b.value[1] - a.value[1] || a.seriesName.localeCompare(b.seriesName));
  return `<div class="chart-tooltip-heading">${osrsIcon(icon)}${escapeHtml(date)}</div>` + sorted.map(p => {
    const color = /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#94866d';
    return `<div class="chart-tooltip-entry${p.seriesIndex === selectedSeries ? ' is-highlighted' : ''}" data-series-index="${Number(p.seriesIndex)}" style="--series-color:${color}">` +
      `<div class="chart-tooltip-row"><strong><span class="chart-tooltip-swatch"></span>${escapeHtml(p.seriesName)}</strong><span>${number(p.value[1])}${xp ? ' XP' : ''}</span></div>` +
      (xp ? `<div class="chart-tooltip-detail">Total ${number(p.data.total)} · ${p.data.delta === null ? 'No previous snapshot in range' : `+${number(p.data.delta)} since previous snapshot`}</div>` : '') + '</div>';
  }).join('');
}

function renderProgressChart(chart, datasets, { xp = false, skill = null } = {}) {
  const gained = xp && xpChartMode === 'gained';
  const isLog = xp && !gained && loadTotalXpLogScalePreference();
  const number = value => Number(value).toLocaleString('en-US');
  const series = datasets.map(dataset => ({
    name: dataset.label, type: 'line', triggerLineEvent: true, showSymbol: dataset.data.length === 1, symbolSize: 7,
    connectNulls: false, smooth: false,
    data: dataset.data.map(point => point.value ? point : ({ value: [new Date(point.x).getTime(), point.y] })),
    itemStyle: { color: dataset.borderColor }, lineStyle: { width: 2.5 },
    areaStyle: xp ? { opacity: 0.035 } : undefined,
    emphasis: { focus: 'series', lineStyle: { width: 3 }, areaStyle: { opacity: 0.16 } },
    blur: { lineStyle: { opacity: 0.12 }, itemStyle: { opacity: 0.12 }, areaStyle: { opacity: 0.01 } }
  }));
  const icon = xp ? 'Skills_icon' : skill && SKILL_ICONS.has(skill) ? `${skill}_icon` : chart === questChart ? 'Quest_point_icon' : 'Skills_icon';
  chart.setOption({
    animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationDuration: 450, animationDurationUpdate: 250,
    color: CHART_COLORS, textStyle: { fontFamily: 'Arial, sans-serif', color: '#514536' },
    aria: { enabled: true },
    grid: { left: 14, right: 24, top: 30, bottom: 30, containLabel: true },
    legend: { show: false },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: '#94866d' } }, axisTick: { show: false }, splitNumber: window.innerWidth < 600 ? 3 : 6, axisLabel: { hideOverlap: true } },
    yAxis: { type: isLog ? 'log' : 'value', min: gained ? 0 : undefined, scale: !gained, name: xp ? (gained ? 'XP gained' : 'Total XP') : (skill || (chart === questChart ? 'Quests completed' : 'Total level')),
      nameTextStyle: { align: 'left' }, splitLine: { lineStyle: { color: '#c5b89e', type: 'dashed' } },
      axisLabel: { formatter: v => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v) } },
    tooltip: { trigger: 'axis', confine: true, backgroundColor: '#eee8d9', borderColor: '#94866d', textStyle: { color: '#302a20' },
      axisPointer: { type: 'line', lineStyle: { color: '#94866d', type: 'dashed' } },
      formatter: params => formatProgressTooltip(params, icon, xp, chartHoveredSeries.get(chart))
    },
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, filterMode: 'none' }],
    graphic: series.some(s => s.data.length) ? [] : [{ type: 'text', left: 'center', top: 'middle', style: { text: 'No history for this selection', fill: '#514536' } }],
    series
  }, { replaceMerge: ['series', 'graphic'] });
  renderPlayerLegend(chart);
}

function renderPlayerLegend(chart) {
  const frame = chart.getDom().parentElement;
  let legend = frame.nextElementSibling;
  if (!legend?.classList.contains('chart-player-legend')) {
    legend = document.createElement('div');
    legend.className = 'chart-player-legend';
    legend.setAttribute('role', 'group');
    legend.setAttribute('aria-label', 'Players shown across the dashboard');
    frame.after(legend);
  }
  legend.replaceChildren();
  document.querySelectorAll('input[type="checkbox"][id^="player-"]').forEach(checkbox => {
    const player = checkbox.value;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.player = player;
    button.className = 'chart-player-toggle';
    button.setAttribute('aria-pressed', String(checkbox.checked));
    button.title = `${checkbox.checked ? 'Hide' : 'Show'} ${getDisplayName(player)} across all charts and widgets`;
    button.style.setProperty('--series-color', playerColors[player] || '#94866d');
    const swatch = document.createElement('span');
    swatch.className = 'chart-legend-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    button.append(swatch, document.createTextNode(getDisplayName(player)));
    button.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked;
      updatePlayerSelection();
      [...legend.querySelectorAll('button')].find(item => item.dataset.player === player)?.focus({ preventScroll: true });
    });
    const highlight = () => {
      if (!checkbox.checked) return;
      chart.dispatchAction({ type: 'highlight', seriesName: getDisplayName(player) });
    };
    const clear = () => chart.dispatchAction({ type: 'downplay', seriesName: getDisplayName(player) });
    button.addEventListener('mouseenter', highlight);
    button.addEventListener('focus', highlight);
    button.addEventListener('mouseleave', clear);
    button.addEventListener('blur', clear);
    legend.append(button);
  });
}

function initializeCharts() {
  for (const id of ['questChart', 'totalLevelChart', 'totalExpChart', 'skillLevelChart']) {
    const element = document.getElementById(id);
    const chart = echarts.init(element, null, { renderer: 'svg' });
    if (id === 'questChart') questChart = chart;
    if (id === 'totalLevelChart') totalLevelChart = chart;
    if (id === 'totalExpChart') totalExpChart = chart;
    if (id === 'skillLevelChart') skillLevelChart = chart;
    chart.on('mouseover', { componentType: 'series' }, event => highlightTooltipPlayer(chart, event.seriesIndex));
    chart.on('mouseout', { componentType: 'series' }, () => highlightTooltipPlayer(chart, null));
    chart.on('highlight', event => {
      const target = event.batch?.[0] || event;
      if (Number.isInteger(target.seriesIndex)) highlightTooltipPlayer(chart, target.seriesIndex);
    });
    chart.on('downplay', () => highlightTooltipPlayer(chart, null));
    chart.getZr().on('globalout', () => highlightTooltipPlayer(chart, null));
    new ResizeObserver(() => { if (element.clientWidth && element.clientHeight) chart.resize(); }).observe(element);
  }
  document.getElementById('xp-chart-mode').addEventListener('change', event => {
    xpChartMode = event.target.value;
    document.getElementById('btn-totalxp-scale').disabled = xpChartMode === 'gained';
    updateTotalExpChart(getSelectedPlayers());
  });
  document.getElementById('btn-totalxp-scale').disabled = true;
  const selectedPlayers = getSelectedPlayers();
  updateChart(selectedPlayers);
  updateTotalLevelChart(selectedPlayers);
  updateTotalExpChart(selectedPlayers);
  updateSkillLevelChart(selectedPlayers);
}

// Initialize everything and hide loading screen
function initializeApp() {
  // Note: init.js already applies initial states to prevent flashing

  // Render tables from JSON data
  renderTables();
  initializeWindowAccessibility();

  // Restore the period before creating charts so first render matches the control.
  loadTimePeriodPreference();
  initializeCharts();

  // Load all saved states (this will update checkboxes and other UI elements)
  if (document.body.dataset.layout !== 'wiki') loadWindowOrder();
  loadTimePeriodPreference();
  loadPlayerSelection();
  loadWindowVisibility();

  // Initialize interactive features
  initializeArticleNavigation();
  initializeTableSearch();
  initializeTotalXpScaleButton();
  initializeAchievementsFilter();

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

function initializeAutoRefresh() {
  const currentVersion = document.body.dataset.version;
  if (!currentVersion) return;
  let checking = false;
  async function checkForUpdate() {
    if (document.hidden || checking) return;
    checking = true;
    try {
      const response = await fetch('/', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      const html = await response.text();
      const version = html.match(/data-version="(\d+)"/)?.[1];
      if (version && Number(version) > Number(currentVersion)) location.reload();
    } catch {
      // Keep the current dashboard usable during network or server outages.
    } finally {
      checking = false;
    }
  }
  setInterval(checkForUpdate, 60000);
  document.addEventListener('visibilitychange', checkForUpdate);
}

async function boot() {
  try {
    await loadAppData();
    initializeApp();
    initializeAutoRefresh();
  } catch (error) {
    console.error('Failed to start OSRS Tracker:', error);
    const spinner = document.querySelector('.loading-spinner');
    const message = document.querySelector('.loading-subtext');
    if (spinner) spinner.style.display = 'none';
    if (message) {
      message.textContent = 'Dashboard data could not be loaded. Please refresh after the next tracker update.';
    }
  }
}

// Use observed endpoints only: do not invent gains at a missing period boundary.
function calculateXpTrend(history, days, now = Date.now()) {
  const day = 86400000;
  const points = history.map(p => ({ time: Date.parse(p.timestamp), xp: p.totalExp }))
    .filter(p => Number.isFinite(p.time) && Number.isFinite(p.xp) && p.xp >= 0 && p.time <= now)
    .sort((a, b) => a.time - b.time);
  function period(start, end) {
    const samples = points.filter(p => p.time >= start && p.time <= end);
    if (samples.length < 2) return null;
    const first = samples[0], last = samples[samples.length - 1];
    const span = (last.time - first.time) / day;
    if (span <= 0 || samples.some((p, i) => i > 0 && p.xp < samples[i - 1].xp)) return null;
    return { gain: last.xp - first.xp, rate: (last.xp - first.xp) / span, span,
      complete: span >= days - 2 && first.time - start <= day && end - last.time <= day };
  }
  const current = period(now - days * day, now);
  const previous = period(now - days * 2 * day, now - days * day);
  return { current, previous, latest: points.at(-1)?.time,
    change: current?.complete && previous?.complete && previous.rate > 0
      ? (current.rate / previous.rate - 1) * 100 : null };
}

function renderXpTrends(selectedPlayers) {
  const target = document.getElementById('xp-trends');
  if (!target) return;
  const days = Number(document.getElementById('xp-trend-period')?.value) || 30;
  const rows = selectedPlayers.map(player => ({ player, ...calculateXpTrend(xpHistory[player] || [], days) }))
    .sort((a, b) => (b.current?.rate ?? -1) - (a.current?.rate ?? -1));
  const number = value => Math.round(value).toLocaleString();
  if (!rows.length || rows.every(row => !row.current)) {
    target.innerHTML = `<p class="xp-trend-empty">${rows.length
      ? 'Not enough history for this period. XP pace appears after at least two snapshots on different days.'
      : 'Select players to compare their XP pace.'}</p>`;
    return;
  }
  target.innerHTML = `<div class="sunken-panel xp-trend-scroll" tabindex="0" role="region" aria-label="Recent XP pace"><table class="interactive xp-trend-table" aria-label="XP pace over the last ${days} days">
    <thead><tr><th scope="col">Player</th><th scope="col">XP gained</th><th scope="col">XP / day</th><th scope="col">Pace change</th><th scope="col">History</th></tr></thead>
    <tbody>${rows.map(row => {
      const c = row.current;
      const change = row.change === null ? '—' : `${row.change > 0 ? '+' : ''}${Math.round(row.change)}%`;
      const coverage = c ? `${c.span.toFixed(1)} days${c.complete ? '' : ' · partial'}` : 'Insufficient history';
      const updated = row.latest ? ` · updated ${new Date(row.latest).toLocaleDateString()}` : '';
      return `<tr><th scope="row">${playerNameHtml(row.player)}</th>
        <td>${c ? number(c.gain) : '—'}</td><td>${c ? number(c.rate) : '—'}</td>
        <td>${change}</td><td>${coverage}${updated}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function initializeArticleNavigation() {
  const nav = document.getElementById('tracker-navigation');
  if (!nav) return;
  function reveal(hash) {
    const id = hash.slice(1);
    const section = document.getElementById(id);
    if (!section?.matches('.window[data-window-id]')) return;
    const checkbox = document.getElementById(`window-${id}`);
    if (checkbox) checkbox.checked = true;
    section.classList.remove('hidden', 'minimized');
    saveMinimizedStates();
    updateWindowAccessibilityState(section);
    updateWindowVisibility();
    nav.querySelectorAll('a').forEach(link => {
      if (link.hash === hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    requestAnimationFrame(() => {
      section.scrollIntoView({ block: 'start' });
      section.querySelector('h2')?.focus({ preventScroll: true });
    });
  }
  document.querySelectorAll('.title-bar-text').forEach(title => title.tabIndex = -1);
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link) reveal(link.hash);
  });
  window.addEventListener('hashchange', () => reveal(location.hash));
  if (location.hash) reveal(location.hash);
}

function initializeTableSearch() {
  document.querySelectorAll('.window .sunken-panel').forEach(panel => {
    // Recent activity already has its own filters; XP is a short summary.
    if (panel.closest('#achievements-table-container, #xp-trends')) return;
    const table = panel.querySelector('table');
    if (!table) return;
    const label = panel.getAttribute('aria-label') || 'table';
    const toolbar = document.createElement('div');
    toolbar.className = 'table-search';
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Find in table ';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Type a name…';
    input.setAttribute('aria-label', `Search ${label}`);
    searchLabel.append(input);
    const status = document.createElement('span');
    status.setAttribute('aria-live', 'polite');
    toolbar.append(searchLabel, status);
    panel.before(toolbar);
    const rows = [...table.querySelectorAll('tbody tr')].filter(row => !row.classList.contains('sticky-total-row'));
    let group = null;
    const headings = [];
    const searchable = rows.flatMap(row => {
      if (row.querySelector('td[colspan]')) {
        group = row;
        headings.push(row);
        return [];
      }
      return [{ row, group, text: `${group?.textContent || ''} ${row.textContent}`.toLocaleLowerCase() }];
    });
    input.addEventListener('input', () => {
      const query = input.value.trim().toLocaleLowerCase();
      let count = 0;
      headings.forEach(row => row.classList.toggle('search-hidden', Boolean(query)));
      searchable.forEach(({ row, group, text }) => {
        row.classList.toggle('search-hidden', Boolean(query) && !text.includes(query));
        if (!row.classList.contains('search-hidden') && row.style.display !== 'none') {
          count++;
          group?.classList.remove('search-hidden');
        }
      });
      status.textContent = query ? `${count} matching rows` : '';
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
