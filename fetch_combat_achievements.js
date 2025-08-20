import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'

async function fetchCombatAchievements() {
  try {
    console.log('Fetching combat achievements data...')
    const page = await fetch("https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks")
    const text = await page.text()

    const dom = new JSDOM(text);
    const document = dom.window.document;

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
        const href = link.getAttribute('href');
        // Convert relative links to absolute wiki links
        if (href.startsWith('/')) {
          return `https://oldschool.runescape.wiki${href}`;
        }
        return href;
      }
      return null;
    };

    // Helper function to get tier icon URL
    const getTierIconUrl = (tierCell) => {
      const img = tierCell.querySelector('img');
      if (img && img.getAttribute('src')) {
        let src = img.getAttribute('src');
        // Convert relative URLs to absolute
        if (src.startsWith('//')) {
          src = `https:${src}`;
        } else if (src.startsWith('/')) {
          src = `https://oldschool.runescape.wiki${src}`;
        }
        return src;
      }
      return null;
    };

    const combatAchievements = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'));

      if (cells.length < 5) return null; // Skip incomplete rows (reduced from 6 since we're not using Comp%)

      // Extract the task ID from the row's data attribute
      const taskId = row.getAttribute('data-ca-task-id');

      const achievement = {
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

      return achievement;
    }).filter(achievement => achievement !== null);

    console.log(`Parsed ${combatAchievements.length} combat achievements`);

    // Create game_data directory if it doesn't exist
    const gameDataDir = 'game_data';
    if (!fs.existsSync(gameDataDir)) {
      fs.mkdirSync(gameDataDir, { recursive: true });
      console.log('Created game_data directory');
    }

    // Save to JSON file in game_data folder
    const filePath = path.join(gameDataDir, 'combat_achievements.json');
    const jsonData = JSON.stringify(combatAchievements, null, 2);
    fs.writeFileSync(filePath, jsonData);

    console.log(`Combat achievements saved to ${filePath}`);
    console.log('Sample data:', combatAchievements.slice(0, 2));

    return combatAchievements;

  } catch (error) {
    console.error('Error fetching combat achievements:', error);
  }
}

// Run the function
fetchCombatAchievements();
