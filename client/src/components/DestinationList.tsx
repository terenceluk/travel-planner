import { useState } from 'react'
import { Destination } from '../types'
import AddressAutocomplete from './AddressAutocomplete'

interface Props {
  destinations: Destination[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: keyof Destination, value: string) => void
  onUpdateDwell: (id: string, minutes: number) => void
  countryCode?: string
  stopPlaceholder?: string
}

const PRESET_MINUTES = new Set([0, 5, 10, 15, 20, 30, 45, 60, 90, 120])

export default function DestinationList({ destinations, onAdd, onRemove, onUpdate, onUpdateDwell, countryCode, stopPlaceholder }: Props) {
  const [customIds, setCustomIds] = useState<Set<string>>(new Set())
  const [customVals, setCustomVals] = useState<Record<string, { h: number; m: number }>>({})

  const isCustom = (dest: Destination) =>
    customIds.has(dest.id) ||
    (dest.dwellMinutes != null && dest.dwellMinutes > 0 && !PRESET_MINUTES.has(dest.dwellMinutes))

  const getCustomVal = (dest: Destination): { h: number; m: number } => {
    if (customVals[dest.id]) return customVals[dest.id]
    const total = dest.dwellMinutes ?? 0
    return { h: Math.floor(total / 60), m: total % 60 }
  }

  const handleSelectChange = (dest: Destination, val: string) => {
    if (val === 'custom') {
      const total = dest.dwellMinutes ?? 0
      setCustomVals(prev => ({ ...prev, [dest.id]: { h: Math.floor(total / 60), m: total % 60 } }))
      setCustomIds(prev => new Set([...prev, dest.id]))
    } else {
      setCustomIds(prev => { const s = new Set(prev); s.delete(dest.id); return s })
      setCustomVals(prev => { const v = { ...prev }; delete v[dest.id]; return v })
      onUpdateDwell(dest.id, Number(val))
    }
  }

  const handleCustomChange = (dest: Destination, field: 'h' | 'm', raw: string) => {
    const num = Math.max(0, parseInt(raw) || 0)
    const clamped = field === 'm' ? Math.min(59, num) : num
    const cur = getCustomVal(dest)
    const next = { ...cur, [field]: clamped }
    setCustomVals(prev => ({ ...prev, [dest.id]: next }))
    onUpdateDwell(dest.id, next.h * 60 + next.m)
  }

  return (
    <div className="destination-list">
      {destinations.map((dest, index) => {
        const custom = isCustom(dest)
        const customVal = getCustomVal(dest)
        const selectVal = custom ? 'custom' : String(dest.dwellMinutes ?? 0)

        return (
          <div key={dest.id} className="destination-card">
            <div className="destination-card-header">
              <span className="stop-label">Stop {index + 1}</span>
              {destinations.length > 1 && (
                <button
                  className="btn-remove"
                  onClick={() => onRemove(dest.id)}
                  aria-label={`Remove stop ${index + 1}`}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="destination-fields">
              <input
                className="input"
                type="text"
                placeholder="Label (e.g. Breakfast)"
                value={dest.label}
                onChange={e => onUpdate(dest.id, 'label', e.target.value)}
              />
              <AddressAutocomplete
                className="input"
                placeholder={stopPlaceholder ?? 'Address (e.g. 555 University Ave, Toronto, ON)'}
                value={dest.address}
                onChange={v => onUpdate(dest.id, 'address', v)}
                countryCode={countryCode}
              />
              <div className="field-group">
                <label className="field-label">Need to arrive by</label>
                <input
                  className="input input-time"
                  type="time"
                  value={dest.arrivalTime}
                  onChange={e => onUpdate(dest.id, 'arrivalTime', e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">⏱ Time at this stop</label>
                <select
                  className="select-small"
                  value={selectVal}
                  onChange={e => handleSelectChange(dest, e.target.value)}
                >
                  <option value="0">Not set</option>
                  <option value="5">5 min</option>
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                  <option value="20">20 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                  <option value="custom">Custom…</option>
                </select>
                {custom && (
                  <div className="dwell-custom-row">
                    <input
                      className="input dwell-custom-input"
                      type="number"
                      min={0}
                      placeholder="0"
                      value={customVal.h}
                      onChange={e => handleCustomChange(dest, 'h', e.target.value)}
                    />
                    <span className="dwell-custom-unit">hr</span>
                    <input
                      className="input dwell-custom-input"
                      type="number"
                      min={0}
                      max={59}
                      placeholder="0"
                      value={customVal.m}
                      onChange={e => handleCustomChange(dest, 'm', e.target.value)}
                    />
                    <span className="dwell-custom-unit">min</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button className="btn-add" onClick={onAdd}>
        + Add Stop
      </button>
    </div>
  )
}

