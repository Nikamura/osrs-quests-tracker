import { makeAbsoluteUrl, fetchWikiPage, saveGameData } from './fetch_utils.js';

async function fetchCombatAchievements() {
  try {
    console.log('Fetching combat achievements data...')
    const document = await fetchWikiPage("https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks");

    // Find the specific table (5th wikitable)
    const table = document.querySelector('table.wikitable:nth-child(5)');

    if (!table) {
      console.error('Table not found');
      return;
    }

    console.log('Parsing table data...')

    // Get all rows except the header
    const rows = Array.from(table.querySelectorAll('tr')).slice(1);

    // Helper function to extract wiki link
    const extractWikiLink = (cell) => {
      const link = cell.querySelector('a');
      if (link && link.getAttribute('href')) {
        return makeAbsoluteUrl(link.getAttribute('href'));
      }
      return null;
    };

    // Helper function to get tier icon URL
    const getTierIconUrl = (tierCell) => {
      const img = tierCell.querySelector('img');
      if (img && img.getAttribute('src')) {
        return makeAbsoluteUrl(img.getAttribute('src'));
      }
      return null;
    };

    const combatAchievements = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));

      if (cells.length < 5) return null;

      const taskId = row.getAttribute('data-ca-task-id');

      return {
        taskId: taskId || null,
        monster: cells[0]?.textContent?.trim() || '',
        monsterWikiLink: extractWikiLink(cells[0]),
        name: cells[1]?.textContent?.trim() || '',
        nameWikiLink: extractWikiLink(cells[1]),
        description: cells[2]?.textContent?.trim() || '',
        type: cells[3]?.textContent?.trim() || '',
        tier: cells[4]?.textContent?.trim() || '',
        tierIconUrl: getTierIconUrl(cells[4])
      };
    }).filter(achievement => achievement !== null);

    console.log(`Parsed ${combatAchievements.length} combat achievements`);
    saveGameData('combat_achievements.json', combatAchievements);
    console.log('Sample data:', combatAchievements.slice(0, 2));

    return combatAchievements;

  } catch (error) {
    console.error('Error fetching combat achievements:', error);
  }
}

fetchCombatAchievements();
