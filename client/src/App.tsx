import { useState, useEffect } from 'react'
import { Destination, DestinationWithResult, TravelResult, TravelLeg, TransportMode } from './types'
import DestinationList from './components/DestinationList'
import ResultsPanel from './components/ResultsPanel'
import AddressAutocomplete from './components/AddressAutocomplete'
import { apiFetch, getStoredApiKey, saveApiKey } from './utils/apiFetch'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function formatTimeClient(unixSeconds: number, use12Hour = false): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: use12Hour })
}

function fmtDur(minutes: number): string {
  if (minutes <= 0) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

const STORAGE_KEY = 'travel-planner-state'

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Reads ?share= URL param once at module load, hydrates form, then clears the param
const urlShare: Record<string, unknown> | null = (() => {
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('share')
    if (!encoded) return null
    const decoded = JSON.parse(atob(encoded))
    window.history.replaceState({}, '', window.location.pathname)
    return decoded
  } catch {
    return null
  }
})()

function getInitialState() {
  return (urlShare ?? loadSaved() ?? {}) as Partial<{
    homeAddress: string
    planDate: string
    parkingBufferMinutes: number
    destinations: Destination[]
    selectedCountry: string
    selectedModes: TransportMode[]
  }>
}

const DARK_KEY = 'travel-planner-dark'
const USE_12H_KEY   = 'travel-planner-12h'
const SAVED_TRIPS_KEY = 'travel-planner-saved-trips'

interface SavedTrip {
  id: string
  name: string
  savedAt: number
  state: {
    homeAddress: string
    planDate: string
    parkingBufferMinutes: number
    destinations: Destination[]
    selectedCountry: string
    selectedModes: TransportMode[]
  }
}

const COUNTRIES = [
  { label: 'All countries', code: '' },
  { label: 'Australia', code: 'au' },
  { label: 'Canada', code: 'ca' },
  { label: 'France', code: 'fr' },
  { label: 'Germany', code: 'de' },
  { label: 'India', code: 'in' },
  { label: 'Ireland', code: 'ie' },
  { label: 'Italy', code: 'it' },
  { label: 'Japan', code: 'jp' },
  { label: 'Malaysia', code: 'my' },
  { label: 'Mexico', code: 'mx' },
  { label: 'Netherlands', code: 'nl' },
  { label: 'New Zealand', code: 'nz' },
  { label: 'Philippines', code: 'ph' },
  { label: 'Singapore', code: 'sg' },
  { label: 'South Korea', code: 'kr' },
  { label: 'Spain', code: 'es' },
  { label: 'Sweden', code: 'se' },
  { label: 'United Kingdom', code: 'gb' },
  { label: 'United States', code: 'us' },
]

