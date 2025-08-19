#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYER_DATA_DIR = path.join(__dirname, 'player_data');

/**
 * Parse timestamp from filename
 * @param {string} filename - e.g., "anime irl_2025-08-19T14:09:33.500Z.json"
 * @returns {Date} - parsed date
 */
function parseTimestampFromFilename(filename) {
  const match = filename.match(/_(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\.json$/);
  return match ? new Date(match[1]) : null;
}

/**
 * Load and parse JSON file, excluding timestamp field for comparison
 * @param {string} filePath
 * @returns {object} - parsed JSON without timestamp
 */
function loadPlayerDataForComparison(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    // Create a copy without timestamp for comparison
    const { timestamp, ...dataWithoutTimestamp } = data;
    return dataWithoutTimestamp;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Deep compare two objects
 * @param {object} obj1
 * @param {object} obj2
 * @returns {boolean}
 */
function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Get all player directories
 * @returns {string[]} - array of player directory names
 */
function getPlayerDirectories() {
  return fs.readdirSync(PLAYER_DATA_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Get all files for a player, sorted by timestamp
 * @param {string} playerName
 * @returns {Array<{filename: string, timestamp: Date, filePath: string}>}
 */
function getPlayerFiles(playerName) {
  const playerDir = path.join(PLAYER_DATA_DIR, playerName);
  if (!fs.existsSync(playerDir)) return [];

  const files = fs.readdirSync(playerDir)
    .filter(file => file.endsWith('.json'))
    .map(filename => {
      const timestamp = parseTimestampFromFilename(filename);
      return {
        filename,
        timestamp,
        filePath: path.join(playerDir, filename)
      };
    })
    .filter(file => file.timestamp !== null)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return files;
}

/**
 * Group files by timestamp across all players
 * @param {Array<string>} playerNames
 * @returns {Array<{timestamp: Date, files: Array<{player: string, filePath: string}>}>}
 */
function groupFilesByTimestamp(playerNames) {
  const timestampGroups = new Map();

  for (const playerName of playerNames) {
    const playerFiles = getPlayerFiles(playerName);

    for (const file of playerFiles) {
      const timestampKey = file.timestamp.toISOString();

      if (!timestampGroups.has(timestampKey)) {
        timestampGroups.set(timestampKey, {
          timestamp: file.timestamp,
          files: []
        });
      }

      timestampGroups.get(timestampKey).files.push({
        player: playerName,
        filePath: file.filePath
      });
    }
  }

  // Convert to array and sort by timestamp
  return Array.from(timestampGroups.values())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Check if two timestamp groups have identical data (ignoring timestamps)
 * @param {object} group1
 * @param {object} group2
 * @returns {boolean}
 */
function areGroupsIdentical(group1, group2) {
  // Both groups must have files for the same players
  const players1 = new Set(group1.files.map(f => f.player));
  const players2 = new Set(group2.files.map(f => f.player));

  if (players1.size !== players2.size) return false;

  for (const player of players1) {
    if (!players2.has(player)) return false;

    const file1 = group1.files.find(f => f.player === player);
    const file2 = group2.files.find(f => f.player === player);

    if (!file1 || !file2) return false;

    const data1 = loadPlayerDataForComparison(file1.filePath);
    const data2 = loadPlayerDataForComparison(file2.filePath);

    if (!data1 || !data2 || !deepEqual(data1, data2)) {
      return false;
    }
  }

  return true;
}

/**
 * Find consecutive groups that are identical and mark them for deletion
 * @param {Array} timestampGroups
 * @returns {Array<object>} - groups to delete
 */
function findGroupsToDelete(timestampGroups) {
  const groupsToDelete = [];
  let consecutiveStart = null;

  for (let i = 1; i < timestampGroups.length; i++) {
    const prevGroup = timestampGroups[i - 1];
    const currentGroup = timestampGroups[i];

    if (areGroupsIdentical(prevGroup, currentGroup)) {
      // Start of a consecutive sequence or continuation
      if (consecutiveStart === null) {
        consecutiveStart = i - 1;
      }
    } else {
      // End of consecutive sequence
      if (consecutiveStart !== null) {
        // Mark all groups except the first one for deletion
        for (let j = consecutiveStart + 1; j < i; j++) {
          groupsToDelete.push(timestampGroups[j]);
        }
        consecutiveStart = null;
      }
    }
  }

  // Handle case where consecutive sequence goes to the end
  if (consecutiveStart !== null) {
    for (let j = consecutiveStart + 1; j < timestampGroups.length; j++) {
      groupsToDelete.push(timestampGroups[j]);
    }
  }

  return groupsToDelete;
}

/**
 * Delete files in the specified groups
 * @param {Array<object>} groupsToDelete
 */
function deleteGroups(groupsToDelete) {
  let deletedCount = 0;

  for (const group of groupsToDelete) {
    console.log(`Deleting files from ${group.timestamp.toISOString()}:`);

    for (const file of group.files) {
      try {
        fs.unlinkSync(file.filePath);
        console.log(`  ✓ Deleted: ${file.filePath}`);
        deletedCount++;
      } catch (error) {
        console.error(`  ✗ Failed to delete ${file.filePath}:`, error.message);
      }
    }
  }

  return deletedCount;
}

/**
 * Main cleanup function
 */
function cleanupPlayerData() {
  console.log('🧹 Starting player data cleanup...\n');

  // Get all player directories
  const playerNames = getPlayerDirectories();
  console.log(`Found ${playerNames.length} players: ${playerNames.join(', ')}\n`);

  if (playerNames.length === 0) {
    console.log('No player directories found.');
    return;
  }

  // Group files by timestamp
  const timestampGroups = groupFilesByTimestamp(playerNames);
  console.log(`Found ${timestampGroups.length} timestamp groups\n`);

  if (timestampGroups.length < 2) {
    console.log('Need at least 2 timestamp groups to perform cleanup.');
    return;
  }

  // Find groups to delete
  const groupsToDelete = findGroupsToDelete(timestampGroups);

  if (groupsToDelete.length === 0) {
    console.log('✅ No duplicate consecutive groups found. Nothing to clean up!');
    return;
  }

  console.log(`Found ${groupsToDelete.length} duplicate groups to delete:\n`);

  // Show what will be deleted
  for (const group of groupsToDelete) {
    console.log(`📅 ${group.timestamp.toISOString()}:`);
    for (const file of group.files) {
      console.log(`   - ${file.player}: ${path.basename(file.filePath)}`);
    }
  }

  console.log('\n🗑️  Deleting duplicate files...\n');

  // Delete the files
  const deletedCount = deleteGroups(groupsToDelete);

  console.log(`\n✅ Cleanup completed! Deleted ${deletedCount} files.`);
}

// Run the cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupPlayerData();
}

export { cleanupPlayerData };
