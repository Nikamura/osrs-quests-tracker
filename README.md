# OSRS Tracker

> **Disclaimer**: This project is being vibe coded ✨ Good vibes only! 🌟

## Overview

A comprehensive tool to track Old School RuneScape (OSRS) progress for a group of friends. This project fetches player data from the RuneLite API and provides a rich web interface to compare and visualize various game metrics including quests, skills, achievement diaries, music tracks, and recent achievements.

## Features

### Data Collection
- **Automated Data Fetching**: Retrieves comprehensive player data from the [RuneLite API](https://sync.runescape.wiki/) including:
  - Quest completion status
  - Skill levels
  - Achievement diary progress
  - Music track unlocks
  - Combat achievements
  - Collection log progress
  - League tasks
- **Data Storage**: Stores timestamped JSON files for historical tracking
- **Data Cleanup**: Automated removal of duplicate consecutive data snapshots
- **Real-time Data Display**: All data points are displayed without aggregation or bucketing for maximum detail

### Web Interface
- **Interactive Dashboard**: Windows 98-style UI with draggable, minimizable, and closable windows
- **Loading Screen**: Smooth loading experience with spinner animation that prevents content flashing
- **Configuration Window**: Centralized control panel for:
  - Player selection/deselection with visual indicators
  - Window visibility toggles to show/hide specific data windows
  - Persistent settings that save across browser sessions
- **Window Controls**: Each window (except Configuration) features:
  - Minimize button to collapse/expand the window content
  - Close button to hide the window (can be reopened via Configuration panel)
- **Progress Charts**: Line charts showing progression over time:
  - Quest completion progress
  - Total level progression
  - Individual skill level progression (with skill selector dropdown)
- **Comparison Tables**: Side-by-side comparison of:
  - Quest completion status
  - Skill levels with color-coded ranges and rankings
  - Achievement diary progress
  - Combat achievements with tier icons and completion status
  - Music track unlocks
  - Collection log progress with item icons and completion percentages
- **Recent Achievements**: Timeline of recent progress with player-specific colors, including individual collection log items with icons
- **Player Selection**: Filter views by selected players with persistent preferences
- **Window Management**: Configure which windows are shown/hidden with persistent preferences
- **State Synchronization**: Window positions and states sync across browser tabs

## Project Structure

```
osrs-quest-tracker/
├── config.js               # Shared configuration for players, names, and colors
├── data_fetcher.js         # Fetches player data from RuneLite API
├── fetch_collection_log.js # Fetches collection log data from OSRS Wiki
├── fetch_combat_achievements.js # Fetches combat achievements data from OSRS Wiki
├── generate_static.js      # Generates static HTML with all data and features
├── server.js               # Express server to serve the web interface
├── cleanup_player_data.js  # Removes duplicate consecutive data files
├── game_data/              # Stores static game data
├── player_data/            # Directory storing timestamped JSON files per player
├── public/                 # Generated static files (index.html, data.json, styles.css)
├── package.json            # Project metadata and npm scripts
├── jsconfig.json          # JavaScript language service configuration
└── README.md              # This documentation
```

## Configuration

The project uses a centralized configuration system in `config.js` that defines:

- **Player List**: Array of player usernames to track
- **Display Names**: Mapping of usernames to friendly display names
- **Player Colors**: Color scheme for charts and visual elements
- **Ironman Players**: List of players who use ironman highscores

To add or modify players, edit the `PLAYER_CONFIG` object in `config.js`:

```javascript
export const PLAYER_CONFIG = {
  players: ["username1", "username2"],
  displayNames: {
    "username1": "Friendly Name 1",
    "username2": "Friendly Name 2"
  },
  colors: {
    "username1": "#FF6384",
    "username2": "#36A2EB"
  },
  ironmanPlayers: ["username1"]
};
```

## Requirements

- **Node.js**: v14.x or higher recommended
- **Dependencies**: Express.js (for web server)

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd osrs-quest-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure players:
   Edit the `PLAYER_CONFIG` object in `config.js` to add/remove players and customize their display names and colors.

## Usage

### Data Collection

Fetch current data for all configured players:
```bash
npm run fetch-data
```

Clean up duplicate data files:
```bash
npm run cleanup
```

### Web Interface

1. Generate the static HTML interface:
   ```bash
   npm run generate
   ```

2. Start the web server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

### NPM Scripts

- `npm run fetch-data` - Fetch latest player data
- `npm run generate` - Generate static HTML interface
- `npm start` - Start the web server
- `npm run cleanup` - Remove duplicate data files
- `npm run fetch-combat-achievements` - Fetch latest combat achievements data from the OSRS Wiki
- `npm run fetch-collection-log` - Fetch latest collection log data from the OSRS Wiki

## Combat Achievements Feature

The combat achievements comparison table displays all combat achievements that players have completed, organized by tier difficulty. Key features include:

- **Tier Organization**: Achievements grouped by difficulty (Easy, Medium, Hard, Elite, Master, Grandmaster)
- **Tier Icons**: Visual tier indicators showing achievement difficulty level
- **Achievement Information**: Achievement names with links to their respective wiki pages and tooltips showing descriptions
- **Player Progress**: Visual indicators showing which players have completed each achievement
- **Total Count**: Sticky bottom row showing total achievements completed with top 3 rankings
- **Responsive Filtering**: Dynamically updates when players are selected/deselected, hiding achievements no selected player has completed
- **Rich Metadata**: Achievement details sourced from the comprehensive combat achievements database

The system uses the complete combat achievements metadata from `game_data/combat_achievements.json` to provide detailed information about each achievement including descriptions, types, and difficulty tiers.

## Collection Log Feature

The collection log comparison table displays all items that players have obtained in their collection logs, similar to the [OSRS Wiki Collection Log Table](https://oldschool.runescape.wiki/w/Collection_log/Table). Key features include:

- **Item Icons**: High-quality item icons sourced from the OSRS Wiki
- **Item Information**: Item names with links to their respective wiki pages
- **Player Progress**: Visual indicators showing which players have obtained each item
- **Completion Percentages**: Real-time calculation of what percentage of selected players have each item
- **Responsive Filtering**: Dynamically updates when players are selected/deselected

## Data Sources

- **Primary API**: [RuneLite Player Data API](https://sync.runescape.wiki/runelite/player/{username}/STANDARD)
- **Item Icons**: [OSRS Wiki](https://oldschool.runescape.wiki/)
- **Data Types Collected**:
  - Quests (not started: 0, in progress: 1, completed: 2)
  - Skill levels (1-99+)
  - Achievement diaries (Easy, Medium, Hard, Elite completion status)
  - Music tracks (unlocked/locked boolean)
  - Combat achievements (task IDs array with detailed achievement metadata)
  - Collection log items (item IDs array with detailed item information)
  - League tasks (count)

## Player Configuration

Current tracked players (configured in `data_fetcher.js`):
- clintonhill (Karolis)
- anime irl (Martynas) 
- swamp party (Petras)
- juozulis (Minvydas)
- serasvasalas (Mangirdas)
- scarycorpse (Darius)
- dedspirit (Egle)

Display names are mapped in `generate_static.js` for better readability in the interface.

## Technical Details

- **Frontend**: Vanilla JavaScript with Chart.js for visualizations
- **Styling**: 98.css for retro Windows 98 aesthetic + custom CSS in `public/styles.css`
- **Data Format**: JSON files with ISO timestamp naming convention
- **Data Architecture**: Separated data generation from HTML template - all aggregated data is generated into `public/data.json` and fetched asynchronously by the frontend
- **State Management**: localStorage for UI preferences and window states
- **Responsive Design**: Flexible window layout with drag-and-drop functionality
- **CSS Architecture**: Separated inline styles into external CSS file for better maintainability

## Changelog

### Latest Changes
- **Data Separation**: Refactored data generation to extract all inline data from HTML into a separate `public/data.json` file. This improves code organization, reduces HTML file size, and enables better caching strategies. The web interface now fetches data asynchronously on page load.
- **CSS Refactoring**: Extracted all inline CSS from `generate_static.js` into a separate `public/styles.css` file for better maintainability and code organization. The HTML template now references the external stylesheet.
- **Removed Data Aggregation**: Eliminated date bucketing and grouping logic from charts. All data points are now displayed at full resolution without any aggregation or maxing operations, providing maximum detail in progress tracking.
- **Fixed Recent Achievements Table Styling**: Resolved inconsistent text styling where some rows appeared bold and others didn't. All rows now have consistent styling with a subtle left border indicator for achievements within the last 24 hours.

### Previous Features
- Interactive dashboard with Windows 98-style UI
- Comprehensive player progress tracking
- Real-time data filtering and comparison tables
- Persistent user preferences and window management
