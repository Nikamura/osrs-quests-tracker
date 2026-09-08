import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const appSource = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const initSource = readFileSync(new URL('../public/js/init.js', import.meta.url), 'utf8');
const appWithoutBoot = appSource.replace(
  /\nif \(document\.readyState === 'loading'\) \{[\s\S]*$/,
  ''
);

function createClient(html) {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'https://tracker.test/'
  });
  dom.window.eval(`${appWithoutBoot}
    window.__clientTest = {
      xpSeriesData,
      xpMedalRanks,
      formatProgressTooltip,
      highlightTooltipPlayer,
      initializeArticleNavigation,
      initializeTableSearch,
      generateAchievementSummary,
      loadWindowOrder,
      loadWindowVisibility,
      renderSailingProgress,
      renderSeaChartingExplorer,
      setSailingExplorerPlayer,
      setSailingExplorerGroup,
      setSailingExplorerStatus,
      setData(value) {
        tableData = value;
        playerToDisplay = {};
        playerColors = {};
      }
    };
  `);
  return dom;
}

function windowMarkup(id, title, introducedVersion = 1) {
  const dataId = id === 'configuration' ? '' : ` data-window-id="${id}"`;
  const introduced = introducedVersion > 1 ? ` data-introduced-version="${introducedVersion}"` : '';
  return `<div class="window"${dataId}${introduced}><div class="title-bar-text">${title}</div></div>`;
}

test('visibility state tolerates corruption and rebalances Sailing windows once', () => {
  const dom = createClient(`
    <body data-window-catalog-version="3">
      <input type="checkbox" id="window-player-overview" value="player-overview" data-introduced-version="2" checked>
      <input type="checkbox" id="window-sailing-progress" value="sailing-progress" data-introduced-version="2">
      <input type="checkbox" id="window-sea-charting-explorer" value="sea-charting-explorer" data-introduced-version="2">
      <input type="checkbox" id="window-quest-progress" value="quest-progress" data-introduced-version="1" checked>
      <div class="container">
        ${windowMarkup('configuration', 'Configuration')}
        ${windowMarkup('player-overview', 'Player Overview', 2)}
        ${windowMarkup('sailing-progress', 'Sailing Progress', 2)}
        ${windowMarkup('sea-charting-explorer', 'Sea Charting Explorer', 2)}
        ${windowMarkup('quest-progress', 'Quest Progress')}
      </div>
    </body>`);
  const { localStorage, document } = dom.window;
  const client = dom.window.__clientTest;

  for (const malformed of ['{', '{}']) {
    localStorage.setItem('osrs-selected-windows', malformed);
    assert.doesNotThrow(() => client.loadWindowVisibility());
    assert.equal(document.querySelector('#window-player-overview').checked, true);
    assert.equal(document.querySelector('#window-sailing-progress').checked, false);
    assert.equal(document.querySelector('#window-sea-charting-explorer').checked, false);
  }

  localStorage.setItem('osrs-window-catalog-version', '2');
  localStorage.setItem('osrs-selected-windows', JSON.stringify([
    'player-overview', 'sailing-progress', 'sea-charting-explorer', 'quest-progress'
  ]));
  client.loadWindowVisibility();
  assert.equal(document.querySelector('#window-player-overview').checked, true);
  assert.equal(document.querySelector('#window-sailing-progress').checked, false);
  assert.equal(document.querySelector('#window-sea-charting-explorer').checked, false);
  assert.equal(document.querySelector('#window-quest-progress').checked, true);
  assert.equal(localStorage.getItem('osrs-window-catalog-version'), '3');
});

test('early initialization hides Sailing windows before the version 3 app boot', () => {
  const dom = new JSDOM(`
    <body data-window-catalog-version="3">
      <div class="window" data-window-id="player-overview"></div>
      <div class="window" data-window-id="sailing-progress" data-introduced-version="2"></div>
      <div class="window" data-window-id="sea-charting-explorer" data-introduced-version="2"></div>
    </body>`, {
    runScripts: 'outside-only',
    url: 'https://tracker.test/'
  });
  dom.window.localStorage.setItem('osrs-window-catalog-version', '2');
  dom.window.localStorage.setItem('osrs-selected-windows', JSON.stringify([
    'player-overview', 'sailing-progress', 'sea-charting-explorer'
  ]));

  dom.window.eval(initSource);

  assert.equal(dom.window.document.querySelector('[data-window-id="player-overview"]').classList.contains('hidden'), false);
  assert.equal(dom.window.document.querySelector('[data-window-id="sailing-progress"]').classList.contains('hidden'), true);
  assert.equal(dom.window.document.querySelector('[data-window-id="sea-charting-explorer"]').classList.contains('hidden'), true);
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('osrs-selected-windows')), ['player-overview']);
});

