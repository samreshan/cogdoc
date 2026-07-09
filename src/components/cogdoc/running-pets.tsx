'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useRef } from 'react'
import { useCogdoc } from '@/lib/store'
import { EnginePet, ENGINE_CHARACTERS } from '@/lib/engine-characters'
import type { EngineType, PetState } from '@/lib/types'

/**
 * RunningPets — renders pixelated pets that run across the bottom of the
 * editor when their engine fires. Each pet animates from left to right,
 * pauses mid-screen to "inspect" the document, then exits.
 *
 * Pet architecture (research-informed):
 *   - Appears ONLY when an engine fires (signal-driven, not timer-based)
 *   - Auto-dismisses after 2.5s (never Clippy-intrusive)
 *   - State machine: idle → alert → active → react → exit
 *   - Staggered entrances when multiple engines fire
 *   - Respects prefers-reduced-motion (static fall-back in CSS)
 */
interface ActivePet {
  id: string
  engine: EngineType
  state: PetState
  startedAt: number
}

const PET_LIFETIME_MS = 2500

export default function RunningPets() {
  const engineLoading = useCogdoc((s) => s.engineLoading)
  const [activePets, setActivePets] = useState<ActivePet[]>([])

  // Track which engines were loading in the previous render
  const prevLoadingRef = useRef<Record<EngineType, boolean>>({
    socratic: false, interceptor: false, citation: false, scaffold: false,
  })

  useEffect(() => {
    const now = Date.now()
    const newPets: ActivePet[] = []
    ;(Object.keys(engineLoading) as EngineType[]).forEach((engine) => {
      const wasLoading = prevLoadingRef.current[engine]
      const isLoading = engineLoading[engine]
      // Spawn a pet only on the transition from not-loading → loading
      if (isLoading && !wasLoading) {
        newPets.push({ id: `${engine}-${now}`, engine, state: 'active', startedAt: now })
      }
      prevLoadingRef.current[engine] = isLoading
    })
    if (newPets.length > 0) {
      setActivePets((prev) => [...prev, ...newPets].slice(-6)) // cap at 6 concurrent pets
    }
  }, [engineLoading])

  // Transition pet states: active → react → exit
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setActivePets((prev) => {
        const updated = prev.map((p) => {
          const age = now - p.startedAt
          if (age > PET_LIFETIME_MS - 300 && p.state !== 'react') {
            return { ...p, state: 'react' as PetState }
          }
          return p
        })
        // Remove expired pets
        return updated.filter((p) => now - p.startedAt < PET_LIFETIME_MS)
      })
    }, 200)
    return () => clearInterval(interval)
  }, [])

  if (activePets.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 pointer-events-none" style={{ zIndex: 5 }}>
      {activePets.map((pet, idx) => {
        const char = ENGINE_CHARACTERS[pet.engine]
        return (
          <div
            key={pet.id}
            className="cogdoc-pet-running absolute bottom-16"
            style={{
              left: 0,
              animationDuration: '2s',
              animationTimingFunction: 'ease-in-out',
              animationFillMode: 'forwards',
              animationDelay: `${idx * 150}ms`, // stagger entrances
            }}
          >
            {/* Pet + name tag */}
            <div className="flex flex-col items-center">
              <div
                className="rounded-full p-1.5 backdrop-blur-sm border-2"
                style={{
                  backgroundColor: char.bgColor,
                  borderColor: char.color,
                }}
              >
                <EnginePet engine={pet.engine} size={36} state={pet.state} />
              </div>
              <div
                className="mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                style={{ backgroundColor: char.color, color: 'white' }}
              >
                {char.name}
              </div>
              {/* Personality hint — shows what this pet is doing */}
              <div
                className="mt-0.5 px-1.5 py-0.5 rounded text-[8px] whitespace-nowrap opacity-80"
                style={{ backgroundColor: char.bgColor, color: char.color }}
              >
                {pet.state === 'active' && 'inspecting...'}
                {pet.state === 'react' && 'done!'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * IdlePetBadge — small pixelated pet shown in the toolbar when its engine
 * is analyzing. Uses the 'active' state (bouncy) to show it's working.
 * Includes the personality archetype as a tooltip.
 */
export function IdlePetBadge({ engine }: { engine: EngineType }) {
  const char = ENGINE_CHARACTERS[engine]
  return (
    <div
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: char.bgColor }}
      title={`${char.name} — ${char.role}\n${char.archetype}`}
    >
      <EnginePet engine={engine} size={16} state="active" />
      <span className="text-[10px] font-medium" style={{ color: char.color }}>
        {char.name}
      </span>
    </div>
  )
}