const COUNTRY_EXAMPLES: Record<string, { home: string; stop: string }> = {
  '':   { home: 'e.g. 123 Main St, Toronto, ON',            stop: 'e.g. 555 University Ave, Toronto, ON' },
  au:   { home: 'e.g. 25 Martin Pl, Sydney NSW 2000',       stop: 'e.g. 1 Melbourne Airport Dr, Tullamarine VIC' },
  ca:   { home: 'e.g. 123 Main St, Toronto, ON',            stop: 'e.g. 555 University Ave, Toronto, ON' },
  fr:   { home: 'e.g. 5 Rue de Rivoli, Paris',              stop: 'e.g. Aéroport Charles de Gaulle, Paris' },
  de:   { home: 'e.g. Unter den Linden 1, Berlin',          stop: 'e.g. Alexanderplatz 1, Berlin' },
  in:   { home: 'e.g. 1 MG Road, Bengaluru 560001',         stop: 'e.g. Indira Gandhi International Airport, Delhi' },
  ie:   { home: 'e.g. 1 Grafton St, Dublin 2',              stop: 'e.g. Dublin Airport, Swords, Co. Dublin' },
  it:   { home: 'e.g. Via del Corso 1, Rome',               stop: 'e.g. Piazza del Duomo, Milan' },
  jp:   { home: 'e.g. 1-1 Shinjuku, Tokyo 160-0022',        stop: 'e.g. 1-1 Marunouchi, Chiyoda, Tokyo' },
  my:   { home: 'e.g. 50 Jalan Bukit Bintang, Kuala Lumpur',stop: 'e.g. KL Sentral, Kuala Lumpur' },
  mx:   { home: 'e.g. Av. Insurgentes Sur 1, CDMX',         stop: 'e.g. Aeropuerto Internacional Ciudad de México' },
  nl:   { home: 'e.g. Damrak 1, Amsterdam',                 stop: 'e.g. Amsterdam Centraal, Amsterdam' },
  nz:   { home: 'e.g. 1 Queen St, Auckland 1010',           stop: 'e.g. Auckland Airport, Māngere' },
  ph:   { home: 'e.g. 1 Roxas Blvd, Manila',                stop: 'e.g. Ninoy Aquino International Airport, Manila' },
  sg:   { home: 'e.g. 1 Orchard Rd, Singapore 238801',      stop: 'e.g. Singapore Changi Airport, Singapore' },
  kr:   { home: 'e.g. 152 Teheran-ro, Gangnam-gu, Seoul',   stop: 'e.g. Seoul Station, Yongsan-gu, Seoul' },
  es:   { home: 'e.g. Gran Via 1, Madrid 28013',             stop: 'e.g. Aeropuerto Adolfo Suárez, Madrid' },
  se:   { home: 'e.g. Drottninggatan 1, Stockholm',          stop: 'e.g. Stockholm Centralstation, Stockholm' },
  gb:   { home: 'e.g. 10 Downing St, London SW1A 2AA',      stop: 'e.g. King\'s Cross Station, London N1 9AL' },
  us:   { home: 'e.g. 350 5th Ave, New York, NY 10118',     stop: 'e.g. 1 Infinite Loop, Cupertino, CA' },
}