test('first-visit defaults hide optional Sailing windows before app boot', () => {
  const dom = new JSDOM(`
    <body data-window-catalog-version="3">
      <input type="checkbox" id="window-player-overview" value="player-overview" checked>
      <input type="checkbox" id="window-sailing-progress" value="sailing-progress">
      <input type="checkbox" id="window-sea-charting-explorer" value="sea-charting-explorer">
      <div class="window" data-window-id="player-overview"></div>
      <div class="window" data-window-id="sailing-progress"></div>
      <div class="window" data-window-id="sea-charting-explorer"></div>
    </body>`, {
    runScripts: 'outside-only',
    url: 'https://tracker.test/'
  });

  dom.window.eval(initSource);

  assert.equal(dom.window.document.querySelector('[data-window-id="player-overview"]').classList.contains('hidden'), false);
  assert.equal(dom.window.document.querySelector('[data-window-id="sailing-progress"]').classList.contains('hidden'), true);
  assert.equal(dom.window.document.querySelector('[data-window-id="sea-charting-explorer"]').classList.contains('hidden'), true);
});

test('version 3 window order moves Sailing tools behind the general tracker', () => {
  const dom = createClient(`
    <body data-window-catalog-version="3">
      <div class="container">
        ${windowMarkup('configuration', 'Configuration')}
        ${windowMarkup('player-overview', 'Player Overview', 2)}
        ${windowMarkup('sailing-progress', 'Sailing Progress', 2)}
        ${windowMarkup('sea-charting-explorer', 'Sea Charting Explorer', 2)}
        ${windowMarkup('quest-progress', 'Quest Progress')}
      </div>
    </body>`);
  const { localStorage, document } = dom.window;
  localStorage.setItem('osrs-window-catalog-version', '2');
  localStorage.setItem('osrs-window-order', JSON.stringify([
    'configuration', 'player-overview', 'sailing-progress', 'sea-charting-explorer', 'quest-progress'
  ]));

  dom.window.__clientTest.loadWindowOrder();
  const order = [...document.querySelectorAll('.container > .window')]
    .map(element => element.querySelector('.title-bar-text').textContent);
  assert.deepEqual(order, ['Configuration', 'Player Overview', 'Quest Progress', 'Sailing Progress', 'Sea Charting Explorer']);
  assert.deepEqual(JSON.parse(localStorage.getItem('osrs-window-order')), [
    'configuration',
    'player-overview',
    'quest-progress',
    'sailing-progress',
    'sea-charting-explorer'
  ]);
});


test('Sailing filters retain focus and collapse completion groups by default', () => {
  const dom = createClient(`
    <body>
      <input type="checkbox" id="player-alpha" value="alpha" checked>
      <input type="checkbox" id="player-beta" value="beta" checked>
      <div id="sailing-progress-container"></div>
      <div id="sea-charting-explorer-container"></div>
    </body>`);
  const groups = ['Ardent Ocean', 'Unquiet Ocean', 'Shrouded Ocean', 'Western Ocean', 'Northern Ocean', 'Sunset Ocean', 'Miscellaneous'];
  const tasks = groups.map((completionGroup, taskId) => ({
    taskId,
    level: 1,
    type: 'Generic',
    task: `Task ${taskId}`,
    sea: `Sea ${taskId}`,
    seaWikiLink: `https://oldschool.runescape.wiki/w/Sea_${taskId}`,
    ocean: completionGroup === 'Miscellaneous' ? 'Ardent Ocean' : completionGroup,
    oceanWikiLink: 'https://oldschool.runescape.wiki/w/Ardent_Ocean',
    completionGroup,
    isBonusChart: completionGroup === 'Miscellaneous',
    hazard: null
  }));
  const playerProgress = Object.fromEntries(['alpha', 'beta'].map(player => [player, {
    available: true,
    sailingLevel: player === 'alpha' ? 1 : 62,
    completedTaskIds: [],
    unknownTaskIds: [],
    snapshotAt: '2026-08-22T10:00:00.000Z'
  }]));
  const client = dom.window.__clientTest;
  client.setData({ sailing: {
    sourceUrl: 'https://oldschool.runescape.wiki/w/Sea_charting',
    totalTasks: tasks.length,
    players: ['alpha', 'beta'],
    playerProgress,
    completionGroups: groups.map((name, taskId) => ({ name, taskIds: [taskId] })),
    tasks
  } });

  client.renderSailingProgress(['alpha', 'beta']);
  assert.equal(dom.window.document.querySelector('#sailing-progress-container .sailing-player-grid') !== null, true);
  assert.equal(dom.window.document.querySelector('#sailing-progress-container .sailing-explorer-controls'), null);
  client.renderSeaChartingExplorer(['alpha', 'beta']);
  assert.equal(dom.window.document.querySelectorAll('.sailing-chart-group').length, 7);
  assert.equal(dom.window.document.querySelectorAll('.sailing-chart-group[open]').length, 0);

  dom.window.document.querySelector('#sailing-explorer-player').focus();
  client.setSailingExplorerPlayer('beta');
  assert.equal(dom.window.document.activeElement.id, 'sailing-explorer-player');
  assert.equal(dom.window.document.activeElement.value, 'beta');

  client.setSailingExplorerGroup('Ardent Ocean');
  assert.equal(dom.window.document.activeElement.id, 'sailing-explorer-group');
  client.setSailingExplorerStatus('all');
  assert.equal(dom.window.document.activeElement.id, 'sailing-explorer-status');
});


