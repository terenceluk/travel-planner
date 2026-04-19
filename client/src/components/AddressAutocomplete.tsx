import { useState, useRef, useEffect, useCallback } from 'react'
import { apiFetch } from '../utils/apiFetch'

interface Prediction {
  description: string
  place_id: string
}

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  countryCode?: string
}

function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export default function AddressAutocomplete({ id, value, onChange, placeholder, className, countryCode }: Props) {
  const [apiError, setApiError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [activeIndex, setActiveIndex] = useState(-1)
  const sessionToken = useRef(generateSessionToken())
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync display when parent value changes (e.g. restored from localStorage)
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    try {
      const params = new URLSearchParams({ input: text, sessiontoken: sessionToken.current })
      if (countryCode) params.set('countryCode', countryCode)
      const res = await apiFetch(`/api/autocomplete?${params}`)
      if (!res.ok) return
      const data: { predictions: Prediction[]; status?: string } = await res.json()
      if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        setApiError(`Places API: ${data.status}`)
        setSuggestions([])
        setOpen(false)
        return
      }
      setApiError(null)
      setSuggestions(data.predictions)
      setOpen(data.predictions.length > 0)
      setActiveIndex(-1)
    } catch {
      // silently ignore network errors
    }
  }, [countryCode])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setInputValue(text)
    onChange(text)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => fetchSuggestions(text), 300)
  }

  const handleSelect = (description: string) => {
    setInputValue(description)
    onChange(description)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    // New session token after each selection (Google billing: 1 charge per completed session)
    sessionToken.current = generateSessionToken()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex].description)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="autocomplete-wrapper" ref={containerRef}>
      <input
        id={id}
        className={className}
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? `${id ?? 'autocomplete'}-list` : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${id ?? 'autocomplete'}-opt-${activeIndex}` : undefined}
      />
      {open && (
      <ul className="autocomplete-list" id={`${id ?? 'autocomplete'}-list`} role="listbox">
          {suggestions.map((s, idx) => (
            <li
              key={s.place_id}
              id={`${id ?? 'autocomplete'}-opt-${idx}`}
              className={`autocomplete-item${idx === activeIndex ? ' autocomplete-item--active' : ''}`}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={() => handleSelect(s.description)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              📍 {s.description}
            </li>
          ))}
        </ul>
      )}
      {apiError && (
        <div className="autocomplete-api-error" title={apiError}>
          ⚠️ Address suggestions unavailable ({apiError})
        </div>
      )}
    </div>
  )
}
