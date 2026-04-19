import { Fragment, useState, useEffect } from 'react'
import { DestinationWithResult, TravelLeg, TransitLeg } from '../types'
import { apiFetch } from '../utils/apiFetch'

interface Props {
  results: DestinationWithResult[]
  use12Hour: boolean
  delayMinutes: number
}

function fmt(unixSeconds: number, use12Hour: boolean): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: use12Hour,
  })
}

function TrafficBadge({ delaySeconds }: { delaySeconds?: number }) {
  if (delaySeconds === undefined) return null
  const delayMin = Math.round(delaySeconds / 60)
  if (delaySeconds > 900) {
    return <div className="traffic-indicator traffic-heavy">🔴 Heavy traffic: +{delayMin} min</div>
  }
  if (delaySeconds > 300) {
    return <div className="traffic-indicator traffic-moderate">🟡 Moderate traffic: +{delayMin} min</div>
  }
  return <div className="traffic-indicator traffic-light">🟢 Light traffic</div>
}

function ResultImage({ address }: { address: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let blobUrl = ''
    apiFetch(`/api/place-image?address=${encodeURIComponent(address)}`)
      .then(res => {
        if (!res.ok) throw new Error('not ok')
        return res.blob()
      })
      .then(blob => {
        blobUrl = URL.createObjectURL(blob)
        setSrc(blobUrl)
      })
      .catch(() => setFailed(true))
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [address])

  if (failed || !src) return null
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  return (
    <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="result-card-image-link" title="Open in Google Maps">
      <img
        className="result-card-image"
        src={src}
        alt=""
        loading="lazy"
      />
      <span className="result-card-image-overlay">🗺️ Open in Maps</span>
    </a>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function mapsUrl(origin: string, destination: string, mode: 'driving' | 'transit' | 'walking' | 'bicycling'): string {
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: mode })
  return `https://www.google.com/maps/dir/?${params}`
}

