# OSRS Quest Tracker

## Overview

This project is a tool to track Old School RuneScape (OSRS) quest progress for a group of friends. It consists of two main components:
1.  A data fetcher that periodically retrieves quest data for specified players.
2.  A data aggregator and display component that presents the collected data in a user-friendly way.

## Features

-   **Data Fetching**: Periodically fetches quest completion data from the [RuneLite API](https://sync.runescape.wiki/) for a list of players.
-   **Data Storage**: Stores player data locally in timestamped JSON files. 
-   **Data Display**: A web interface to view and compare quest progress among friends.

## Project Structure

```
osrs-quest-tracker/
├── data_fetcher.js     # Script to fetch player quest data
├── server.js           # Script to serve the quest data as a web page
├── player_data/        # Directory to store fetched data for each player
├── package.json        # Project metadata and dependencies
├── jsconfig.json       # JS language service configuration
└── README.md           # This file
```

## Requirements

-   [Node.js](https://nodejs.org/) (v14.x or higher recommended)

This project currently has no external npm dependencies.

## Setup and Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd osrs-quest-tracker
    ```

2.  Install dependencies (if any are added in the future):
    ```bash
    npm install
    ```

## Usage

To fetch quest data for players, you can run the `fetch-data` script:

```bash
npm run fetch-data
```

To view the quest progress chart, run the web server:

```bash
npm start
```

Then, open your web browser and navigate to `http://localhost:3000`.

The list of players to track is hardcoded in the `players` array within `data_fetcher.js`. You will need to modify this array to track different players.

Each time the script is run, it creates a new timestamped JSON file for each player in the `player_data/{playerName}/` directory.

## Future Work

-   Create a frontend to display the quest data in a sortable, filterable table.
-   Add historical tracking to see quest completion over time.
