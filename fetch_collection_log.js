import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

async function fetchCollectionLog() {
    try {
        console.log('Fetching collection log data...');
        const page = await fetch("https://oldschool.runescape.wiki/w/Collection_log/Table");
        const text = await page.text();

        const dom = new JSDOM(text);
        const document = dom.window.document;

        const table = document.querySelector('table.wikitable.lighttable.sortable');

        if (!table) {
            console.error('Table not found');
            return;
        }

        console.log('Parsing table data...');

        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        const makeAbsoluteUrl = (url) => {
            if (!url) return null;
            if (url.startsWith('//')) {
                return `https:${url}`;
            }
            if (url.startsWith('/')) {
                return `https://oldschool.runescape.wiki${url}`;
            }
            return url;
        };

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

            const entry = {
                itemId: itemId || null,
                itemName: itemName,
                itemLink: makeAbsoluteUrl(itemLink),
                itemIcon: makeAbsoluteUrl(itemIcon),
                itemIconLink: makeAbsoluteUrl(itemIconLink),
                collection: collection,
                collectionLink: makeAbsoluteUrl(collectionLink),
            };

            return entry;
        }).filter(item => item !== null && item.itemName);

        console.log(`Parsed ${collectionLog.length} collection log items`);

        const gameDataDir = 'game_data';
        if (!fs.existsSync(gameDataDir)) {
            fs.mkdirSync(gameDataDir, { recursive: true });
            console.log('Created game_data directory');
        }

        const filePath = path.join(gameDataDir, 'collection_log.json');
        const jsonData = JSON.stringify(collectionLog, null, 2);
        fs.writeFileSync(filePath, jsonData);

        console.log(`Collection log saved to ${filePath}`);
        console.log('Sample data:', collectionLog.slice(0, 2));

        return collectionLog;

    } catch (error) {
        console.error('Error fetching collection log:', error);
    }
}

fetchCollectionLog();
