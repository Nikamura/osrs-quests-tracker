import { makeAbsoluteUrl, fetchWikiPage, saveGameData } from './fetch_utils.js';

async function fetchCollectionLog() {
    try {
        console.log('Fetching collection log data...');
        const document = await fetchWikiPage("https://oldschool.runescape.wiki/w/Collection_log/Table");

        const table = document.querySelector('table.wikitable.lighttable.sortable');

        if (!table) {
            console.error('Table not found');
            return;
        }

        console.log('Parsing table data...');

        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        const collectionLog = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td'));

            if (cells.length < 2) return null;

            const itemId = row.getAttribute('data-item-id');
            const itemCell = cells[0];
            const collectionCell = cells[1];

            const itemLinks = Array.from(itemCell.querySelectorAll('a'));
            const itemImage = itemCell.querySelector('img');

            const itemNameLinkElement = itemLinks.find(a => !a.querySelector('img') && a.textContent.trim());
            const itemIconLinkElement = itemLinks.find(a => a.querySelector('img'));

            const itemName = itemNameLinkElement?.textContent.trim() || itemCell.textContent.trim();
            const itemLink = itemNameLinkElement?.getAttribute('href');
            const itemIcon = itemImage?.getAttribute('src');
            const itemIconLink = itemIconLinkElement?.getAttribute('href');

            const collectionLinkElement = collectionCell.querySelector('a');
            const collection = collectionLinkElement?.textContent.trim() || collectionCell.textContent.trim();
            const collectionLink = collectionLinkElement?.getAttribute('href');

            return {
                itemId: itemId || null,
                itemName: itemName,
                itemLink: makeAbsoluteUrl(itemLink),
                itemIcon: makeAbsoluteUrl(itemIcon),
                itemIconLink: makeAbsoluteUrl(itemIconLink),
                collection: collection,
                collectionLink: makeAbsoluteUrl(collectionLink),
            };
        }).filter(item => item !== null && item.itemName);

        console.log(`Parsed ${collectionLog.length} collection log items`);
        saveGameData('collection_log.json', collectionLog);
        console.log('Sample data:', collectionLog.slice(0, 2));

        return collectionLog;

    } catch (error) {
        console.error('Error fetching collection log:', error);
    }
}

fetchCollectionLog();