test('article navigation reopens hidden sections without discarding player selection', () => {
  const dom = createClient(`<body data-layout="wiki"><nav id="tracker-navigation"><a href="#sailing-progress">Sailing</a></nav>
    <input id="window-sailing-progress" type="checkbox" value="sailing-progress">
    <input id="player-one" type="checkbox" value="one" checked>
    <div class="window hidden minimized" data-window-id="sailing-progress" id="sailing-progress">
      <h2 class="title-bar-text">Sailing Progress</h2><div class="window-body"></div>
    </div></body>`);
  dom.window.requestAnimationFrame = () => {};
  dom.window.__clientTest.initializeArticleNavigation();
  dom.window.document.querySelector('nav a').click();
  assert.equal(dom.window.document.querySelector('#sailing-progress').classList.contains('hidden'), false);
  assert.equal(dom.window.document.querySelector('#sailing-progress').classList.contains('minimized'), false);
  assert.equal(dom.window.document.querySelector('#window-sailing-progress').checked, true);
  assert.equal(dom.window.document.querySelector('#player-one').checked, true);
  dom.window.close();
});

test('table search filters rows, preserves totals, and can be cleared', () => {
  const dom = createClient(`<div class="window"><div class="sunken-panel" aria-label="Quest comparison"><table><tbody>
    <tr><td>Dragon Slayer</td></tr><tr><td>Cook's Assistant</td></tr>
    <tr class="sticky-total-row"><td>Total</td></tr></tbody></table></div></div>`);
  dom.window.__clientTest.initializeTableSearch();
  const input = dom.window.document.querySelector('input[type=search]');
  input.value = 'dragon';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(dom.window.document.querySelectorAll('.search-hidden').length, 1);
  assert.equal(dom.window.document.querySelector('.sticky-total-row').classList.contains('search-hidden'), false);
  assert.match(dom.window.document.querySelector('[aria-live]').textContent, /1 matching rows/);
  input.value = '';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(dom.window.document.querySelectorAll('.search-hidden').length, 0);
  dom.window.close();
});

test('diary search keeps region headings with matching difficulty rows', () => {
  const dom = createClient(`<div class="window"><div class="sunken-panel" aria-label="Diary comparison"><table><tbody>
    <tr><td colspan="2">Varrock</td></tr><tr><td>Easy</td><td>✓</td></tr><tr><td>Hard</td><td>—</td></tr>
    <tr><td colspan="2">Lumbridge</td></tr><tr><td>Easy</td><td>✓</td></tr><tr><td>Hard</td><td>✓</td></tr>
    <tr class="sticky-total-row"><td>Total</td></tr></tbody></table></div></div>`);
  dom.window.__clientTest.initializeTableSearch();
  const input = dom.window.document.querySelector('input');
  const visible = () => [...dom.window.document.querySelectorAll('tbody tr:not(.search-hidden)')].map(r => r.textContent);
  input.value = 'Varrock';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.deepEqual(visible(), ['Varrock', 'Easy✓', 'Hard—', 'Total']);
  input.value = 'Hard';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.deepEqual(visible(), ['Varrock', 'Hard—', 'Lumbridge', 'Hard✓', 'Total']);
  dom.window.close();
});


