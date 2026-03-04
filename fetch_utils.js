import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const WIKI_BASE = 'https://oldschool.runescape.wiki';

export function makeAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${WIKI_BASE}${url}`;
  return url;
}

export async function fetchWikiPage(url) {
  const page = await fetch(url);
  const text = await page.text();
  const dom = new JSDOM(text);
  return dom.window.document;
}

export function saveGameData(filename, data) {
  fs.mkdirSync('game_data', { recursive: true });
  const filePath = path.join('game_data', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved to ${filePath}`);
}
