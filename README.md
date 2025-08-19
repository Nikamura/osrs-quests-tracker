# OSRS Quest Tracker

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
- **Interactive Dashboard**: Windows 98-style UI with draggable, minimizable windows
- **Quest Progress Chart**: Line chart showing quest completion over time
- **Comparison Tables**: Side-by-side comparison of:
  - Quest completion status
  - Skill levels with color-coded ranges
  - Achievement diary progress
  - Music track unlocks
- **Recent Achievements**: Timeline of recent progress with player-specific colors
- **Player Selection**: Filter views by selected players with persistent preferences
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

## Data Sources

- **Primary API**: [RuneLite Player Data API](https://sync.runescape.wiki/runelite/player/{username}/STANDARD)
- **Data Types Collected**:
  - Quests (not started: 0, in progress: 1, completed: 2)
  - Skill levels (1-99+)
  - Achievement diaries (Easy, Medium, Hard, Elite completion status)
  - Music tracks (unlocked/locked boolean)
  - Combat achievements (count)
  - Collection log items (count)
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
