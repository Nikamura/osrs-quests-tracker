import { makeAbsoluteUrl, fetchWikiPage, saveGameData } from './fetch_utils.js';

async function fetchMusicTracks() {
  try {
    console.log('Fetching music tracks data...')
    const document = await fetchWikiPage('https://oldschool.runescape.wiki/w/Music');

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
    saveGameData('music_tracks.json', musicTracks)
    console.log('Sample data:', musicTracks.slice(0, 2))

    return musicTracks
  } catch (error) {
    console.error('Error fetching music tracks:', error)
  }
}

fetchMusicTracks()