test('article layout restores its own collapsed sections and ignores old desktop state', () => {
  const dom = new JSDOM(`<body data-layout="wiki"><div class="window"><h2 class="title-bar-text">Total XP Progress</h2><div class="window-body"></div></div></body>`, {runScripts: 'outside-only', url: 'https://tracker.test/'});
  dom.window.localStorage.setItem('osrs-minimized-windows', JSON.stringify({'total-xp-progress': true}));
  dom.window.eval(initSource);
  assert.equal(dom.window.document.querySelector('.window').classList.contains('minimized'), false);
  dom.window.localStorage.setItem('osrs-collapsed-sections', JSON.stringify({'total-xp-progress': true}));
  dom.window.eval(initSource);
  assert.equal(dom.window.document.querySelector('.window').classList.contains('minimized'), true);
  dom.window.close();
});


test('achievement summary sorts counts and escapes names', () => {
  const dom = createClient('');
  const html = dom.window.__clientTest.generateAchievementSummary([
    {player:'a',displayName:'<Alpha>',type:'level'},
    {player:'b',displayName:'Beta',type:'quest'},
    {player:'b',displayName:'Beta',type:'level'}
  ]);
  assert.match(html, /3 recorded updates/);
  assert.match(html, /&lt;Alpha&gt;/);
  assert.ok(html.indexOf('Beta') < html.indexOf('&lt;Alpha&gt;'));
  assert.match(html, /<dt><img[^>]+>Level<\/dt><dd>2<\/dd>/);
  dom.window.close();
});

test('table search count excludes rows hidden by player selection', () => {
  const dom = createClient(`<div class="window"><div class="sunken-panel"><table><tbody>
    <tr style="display:none"><td>Dragon sword</td></tr><tr><td>Dragon boots</td></tr></tbody></table></div></div>`);
  dom.window.__clientTest.initializeTableSearch();
  const input = dom.window.document.querySelector('input');
  input.value = 'Dragon';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(dom.window.document.querySelector('[aria-live]').textContent, '1 matching rows');
  dom.window.close();
});

test('XP chart uses chronological snapshots and preserves totals and observed deltas', () => {
  const dom = createClient('');
  const series = dom.window.__clientTest.xpSeriesData([
    {timestamp: '2026-01-03T00:00:00Z', totalExp: 160},
    {timestamp: '2026-01-01T00:00:00Z', totalExp: 100},
    {timestamp: '2026-01-02T00:00:00Z', totalExp: 100}
  ], 'all', true);
  assert.deepEqual(Array.from(series, p => p.value[1]), [0, 0, 60]);
  assert.deepEqual(Array.from(series, p => p.delta), [null, 0, 60]);
  assert.equal(series[2].total, 160);
  assert.equal(dom.window.__clientTest.xpSeriesData([], 'all', true).length, 0);
  assert.equal(dom.window.__clientTest.xpSeriesData([{timestamp:'2000-01-01',totalExp:10}], '30', true).length, 0);
  dom.window.close();
});

test('chart tooltip ranks values and highlights the hovered series without changing source order', () => {
  const dom = createClient('<div id="chart"></div>');
  const params = [
    {seriesName: 'Low', seriesIndex: 0, color: '#123456', value: [1000, 2], data: {total: 20, delta: 2}},
    {seriesName: 'High', seriesIndex: 1, color: '#654321', value: [1000, 9], data: {total: 90, delta: 9}}
  ];
  const el = dom.window.document.getElementById('chart');
  el.innerHTML = dom.window.__clientTest.formatProgressTooltip(params, 'Skills_icon', true, 0);
  assert.deepEqual([...el.querySelectorAll('.chart-tooltip-entry')].map(e => e.dataset.seriesIndex), ['1', '0']);
  assert.equal(el.querySelector('.is-highlighted').dataset.seriesIndex, '0');
  const chart = {getDom: () => el};
  dom.window.__clientTest.highlightTooltipPlayer(chart, 1);
  assert.equal(el.querySelector('.is-highlighted').dataset.seriesIndex, '1');
  dom.window.__clientTest.highlightTooltipPlayer(chart, null);
  assert.equal(el.querySelector('.is-highlighted'), null);
  assert.equal(params[0].seriesName, 'Low');
  dom.window.close();
});

test('XP medals rank positive complete history with shared places for ties', () => {
  const dom = createClient('');
  const row = (player, rate, complete = true) => ({player, current: {rate, complete}});
  const ranks = dom.window.__clientTest.xpMedalRanks([row('a', 100), row('b', 100), row('c', 50), row('d', 0), row('e', 1000, false)]);
  assert.deepEqual(JSON.parse(JSON.stringify(ranks)), {a: 1, b: 1, c: 3});
  dom.window.close();
});