function TimeAtStopBanner({ current, next }: { current: DestinationWithResult; next: DestinationWithResult }) {
  if (!current.arrivalTimestamp || current.loading || next.loading || !next.result) return null

  const modeConfig = [
    { key: 'driving',  icon: '🚗', label: 'Driving'  },
    { key: 'transit',  icon: '🚌', label: 'Transit'  },
    { key: 'walking',  icon: '🚶', label: 'Walking'  },
    { key: 'cycling',  icon: '🚲', label: 'Cycling'  },
  ] as const

  const entries = modeConfig
    .map(({ key, icon, label }) => {
      const depart = next.result?.[key]?.departureTime
      if (depart === undefined) return null
      const avail = Math.round((depart - current.arrivalTimestamp!) / 60)
      return { key, icon, label, avail }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  if (entries.length === 0) return null

  const required = current.dwellMinutes ?? 0
  const stopLabel = current.label.trim() || 'this stop'

  return (
    <div className="time-at-stop">
      <div className="time-at-stop-line" />
      <div className="time-at-stop-modes">
        {entries.map(({ key, icon, label, avail }) => {
          const isNegative = avail < 0
          const isTight = !isNegative && required > 0 && avail < required
          const isOk = !isNegative && required > 0 && avail >= required

          let statusClass = ''
          if (isNegative) statusClass = ' time-at-stop-negative'
          else if (isTight) statusClass = ' time-at-stop-tight'
          else if (isOk) statusClass = ' time-at-stop-ok'

          const statusIcon = isNegative ? '⚠️' : isTight ? '🟡' : isOk ? '✅' : '⏱'
          const timeStr = isNegative
            ? `${formatDuration(Math.abs(avail))} short`
            : `~${formatDuration(avail)}`

          return (
            <div key={key} className={`time-at-stop-pill${statusClass}`}>
              <span className="time-at-stop-mode-icon">{icon}</span>
              <span className="time-at-stop-mode-label">{label}</span>
              <span className="time-at-stop-time">{timeStr}</span>
              <span className="time-at-stop-status-icon">{statusIcon}</span>
            </div>
          )
        })}
        {required > 0 && (
          <span className="time-at-stop-target">target: {formatDuration(required)} at {stopLabel}</span>
        )}
      </div>
      <div className="time-at-stop-line" />
    </div>
  )
}

interface ModeCardProps {
  icon: string
  label: string
  leg: TravelLeg | TransitLeg
  parkingBufferMinutes: number
  originLabel: string
  originAddress: string
  destAddress: string
  mapsMode: 'driving' | 'transit' | 'walking' | 'bicycling'
  bordered: boolean
  use12Hour: boolean
  delayMinutes: number
}

function ModeCard({ icon, label, leg, parkingBufferMinutes, originLabel, originAddress, destAddress, mapsMode, bordered, use12Hour, delayMinutes }: ModeCardProps) {
  const isDriving = mapsMode === 'driving'
  const isTransit = mapsMode === 'transit'
  const transitLeg = isTransit ? (leg as TransitLeg) : null
  const delayedDeparture = leg.departureTime + delayMinutes * 60

  return (
    <div className={`result-mode${bordered ? ' bordered' : ''}`}>
      <div className="mode-icon">{icon}</div>
      <div className="mode-details">
        <div className="mode-label">{label}</div>
        <div className="mode-from">Leaving {originLabel}</div>
        <div className="departure-time">
          Leave at <strong>{fmt(leg.departureTime, use12Hour)}</strong>
        </div>
        <div className="travel-duration">
          {leg.durationText}{leg.distanceText ? ` · ${leg.distanceText}` : ''}
        </div>
        {isDriving && parkingBufferMinutes > 0 && (
          <div className="parking-note">+{parkingBufferMinutes} min to park</div>
        )}
        {isDriving && <TrafficBadge delaySeconds={(leg as TravelLeg).trafficDelaySeconds} />}
        {transitLeg && transitLeg.steps.length > 0 && (
          <div className="transit-steps">
            {transitLeg.steps.map((step, i) => (
              <span key={i} className="transit-step">
                {step.vehicle} {step.line}: {step.departure} → {step.arrival}
              </span>
            ))}
          </div>
        )}
        {delayMinutes > 0 && (
          <div className="mode-delay-callout">
            +{delayMinutes} min delay → leave <strong>{fmt(delayedDeparture, use12Hour)}</strong>, ~{delayMinutes} min late
          </div>
        )}
        <a className="map-link"
          href={mapsUrl(originAddress, destAddress, mapsMode)}
          target="_blank" rel="noopener noreferrer">
          🗺 Open in Maps
        </a>
      </div>
    </div>
  )
}

export default function ResultsPanel({ results, use12Hour, delayMinutes }: Props) {
  return (
    <div className="results-list">
      {results.map((dest, index) => {
        const r = dest.result
        const activeModes = [
          r?.driving  ? { key: 'driving',  icon: '🚗', label: 'Driving',  leg: r.driving,  mapsMode: 'driving'   as const } : null,
          r?.transit  ? { key: 'transit',  icon: '🚌', label: 'Transit',  leg: r.transit,  mapsMode: 'transit'   as const } : null,
          r?.walking  ? { key: 'walking',  icon: '🚶', label: 'Walking',  leg: r.walking,  mapsMode: 'walking'   as const } : null,
          r?.cycling  ? { key: 'cycling',  icon: '🚲', label: 'Cycling',  leg: r.cycling,  mapsMode: 'bicycling' as const } : null,
        ].filter(Boolean) as { key: string; icon: string; label: string; leg: TravelLeg; mapsMode: 'driving' | 'transit' | 'walking' | 'bicycling' }[]

        const displayAddress = r?.resolvedDestinationAddress || dest.address
        const originForMaps  = r?.resolvedOriginAddress      || dest.originAddress

        return (
          <Fragment key={dest.id}>
            <div className="result-card">
              {dest.impossibilityWarning && (
                <div className="impossible-warning">{dest.impossibilityWarning}</div>
              )}

              {!dest.loading && r && activeModes.length > 0 && (
                <ResultImage address={displayAddress} />
              )}

              <div className="result-card-header">
                <h3>{dest.label || `Stop ${index + 1}`}</h3>
                <span className="result-address">{displayAddress}</span>
                <div className="result-meta-row">
                  <span className="result-from">📍 from {dest.originLabel}</span>
                  <span className="result-arrive-by">arrive by <strong>{dest.arrivalTime}</strong></span>
                </div>
              </div>

              {dest.loading && <div className="result-loading">Fetching directions…</div>}

              {!dest.loading && r && (
                <>
                  {r.error && (
                    <div className={`result-error${r.error.includes('quota') || r.error.includes('OVER_QUERY_LIMIT') ? ' result-error-quota' : ''}`}>
                      {r.error.includes('quota') || r.error.includes('OVER_QUERY_LIMIT')
                        ? <><span>⚠️ Google Maps quota exceeded. </span><a href="https://console.cloud.google.com/google/maps-apis/quotas" target="_blank" rel="noopener noreferrer" className="quota-link">Check your quota →</a></>
                        : `⚠️ ${r.error}`}
                    </div>
                  )}

                  {activeModes.length > 0 && (
                    <div className={`result-modes${activeModes.length > 2 ? ' result-modes-grid' : ''}`}>
                      {activeModes.map((m, i) => (
                        <ModeCard
                          key={m.key}
                          icon={m.icon}
                          label={m.label}
                          leg={m.leg}
                          parkingBufferMinutes={dest.parkingBufferMinutes}
                          originLabel={dest.originLabel}
                          originAddress={originForMaps}
                          destAddress={displayAddress}
                          mapsMode={m.mapsMode}
                          bordered={i < activeModes.length - 1}
                          use12Hour={use12Hour}
                          delayMinutes={delayMinutes}
                        />
                      ))}
                    </div>
                  )}

                  {activeModes.length === 0 && !r.error && (
                    <div className="result-error">No route found for this stop.</div>
                  )}
                </>
              )}
            </div>

            {index < results.length - 1 && (
              <TimeAtStopBanner current={dest} next={results[index + 1]} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