function App() {
  const [homeAddress, setHomeAddress] = useState<string>(() => getInitialState()?.homeAddress ?? '')
  const [planDate, setPlanDate] = useState<string>(() => getInitialState()?.planDate ?? getTodayDate())
  const [parkingBufferMinutes, setParkingBufferMinutes] = useState<number>(() => getInitialState()?.parkingBufferMinutes ?? 5)
  const [destinations, setDestinations] = useState<Destination[]>(() => {
    const saved = getInitialState()?.destinations
    return (Array.isArray(saved) && saved.length > 0)
      ? saved
      : [{ id: generateId(), label: '', address: '', arrivalTime: '' }]
  })
  const [selectedCountry, setSelectedCountry] = useState<string>(() => getInitialState()?.selectedCountry ?? '')
  const [selectedModes, setSelectedModes] = useState<TransportMode[]>(() => {
    const saved = getInitialState()?.selectedModes
    return (Array.isArray(saved) && saved.length > 0) ? saved : ['driving', 'transit']
  })
  const [shareLabel, setShareLabel] = useState<'share' | 'copied'>('share')
  const [results, setResults] = useState<DestinationWithResult[]>([])
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [delayMinutes, setDelayMinutes] = useState(0)
  const [resultsCalculatedAt, setResultsCalculatedAt] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [savingTrip, setSavingTrip] = useState(false)
  const [tripNameInput, setTripNameInput] = useState('')
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(() => {
    try { const raw = localStorage.getItem(SAVED_TRIPS_KEY); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })

  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem(DARK_KEY) === 'true' } catch { return false }
  })

  // 12h / 24h format
  const [use12Hour, setUse12Hour] = useState<boolean>(() => {
    try { return localStorage.getItem(USE_12H_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    try { localStorage.setItem(DARK_KEY, String(darkMode)) } catch { /* ignore */ }
  }, [darkMode])

  useEffect(() => {
    try { localStorage.setItem(USE_12H_KEY, String(use12Hour)) } catch { /* ignore */ }
  }, [use12Hour])

  useEffect(() => {
    try { localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(savedTrips)) } catch { /* ignore */ }
  }, [savedTrips])

  const toggleDark = () => setDarkMode(prev => !prev)

  // API key management — only relevant when server has no key configured
  const [requiresApiKey, setRequiresApiKey] = useState<boolean | null>(null) // null = loading
  const [userKey, setUserKey] = useState<string | null>(() => getStoredApiKey())
  const [keyInput, setKeyInput] = useState('')
  const [keyValidating, setKeyValidating] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const isActivated = requiresApiKey === null ? false : (!requiresApiKey || !!userKey)

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((d: { requiresApiKey: boolean }) => setRequiresApiKey(d.requiresApiKey))
      .catch(() => setRequiresApiKey(false)) // fail open if server unreachable
  }, [])

  const activateKey = async () => {
    const k = keyInput.trim()
    if (!k) return
    setKeyValidating(true)
    setKeyError(null)
    try {
      const res = await fetch('/api/validate-key', {
        headers: { 'X-Google-Api-Key': k },
      })
      const data: { valid: boolean; error?: string } = await res.json()
      if (data.valid) {
        saveApiKey(k)
        setUserKey(k)
      } else {
        setKeyError(data.error ?? 'Key validation failed.')
      }
    } catch {
      setKeyError('Could not reach the server to validate the key.')
    } finally {
      setKeyValidating(false)
    }
  }

  // Persist form state to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ homeAddress, planDate, parkingBufferMinutes, destinations, selectedCountry, selectedModes }))
    } catch { /* quota exceeded or private mode — ignore */ }
  }, [homeAddress, planDate, parkingBufferMinutes, destinations, selectedCountry, selectedModes])

  const addDestination = () => {
    setDestinations(prev => [
      ...prev,
      { id: generateId(), label: '', address: '', arrivalTime: '' },
    ])
  }

  const removeDestination = (id: string) => {
    setDestinations(prev => prev.filter(d => d.id !== id))
  }

  const updateDestination = (id: string, field: keyof Destination, value: string) => {
    setDestinations(prev => prev.map(d => (d.id === id ? { ...d, [field]: value } : d)))
  }

  const toggleMode = (mode: TransportMode) => {
    setSelectedModes(prev =>
      prev.includes(mode)
        ? (prev.length === 1 ? prev : prev.filter(m => m !== mode))
        : [...prev, mode]
    )
  }

  const updateDestinationDwell = (id: string, minutes: number) => {
    setDestinations(prev => prev.map(d => d.id === id ? { ...d, dwellMinutes: minutes } : d))
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation is not supported by your browser.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const res = await apiFetch(`/api/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
          const data: { address: string | null; error?: string } = await res.json()
          if (data.address) setHomeAddress(data.address)
          else setError(data.error ?? 'Could not determine your address.')
        } catch { setError('Failed to fetch your address.') }
        finally { setLocating(false) }
      },
      err => {
        setLocating(false)
        setError(err.code === err.PERMISSION_DENIED
          ? 'Location access denied. Please allow location access in your browser settings.'
          : 'Could not get your location.')
      }
    )
  }

  const handleExportICS = () => {
    if (results.length === 0) return
    const lines: string[] = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Travel Planner//EN', 'CALSCALE:GREGORIAN',
    ]
    const allModes: TransportMode[] = ['driving', 'transit', 'walking', 'cycling']
    results.forEach(r => {
      for (const mode of allModes) {
        const leg = r.result?.[mode] as TravelLeg | null | undefined
        if (!leg) continue
        const dtStart = new Date(leg.departureTime * 1000)
        const dtEnd = new Date((r.arrivalTimestamp ?? leg.departureTime + leg.durationSeconds) * 1000)
        const fmtIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        const modeLabel = { driving: 'Drive', transit: 'Transit', walking: 'Walk', cycling: 'Cycle' }[mode]
        lines.push('BEGIN:VEVENT',
          `DTSTART:${fmtIcs(dtStart)}`,
          `DTEND:${fmtIcs(dtEnd)}`,
          `SUMMARY:${modeLabel} to ${r.label || r.address}`,
          `DESCRIPTION:${r.originLabel} to ${r.label || r.address}\\n${leg.durationText}${leg.distanceText ? ' / ' + leg.distanceText : ''}`,
          'END:VEVENT')
      }
    })
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `travel-plan-${planDate}.ics`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveTrip = () => {
    const trip: SavedTrip = {
      id: generateId(),
      name: tripNameInput.trim() || `Plan ${new Date(planDate).toLocaleDateString()}`,
      savedAt: Date.now(),
      state: { homeAddress, planDate, parkingBufferMinutes, destinations, selectedCountry, selectedModes },
    }
    setSavedTrips(prev => [trip, ...prev])
    setSavingTrip(false)
    setTripNameInput('')
  }

  const handleLoadTrip = (trip: SavedTrip) => {
    setHomeAddress(trip.state.homeAddress)
    setPlanDate(trip.state.planDate)
    setParkingBufferMinutes(trip.state.parkingBufferMinutes)
    setDestinations(trip.state.destinations)
    setSelectedCountry(trip.state.selectedCountry)
    setSelectedModes(trip.state.selectedModes)
    setResults([])
    setResultsCalculatedAt(null)
    setError(null)
  }

  const handleDeleteTrip = (id: string) => {
    setSavedTrips(prev => prev.filter(t => t.id !== id))
  }

  const handleOptimizeOrder = async () => {
    const valid = destinations.filter(d => d.address.trim() && d.arrivalTime)
    if (valid.length < 3) return
    setOptimizing(true)
    try {
      const stops = valid.map(d => d.address.trim())
      const res = await apiFetch('/api/optimize-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: homeAddress.trim(), stops }),
      })
      if (!res.ok) throw new Error('Optimize failed')
      const { optimizedOrder }: { optimizedOrder: number[] } = await res.json()
      const orderedValid = optimizedOrder.map(i => valid[i])
      const validIds = new Set(valid.map(d => d.id))
      const others = destinations.filter(d => !validIds.has(d.id))
      setDestinations([...orderedValid, ...others])
    } catch { setError('Could not optimize stop order.') }
    finally { setOptimizing(false) }
  }

  const calculate = async () => {
    if (!homeAddress.trim()) {
      setError('Please enter your starting location.')
      return
    }

    const valid = destinations.filter(d => d.address.trim() && d.arrivalTime)
    if (valid.length === 0) {
      setError('Please add at least one destination with an address and arrival time.')
      return
    }

    setError(null)
    setCalculating(true)

    // Build chained legs: each stop departs from the previous stop (or home for the first)
    const legs = valid.map((dest, i) => ({
      dest,
      originAddress: i === 0 ? homeAddress.trim() : valid[i - 1].address.trim(),
      originLabel: i === 0 ? 'Home' : (valid[i - 1].label.trim() || `Stop ${i}`),
    }))

    setResults(legs.map(({ dest, originAddress, originLabel }) => ({
      ...dest,
      originAddress,
      originLabel,
      parkingBufferMinutes,
      loading: true,
    })))

    const settled = await Promise.allSettled(
      legs.map(async ({ dest, originAddress }) => {
        const [hours, minutes] = dest.arrivalTime.split(':').map(Number)
        const arrivalDate = new Date(`${planDate}T00:00:00`)
        arrivalDate.setHours(hours, minutes, 0, 0)
        const arrivalTimestamp = Math.floor(arrivalDate.getTime() / 1000)
        // Tell Google to arrive parkingBufferMinutes early so we have time to park & walk in
        const effectiveArrivalTimestamp = arrivalTimestamp - parkingBufferMinutes * 60

        const response = await apiFetch('/api/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: originAddress,
            destination: dest.address.trim(),
            arrivalTime: effectiveArrivalTimestamp,
            modes: selectedModes,
          }),
        })

        if (!response.ok) throw new Error('Failed to fetch directions')
        return response.json() as Promise<TravelResult>
      })
    )

    // Compute arrival timestamps first — needed for time-at-stop display and conflict detection
    const arrivalTimestamps = valid.map(dest => {
      const [h, m] = dest.arrivalTime.split(':').map(Number)
      const d = new Date(`${planDate}T00:00:00`)
      d.setHours(h, m, 0, 0)
      return Math.floor(d.getTime() / 1000)
    })

    const finalResults: DestinationWithResult[] = legs.map(({ dest, originAddress, originLabel }, i) => {
      const arrivalTimestamp = arrivalTimestamps[i]
      const outcome = settled[i]
      if (outcome.status === 'fulfilled') {
        return { ...dest, originAddress, originLabel, parkingBufferMinutes, arrivalTimestamp, result: outcome.value, loading: false }
      }
      return {
        ...dest,
        originAddress,
        originLabel,
        parkingBufferMinutes,
        arrivalTimestamp,
        result: { driving: null, transit: null, error: 'Could not fetch directions for this stop.' },
        loading: false,
      }
    })

    // Detect impossible timings: if stop[i] needs to depart before stop[i-1] is even reached
    const allModesArr: TransportMode[] = ['driving', 'transit', 'walking', 'cycling']
    for (let i = 1; i < finalResults.length; i++) {
      const prev = finalResults[i - 1]
      const cur = finalResults[i]
      const prevArrivalTs = arrivalTimestamps[i - 1]
      const prevDwellSec = (prev.dwellMinutes ?? 0) * 60
      const leaveAfter = prevArrivalTs + prevDwellSec

      const conflictingDeparts = allModesArr
        .filter(m => selectedModes.includes(m))
        .map(m => cur.result?.[m]?.departureTime)
        .filter((t): t is number => t !== undefined && t < leaveAfter)

      if (conflictingDeparts.length > 0) {
        const prevLabel = prev.label.trim() || `Stop ${i}`
        const nextLabel = cur.label.trim() || `Stop ${i + 1}`
        const conflictDepart = Math.min(...conflictingDeparts)
        const gapMin = Math.ceil((leaveAfter - conflictDepart) / 60)
        const suggestedArrival = formatTimeClient(prevArrivalTs - gapMin * 60, use12Hour)
        const arrivalAtPrev = formatTimeClient(prevArrivalTs, use12Hour)
        const requiredDepartStr = formatTimeClient(conflictDepart, use12Hour)

        let warning: string
        if (prevDwellSec > 0) {
          const plannedDwell = Math.round(prevDwellSec / 60)
          const actualDwellMin = Math.max(0, Math.round((conflictDepart - prevArrivalTs) / 60))
          const idealDepartStr = formatTimeClient(leaveAfter, use12Hour)
          warning =
            `⚠️ Not enough time at ${prevLabel}: you planned ${fmtDur(plannedDwell)} there ` +
            `(arriving ${arrivalAtPrev}, ideal departure ${idealDepartStr}), but reaching ${nextLabel} on time ` +
            `requires leaving by ${requiredDepartStr} — only ${fmtDur(actualDwellMin)} instead of ${fmtDur(plannedDwell)}. ` +
            `To keep your full ${fmtDur(plannedDwell)}, try arriving at ${prevLabel} by ${suggestedArrival} instead.`
        } else {
          warning =
            `⚠️ Timing conflict at ${prevLabel}: to reach ${nextLabel} on time you need to leave by ` +
            `${requiredDepartStr}, but you don't arrive there until ${arrivalAtPrev} (${gapMin} min gap). ` +
            `Try moving your arrival at ${prevLabel} to ${suggestedArrival} or earlier.`
        }

        finalResults[i] = { ...cur, impossibilityWarning: warning }
      }
    }

    setResults(finalResults)
    setResultsCalculatedAt(Date.now())
    setCalculating(false)
  }

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setHomeAddress('')
    setPlanDate(getTodayDate())
    setParkingBufferMinutes(5)
    setDestinations([{ id: generateId(), label: '', address: '', arrivalTime: '' }])
    setSelectedCountry('')
    setSelectedModes(['driving', 'transit'])
    setDelayMinutes(0)
    setResults([])
    setResultsCalculatedAt(null)
    setError(null)
  }

  const handleShare = () => {
    const state = { homeAddress, planDate, parkingBufferMinutes, destinations, selectedCountry, selectedModes }
    try {
      const encoded = btoa(JSON.stringify(state))
      const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`
      navigator.clipboard.writeText(url).then(
        () => { setShareLabel('copied'); setTimeout(() => setShareLabel('share'), 2500) },
        () => { window.prompt('Copy this share link:', url) },
      )
    } catch {
      // ignore
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-text">
            <h1>🗺️ Travel Planner</h1>
            <p>Find out when you need to leave to arrive on time</p>
          </div>
          <div className="header-toggles">
            <button
              className="time-format-toggle"
              onClick={() => setUse12Hour(v => !v)}
              title="Toggle 12h/24h time format"
            >
              {use12Hour ? '12h' : '24h'}
            </button>
            <button
              className={`theme-toggle${darkMode ? ' theme-toggle--dark' : ''}`}
              onClick={toggleDark}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="theme-toggle-thumb">{darkMode ? '🌙' : '☀️'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {requiresApiKey && (
          <section className="section api-key-section">
            <h2 className="section-title">🔑 Google Maps API Key</h2>
            {!userKey ? (
              <>
                <p className="api-key-hint">
                  This app proxies Google Maps — enter your own API key to unlock all features.{' '}
                  <a
                    href="https://developers.google.com/maps/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="api-key-link"
                  >
                    Get a free key →
                  </a>
                </p>
                <div className="api-key-row">
                  <input
                    className={`input${keyError ? ' input-error' : ''}`}
                    type="password"
                    placeholder="Paste your Google Maps API key (AIza...)"
                    value={keyInput}
                    onChange={e => { setKeyInput(e.target.value); setKeyError(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') activateKey() }}
                    autoComplete="off"
                  />
                  <button
                    className="btn-activate"
                    onClick={activateKey}
                    disabled={!keyInput.trim() || keyValidating}
                  >
                    {keyValidating ? '⏳ Checking...' : 'Activate'}
                  </button>
                </div>
                {keyError && <div className="api-key-error">{keyError}</div>}
              </>
            ) : (
              <div className="api-key-active">
                <span>🔑 API key active</span>
                <button
                  className="btn-change-key"
                  onClick={() => { saveApiKey(null); setUserKey(null); setKeyInput('') }}
                >
                  Change key
                </button>
              </div>
            )}
          </section>
        )}

        <div className={isActivated ? 'form-body' : 'form-body form-locked'}>

        {savedTrips.length > 0 && (
          <section className="section saved-trips-section">
            <h2 className="section-title">📁 Saved Plans</h2>
            {savedTrips.map(trip => (
              <div key={trip.id} className="saved-trip-item">
                <div className="saved-trip-meta">
                  <span className="saved-trip-name">{trip.name}</span>
                  <span className="saved-trip-date">{new Date(trip.savedAt).toLocaleDateString()}</span>
                </div>
                <div className="saved-trip-actions">
                  <button className="btn-load-trip" onClick={() => handleLoadTrip(trip)}>Load</button>
                  <button className="btn-delete-trip" onClick={() => handleDeleteTrip(trip.id)}>✕</button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="section">
          <div className="country-row">
            <label className="label-inline" htmlFor="country-filter">🌍 Country</label>
            <select
              id="country-filter"
              className="select-country"
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="top-fields">
            <div className="top-field-main">
              <label className="label" htmlFor="home-address">
                📍 Starting Location
              </label>
              <div className="home-address-row">
                <AddressAutocomplete
                  id="home-address"
                  className="input"
                  placeholder={(COUNTRY_EXAMPLES[selectedCountry] ?? COUNTRY_EXAMPLES['']).home}
                  value={homeAddress}
                  onChange={setHomeAddress}
                  countryCode={selectedCountry}
                />
                <button
                  className="btn-locate"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  title="Use my current location"
                >
                  {locating ? '⏳' : '📍 Locate me'}
                </button>
              </div>
            </div>
            <div className="top-field-side">
              <label className="label" htmlFor="plan-date">
                📅 Date
              </label>
              <input
                id="plan-date"
                className="input"
                type="date"
                value={planDate}
                min={getTodayDate()}
                onChange={e => setPlanDate(e.target.value)}
              />
            </div>
          </div>

          <div className="parking-row">
            <label className="label-inline" htmlFor="parking-buffer">
              🅿️ Parking buffer (driving)
            </label>
            <select
              id="parking-buffer"
              className="select-small"
              value={parkingBufferMinutes}
              onChange={e => setParkingBufferMinutes(Number(e.target.value))}
            >
              <option value={0}>None</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
            </select>
          </div>

          <div className="mode-checkboxes">
            <span className="label-inline">🚦 Transport modes</span>
            {([
              { mode: 'driving' as TransportMode, label: '🚗 Driving' },
              { mode: 'transit' as TransportMode, label: '🚌 Transit' },
              { mode: 'walking' as TransportMode, label: '🚶 Walking' },
              { mode: 'cycling' as TransportMode, label: '🚲 Cycling' },
            ]).map(({ mode, label }) => (
              <label key={mode} className="mode-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedModes.includes(mode)}
                  onChange={() => toggleMode(mode)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Stops</h2>
          <DestinationList
            destinations={destinations}
            onAdd={addDestination}
            onRemove={removeDestination}
            onUpdate={updateDestination}
            onUpdateDwell={updateDestinationDwell}
            countryCode={selectedCountry}
            stopPlaceholder={(COUNTRY_EXAMPLES[selectedCountry] ?? COUNTRY_EXAMPLES['']).stop}
          />
        </section>

        {error && <div className="error-banner">{error}</div>}

        <div className="action-row">
          <button className="btn-calculate" onClick={calculate} disabled={calculating}>
            {calculating ? '⏳ Calculating...' : '🚗 Calculate Departure Times'}
          </button>
          {destinations.filter(d => d.address.trim() && d.arrivalTime).length >= 3 && (
            <button className="btn-optimize" onClick={handleOptimizeOrder} disabled={optimizing || calculating}>
              {optimizing ? '⏳ Optimizing...' : '🔀 Optimize Stop Order'}
            </button>
          )}
          {savingTrip ? (
            <div className="save-trip-inline">
              <input
                className="input"
                placeholder="Plan name (optional)"
                value={tripNameInput}
                onChange={e => setTripNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTrip(); if (e.key === 'Escape') setSavingTrip(false) }}
                autoFocus
              />
              <button className="btn-calculate" onClick={handleSaveTrip}>💾 Save</button>
              <button className="btn-reset" onClick={() => setSavingTrip(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn-save-trip" onClick={() => setSavingTrip(true)} disabled={calculating}>
              💾 Save Plan
            </button>
          )}
          <button className="btn-reset" onClick={reset} disabled={calculating}>
            ↺ Reset
          </button>
        </div>
        </div>{/* end form-body */}

        {results.length > 0 && (
          <section className="section">
            <h2 className="section-title">Your Schedule — {formatDisplayDate(planDate)}</h2>

            {resultsCalculatedAt !== null && (Date.now() - resultsCalculatedAt) > 2 * 60 * 60 * 1000 && (
              <div className="stale-banner">
                ⚠️ Results calculated over 2 hours ago.{' '}
                <button className="stale-banner-btn" onClick={calculate}>Recalculate</button>
              </div>
            )}

            <div className="delay-section">
              <div className="delay-row">
                <label className="label-inline" htmlFor="delay-slider">
                  🕐 Running late by: <strong>{delayMinutes === 0 ? 'On time' : `${delayMinutes} min`}</strong>
                </label>
                <input
                  id="delay-slider"
                  className="delay-slider"
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={delayMinutes}
                  onChange={e => setDelayMinutes(Number(e.target.value))}
                />
              </div>
            </div>

            <ResultsPanel results={results} use12Hour={use12Hour} delayMinutes={delayMinutes} />
            <div className="results-footer">
              <p className="results-disclaimer">
                ℹ️ Results are based on Google Maps historical traffic patterns for the selected date
                and time of day. Re-running closer to your travel date may return different results
                due to road closures, construction, or incidents not yet known today.
              </p>
              <div className="results-footer-actions">
                <button className="btn-export-ics" onClick={handleExportICS}>
                  📅 Export to Calendar
                </button>
                <button className="btn-share" onClick={handleShare}>
                  {shareLabel === 'copied' ? '✅ Link copied!' : '🔗 Share this plan'}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
