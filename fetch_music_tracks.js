import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'

async function fetchMusicTracks() {
  try {
    console.log('Fetching music tracks data...')
    const page = await fetch('https://oldschool.runescape.wiki/w/Music')
    const text = await page.text()

    const dom = new JSDOM(text)
    const document = dom.window.document

    // Find the track list table by headers
    const tables = Array.from(document.querySelectorAll('table.wikitable'))
    const headerMatches = (table) => {
      const headerRow = table.querySelector('tr')
      if (!headerRow) return false
      const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase())
      return headers.includes('name') && headers.some(h => h.includes('unlock')) && headers.includes('members') && headers.includes('duration')
    }

    const table = tables.find(headerMatches)

    if (!table) {
      console.error('Music tracks table not found')
      return
    }

    console.log('Parsing music tracks table...')

    const makeAbsoluteUrl = (url) => {
      if (!url) return null
      if (url.startsWith('//')) return `https:${url}`
      if (url.startsWith('/')) return `https://oldschool.runescape.wiki${url}`
      return url
    }

    const rows = Array.from(table.querySelectorAll('tr')).filter(tr => tr.querySelectorAll('td').length >= 5)

    const musicTracks = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td'))

      const nameCell = cells[0]
      const unlockCell = cells[1]
      const membersCell = cells[2]
      const durationCell = cells[3]
      const trackCell = cells[4]

      const nameLink = nameCell.querySelector('a')
      const nameText = nameCell.textContent.trim()
      const nameWikiLink = nameLink ? makeAbsoluteUrl(nameLink.getAttribute('href')) : null
      const isExclusive = !!nameCell.querySelector('b')
      const isHoliday = !!nameCell.querySelector('i')

      const unlockDetails = unlockCell.textContent.trim()
      const unlockLinks = Array.from(unlockCell.querySelectorAll('a'))
        .map(a => makeAbsoluteUrl(a.getAttribute('href')))
        .filter(Boolean)

      const membersText = (membersCell.querySelector('a')?.textContent?.trim() || membersCell.textContent.trim() || '').toLowerCase()
      const isMembers = membersText.includes('members') || membersText.startsWith('1')

      const duration = durationCell.textContent.trim()

      const trackLink = trackCell.querySelector('a')?.getAttribute('href')
      const trackOggUrl = makeAbsoluteUrl(trackLink)

      return {
        name: nameText,
        nameWikiLink,
        unlockDetails,
        unlockLinks,
        members: isMembers,
        duration,
        trackOggUrl,
        isExclusive,
        isHoliday
      }
    })

    console.log(`Parsed ${musicTracks.length} music tracks`)

    const gameDataDir = 'game_data'
    if (!fs.existsSync(gameDataDir)) {
      fs.mkdirSync(gameDataDir, { recursive: true })
      console.log('Created game_data directory')
    }

    const filePath = path.join(gameDataDir, 'music_tracks.json')
    const jsonData = JSON.stringify(musicTracks, null, 2)
    fs.writeFileSync(filePath, jsonData)

    console.log(`Music tracks saved to ${filePath}`)
    console.log('Sample data:', musicTracks.slice(0, 2))

    return musicTracks
  } catch (error) {
    console.error('Error fetching music tracks:', error)
  }
}

// Run the function
fetchMusicTracks()


