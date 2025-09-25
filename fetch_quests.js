import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'

async function fetchQuests() {
    try {
        console.log('Fetching quests list...')
        const page = await fetch('https://oldschool.runescape.wiki/w/Quests/List')
        const text = await page.text()

        const dom = new JSDOM(text)
        const document = dom.window.document

        const makeAbsoluteUrl = (url) => {
            if (!url) return null
            if (url.startsWith('//')) return `https:${url}`
            if (url.startsWith('/')) return `https://oldschool.runescape.wiki${url}`
            return url
        }

        const findSectionQuestTable = (headingText) => {
            const isQuestHeader = (table) => {
                const headerRow = table.querySelector('tr')
                if (!headerRow) return false
                const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase())
                // Expect at least these columns for the quest list tables
                const hasCore = headers.includes('name') && headers.includes('difficulty') && headers.includes('length')
                return hasCore
            }

            const headings = Array.from(document.querySelectorAll('h2, h3'))
            const heading = headings.find(h => h.textContent.trim().toLowerCase().includes(headingText))
            if (!heading) return null

            // Walk siblings until the next section heading
            let el = heading.nextElementSibling
            while (el && !(el.tagName && /^h2|h3$/i.test(el.tagName))) {
                if (el.tagName && el.tagName.toLowerCase() === 'table' && el.classList.contains('wikitable')) {
                    if (isQuestHeader(el)) return el
                }
                el = el.nextElementSibling
            }
            return null
        }

        const parseTable = (table, source) => {
            if (!table) return []
            const headerRow = table.querySelector('tr')
            const headers = headerRow ? Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase()) : []

            const idx = {
                name: headers.findIndex(h => h === 'name'),
                difficulty: headers.findIndex(h => h === 'difficulty'),
                length: headers.findIndex(h => h === 'length'),
                qp: headers.findIndex(h => h.includes('quest') && h.includes('points')),
                series: headers.findIndex(h => h === 'series'),
                release: headers.findIndex(h => h === 'release date')
            }

            const rows = Array.from(table.querySelectorAll('tr')).slice(1)

            // Fallback detection for Quest points column if header index not found
            let qpIndex = idx.qp
            if (qpIndex === -1 && rows.length) {
                const excluded = new Set([idx.name, idx.difficulty, idx.length, idx.series, idx.release].filter(i => i >= 0))
                let bestIdx = -1
                let bestScore = -1
                const sampleSize = Math.min(rows.length, 25)
                const maxColumns = Math.max(...rows.map(r => r.querySelectorAll('td').length))
                for (let c = 0; c < maxColumns; c++) {
                    if (excluded.has(c)) continue
                    // Exclude first column if it's the row number
                    if (headers[c] && headers[c].replace(/\s+/g, '') === '#') continue
                    let numericCount = 0
                    let validCount = 0
                    for (let r = 0; r < sampleSize; r++) {
                        const tds = rows[r].querySelectorAll('td')
                        if (c >= tds.length) continue
                        const txt = (tds[c].textContent || '').trim().toLowerCase()
                        if (!txt) continue
                        validCount++
                        if (txt === 'n/a') continue
                        if (/^\d+$/.test(txt)) numericCount++
                        else {
                            const m = txt.match(/\d+/)
                            if (m) numericCount++
                        }
                    }
                    const score = validCount ? numericCount / validCount : 0
                    if (score > bestScore) {
                        bestScore = score
                        bestIdx = c
                    }
                }
                // Consider it QP if majority of sampled cells look numeric
                if (bestScore >= 0.6) qpIndex = bestIdx
            }

            const entries = rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td'))
                if (!cells.length) return null

                const cellAt = (i) => i >= 0 && i < cells.length ? cells[i] : null

                const nameCell = cellAt(idx.name) || cells.find(td => td.querySelector('a')) || cells[0]
                const nameLink = nameCell ? nameCell.querySelector('a') : null
                const name = nameLink?.textContent?.trim() || nameCell?.textContent?.trim() || ''
                const nameWikiLink = nameLink ? makeAbsoluteUrl(nameLink.getAttribute('href')) : null

                if (!name) return null

                const difficulty = (cellAt(idx.difficulty)?.textContent || '').trim() || null
                const length = (cellAt(idx.length)?.textContent || '').trim() || null
                const questPointsText = (cellAt(qpIndex)?.textContent || '').trim()
                let questPoints = null
                if (questPointsText && questPointsText.toLowerCase() !== 'n/a') {
                    const match = questPointsText.match(/\d+/)
                    questPoints = match ? Number(match[0]) : null
                }

                const seriesCell = cellAt(idx.series)
                const series = seriesCell ? seriesCell.textContent.trim() : null
                const seriesLinks = seriesCell ? Array.from(seriesCell.querySelectorAll('a')).map(a => ({
                    text: a.textContent.trim(),
                    href: makeAbsoluteUrl(a.getAttribute('href'))
                })) : []

                const releaseDate = (cellAt(idx.release)?.textContent || '').trim() || null

                const isMiniquest = source === 'mini'
                const isFreeToPlay = source === 'f2p'
                const isMembers = source === 'members' || source === 'mini'

                return {
                    name,
                    nameWikiLink,
                    difficulty,
                    length,
                    questPoints,
                    series,
                    seriesLinks,
                    releaseDate,
                    isMiniquest,
                    isFreeToPlay,
                    isMembers
                }
            }).filter(Boolean)

            return entries
        }

        const f2pTable = findSectionQuestTable('free-to-play quests')
        const membersTable = findSectionQuestTable("members' quests")
        const miniTable = findSectionQuestTable('miniquests')

        const f2p = parseTable(f2pTable, 'f2p')
        const members = parseTable(membersTable, 'members')
        const mini = parseTable(miniTable, 'mini')

        const allQuests = [...f2p, ...members, ...mini]
        console.log(`Parsed quests: F2P=${f2p.length}, Members=${members.length}, Miniquests=${mini.length}, Total=${allQuests.length}`)

        const gameDataDir = 'game_data'
        if (!fs.existsSync(gameDataDir)) {
            fs.mkdirSync(gameDataDir, { recursive: true })
            console.log('Created game_data directory')
        }

        const filePath = path.join(gameDataDir, 'quests.json')
        fs.writeFileSync(filePath, JSON.stringify(allQuests, null, 2))
        console.log(`Quests saved to ${filePath}`)
        console.log('Sample data:', allQuests.slice(0, 2))

        return allQuests
    } catch (error) {
        console.error('Error fetching quests:', error)
    }
}

// Run the function
fetchQuests()


