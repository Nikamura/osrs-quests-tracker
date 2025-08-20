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
  - Music track unlocks
  - Collection log progress with item icons and completion percentages
- **Recent Achievements**: Timeline of recent progress with player-specific colors
- **Player Selection**: Filter views by selected players with persistent preferences
- **Window Management**: Configure which windows are shown/hidden with persistent preferences
- **State Synchronization**: Window positions and states sync across browser tabs

## Project Structure

```
osrs-quest-tracker/
├── data_fetcher.js         # Fetches player data from RuneLite API
├── generate_static.js      # Generates static HTML with all data and features
├── server.js               # Express server to serve the web interface
├── cleanup_player_data.js  # Removes duplicate consecutive data files
├── player_data/            # Directory storing timestamped JSON files per player
├── public/                 # Generated static files (index.html)
├── package.json            # Project metadata and npm scripts
├── jsconfig.json          # JavaScript language service configuration
└── README.md              # This documentation
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

3. Configure players (optional):
   Edit the `players` array in `data_fetcher.js` to track different players.

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

## Collection Log Feature

The collection log comparison table displays all items that players have obtained in their collection logs, similar to the [OSRS Wiki Collection Log Table](https://oldschool.runescape.wiki/w/Collection_log/Table). Key features include:

- **Item Icons**: High-quality item icons sourced from the OSRS Wiki
- **Item Information**: Item names with links to their respective wiki pages
- **Player Progress**: Visual indicators showing which players have obtained each item
- **Completion Percentages**: Real-time calculation of what percentage of selected players have each item
- **Responsive Filtering**: Dynamically updates when players are selected/deselected
- **Fallback Icons**: Graceful handling of missing item icons with fallback images

The system fetches item metadata from the OSRSBox database to provide rich item information while using the official OSRS Wiki images for the best visual experience.

## Data Sources

- **Primary API**: [RuneLite Player Data API](https://sync.runescape.wiki/runelite/player/{username}/STANDARD)
- **Secondary API**: [OSRSBox Items Database](https://www.osrsbox.com/osrsbox-db/items-summary.json)
- **Item Icons**: [OSRS Wiki](https://oldschool.runescape.wiki/)
- **Data Types Collected**:
  - Quests (not started: 0, in progress: 1, completed: 2)
  - Skill levels (1-99+)
  - Achievement diaries (Easy, Medium, Hard, Elite completion status)
  - Music tracks (unlocked/locked boolean)
  - Combat achievements (count)
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
- **Styling**: 98.css for retro Windows 98 aesthetic
- **Data Format**: JSON files with ISO timestamp naming convention
- **State Management**: localStorage for UI preferences and window states
- **Responsive Design**: Flexible window layout with drag-and-drop functionality
