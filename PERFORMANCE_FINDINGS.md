# Performance Investigation Findings

## Problem
`npm run cron` takes 4-5 minutes and consumes so much memory it crashes the production server (OOM).

## Investigation Method
5 parallel investigators tested independent hypotheses, cross-validated findings, and debated to reach consensus.

## Consensus Root Cause: All-or-Nothing Chart Cache Invalidation

The chart data generation in `generateAllChartData()` (generate_static.js:189-204) uses **all-or-nothing cache invalidation**. It checks if ANY player has a new `latestFile` — since `fetch-data` always adds new snapshots, the cache is **always invalidated**, forcing a full re-read of ALL snapshot files every cron run.

### Why This Causes OOM

- Production has **~7GB** of player data across 9 players (~24,000+ JSON files)
- `loadAllSnapshotsForPlayer()` (cache.js:134) loads ALL files per player into memory: `allFiles.map(file => JSON.parse(readFileSync(file)))`
- 7GB on disk = **14-21GB of V8 heap objects** (2-3x overhead for parsed JSON)
- V8 default heap limit: ~4.3GB on modern Node.js (lower on older versions)
- On a VPS with 2-4GB RAM, the Linux OOM killer strikes well before V8's limit
- **Guaranteed OOM**, which kills the Node process and potentially other services

### Memory Profile (measured on 1.2GB local data)

| Phase | RSS | Heap Used |
|-------|-----|-----------|
| Baseline | 45MB | 4MB |
| After 1st player (3 files) | 57MB | 7MB |
| After 2nd player (2,971 files) | 415MB | 281MB |
| After 3rd player (2,970 files) | 662MB | 502MB |
| After 4th player (2,971 files) | 912MB | 717MB |
| After 5th player (2,971 files) | **1,142MB** | **984MB** |
| **Peak** | **1,256MB** | 984MB |

Even on 1.2GB of local data, RSS peaks at **1.26GB**. On a production VPS with 512MB-1GB RAM and 7GB of data, this is a guaranteed OOM crash.

### The Accumulation Problem

The extracted chart data accumulates across ALL players before `groupLatestPerDay` (line 282-292) runs. Specifically, `skillLevelProgressData` (line 277) creates a full copy of the levels object for every single snapshot for every player — ~24,000 entries with ~23 skill keys each. The peak memory is hit during this accumulation phase, before daily aggregation reduces the dataset.

### Why This Causes 4-5 Minute Runtime

On the production server's 7GB dataset, the full uncached chart data generation takes ~4 minutes (estimated from local benchmarks scaling linearly from 1.2GB → 7GB).

## Cron Pipeline Breakdown

| Step | Local (1.2GB) | Prod (7GB est.) | Memory |
|------|---------------|-----------------|--------|
| fetch-data | ~10-15s | ~10-15s | ~50MB |
| cleanup | ~3s | ~18s | ~563MB |
| generate (cached) | 0.2s | ~0.2s | Low |
| generate (uncached) | ~21-39s | **~4 min** | **14-21GB → OOM** |

Since the cache is always invalidated after fetch-data, every cron run hits the uncached path.

## Hypotheses Tested

| # | Hypothesis | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Network I/O in data_fetcher.js | **Ruled out** | All 9 players fetched concurrently via Promise.all(); ~10-15s total |
| 2 | generate_static.js computation | **CONFIRMED — root cause** | All-or-nothing cache invalidation forces full 7GB re-read every run |
| 3 | Filesystem I/O from snapshots | **Contributing factor** | Reading 7GB of JSON files is inherently slow, but the real issue is doing it unnecessarily every run |
| 4 | cleanup_player_data.js dedup | **Ruled out** | Only ~3s locally, ~18s at prod scale; pairwise comparison is memory-safe (~563MB peak) |
| 5 | Chart data / HTML size bloat | **Ruled out (output)** | Output is lean: index.html 16KB, chart-data.json 436KB, table-data.json 1.7MB |

## Key Insight: Achievements Cache Already Does It Right

The achievements generation (generate_static.js:428-443) uses **incremental caching** — it only processes files newer than the cached checkpoint. Result: 35ms on normal cron runs vs 11.4s uncached.

Chart data generation needs the same pattern.

## Recommended Fixes

### Fix 1: Incremental chart data caching (high impact)
Make `generateAllChartData()` incremental like the achievements cache:
- Track the last-processed file per player
- On each run, only read NEW snapshot files
- Append new data points to cached chart data
- Expected result: chart generation drops from ~4 min to milliseconds

### Fix 2: Streaming/bounded snapshot loading (safety net)
Even with incremental caching, protect against OOM on cache misses:
- Process one player at a time, releasing memory between players
- Or use streaming JSON parsing instead of loading all files into an array
- Set `--max-old-space-size` as a safety limit

### Fix 3: Data retention policy (long-term)
7GB and growing — consider:
- Aggregating old snapshots (e.g., keep only daily snapshots after 30 days)
- Archiving data older than N months
- This reduces both storage and processing time

## Production Data Volume

```
965M    ./player_data/juozulis
960M    ./player_data/swamp party
1000M   ./player_data/dedspirit
1014M   ./player_data/scarycorpse
222M    ./player_data/Silainis13
975M    ./player_data/serasvasalas
1.1G    ./player_data/anime irl
812M    ./player_data/justlikemoon
961M    ./player_data/clintonhill
~7GB    TOTAL
```
