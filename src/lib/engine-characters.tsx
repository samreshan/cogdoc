/**
 * Engine character profiles — names, personalities, and pixelated pet SVGs.
 *
 * Each AI engine has a memorable character name (after a historical figure
 * known for that engine's specific approach to knowledge) and a pixelated
 * pet that represents it visually.
 *
 * Pet architecture (informed by research on Duolingo, GitHub Copilot,
 * Animal Crossing, and Clippy's failure modes):
 *   - 5-state machine: idle / alert / active / react / sleep
 *   - Idle: breathing + random blink (feels alive)
 *   - Distinct personality per pet (same event → different micro-animation)
 *   - Crisp pixel scaling via shape-rendering: crispEdges
 *   - Auto-dismissing (never Clippy-level intrusive)
 *   - Respects prefers-reduced-motion
 */

import type { EngineType } from './types'
import React, { useState, useEffect, useRef } from 'react'

export type PetState = 'idle' | 'alert' | 'active' | 'react' | 'sleep'

export interface EngineCharacter {
  id: EngineType
  name: string           // Character name (e.g. "Socrates")
  role: string           // Short role description
  personality: string    // One-line personality
  archetype: string      // Animal Crossing-style personality archetype
  color: string          // Hex color
  bgColor: string        // Light bg tint
  petName: string        // The pixelated pet's species
  petEmoji: string       // Fallback emoji
}

export const ENGINE_CHARACTERS: Record<EngineType, EngineCharacter> = {
  interceptor: {
    id: 'interceptor',
    name: 'Socrates',
    role: 'The Interceptor',
    personality: 'Executed for asking too many questions. Catches your vague language and forces specificity.',
    archetype: 'Perceptive & curious — tilts head, narrows eyes when something is vague',
    color: '#d97706',
    bgColor: '#fef3c7',
    petName: 'Owl',
    petEmoji: '🦉',
  },
  socratic: {
    id: 'socratic',
    name: 'Diogenes',
    role: 'The Gadfly',
    personality: 'Walked the streets with a lamp looking for an honest man. Provokes you when you pause.',
    archetype: 'Mischievous & provocative — grins, pokes, plays devil\'s advocate',
    color: '#e11d48',
    bgColor: '#ffe4e6',
    petName: 'Fox',
    petEmoji: '🦊',
  },
  citation: {
    id: 'citation',
    name: 'Galileo',
    role: 'The Examiner',
    personality: 'Persecuted for insisting on evidence over dogma. Verifies every claim against your sources.',
    archetype: 'Tenacious & investigative — ears perk, sniffs, points like a tracker dog',
    color: '#059669',
    bgColor: '#d1fae5',
    petName: 'Hound',
    petEmoji: '🐕',
  },
  scaffold: {
    id: 'scaffold',
    name: 'Aristotle',
    role: 'The Architect',
    personality: 'Organized all human knowledge into categories. Builds structure for your arguments.',
    archetype: 'Methodical & builder — chews thoughtfully, stacks, constructs',
    color: '#0284c7',
    bgColor: '#e0f2fe',
    petName: 'Beaver',
    petEmoji: '🦫',
  },
}

// ── Pixel art helpers ──────────────────────────────────────────────────────

/**
 * Render a pixel art grid as SVG <rect> elements.
 * Color codes: 0=transparent, 1=body, 2=eye-white, 3=beak/nose, 4=teeth, 5=tail, 6=eyelid (for blink)
 */
function PixelGrid({
  pixels,
  color,
  blink = false,
}: {
  pixels: number[][]
  color: string
  blink?: boolean
}) {
  const colors: Record<number, string> = {
    1: color,
    2: '#ffffff',
    3: '#f59e0b',
    4: '#ffffff',
    5: '#92400e',
    6: color, // eyelid — same as body, toggled via opacity
  }

  const rects: React.ReactElement[] = []
  pixels.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 0) return
      // If this is an eyelid pixel and we're blinking, show it; otherwise skip
      if (cell === 6 && !blink) return
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={colors[cell] ?? color}
        />
      )
    })
  })

  return (
    <svg
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: 'pixelated' }}
    >
      {rects}
    </svg>
  )
}

// ── Pet pixel grids (16x16) ────────────────────────────────────────────────
// Each pet has: body pixels (1), eye-whites (2), beak/nose (3), teeth (4), tail (5), eyelid (6)

const OWL_IDLE = [
  [0,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,2,2,2,1,1,2,2,2,1,1,1,0],
  [1,1,1,1,2,2,2,1,1,2,2,2,1,1,1,1],
  [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
]

// Owl with eyelids closed (blink) — eyelid pixels (6) cover the eyes
const OWL_BLINK = [
  [0,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,6,6,6,1,1,6,6,6,1,1,1,0],
  [1,1,1,1,6,6,6,1,1,6,6,6,1,1,1,1],
  [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
]

// Owl alert — head tilted (shift pixels right by 1 in upper rows)
const OWL_ALERT = [
  [0,0,0,0,1,1,1,1,0,0,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,2,2,2,1,1,2,2,2,1,1,0],
  [0,1,1,1,1,2,2,2,1,1,2,2,2,1,1,1],
  [0,1,1,1,1,1,1,3,3,3,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,3,3,3,1,1,1,1,1,1],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0],
]

const FOX_IDLE = [
  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0],
  [0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,2,2,1,1,1,1,2,2,1,1,0,0],
  [0,0,1,1,2,2,1,1,1,1,2,2,1,1,0,0],
  [0,0,1,1,1,1,3,3,3,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,3,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
]

const FOX_BLINK = [
  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0],
  [0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,6,6,1,1,1,1,6,6,1,1,0,0],
  [0,0,1,1,6,6,1,1,1,1,6,6,1,1,0,0],
  [0,0,1,1,1,1,3,3,3,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,3,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
]

// Fox alert — ears perk up (taller), eyes wider
const FOX_ALERT = [
  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
  [0,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,2,2,2,1,1,1,1,2,2,2,1,0,0],
  [0,0,1,2,2,2,1,1,1,1,2,2,2,1,0,0],
  [0,0,1,1,1,1,3,3,3,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,3,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
]

const HOUND_IDLE = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0],
  [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,2,1,1,1,1,1,1,1,1,2,2,1,1],
  [1,1,2,2,1,1,1,1,1,1,1,1,2,2,1,1],
  [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,4,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],
]

const HOUND_BLINK = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0],
  [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,6,6,1,1,1,1,1,1,1,1,6,6,1,1],
  [1,1,6,6,1,1,1,1,1,1,1,1,6,6,1,1],
  [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,4,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],
]

// Hound alert — ears perk forward, nose down (investigating)
const HOUND_ALERT = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
  [1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,2,2,1,1,1,1,1,2,2,2,1,1,1],
  [1,1,2,2,2,1,1,1,1,1,2,2,2,1,1,1],
  [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,4,4,4,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],
]

const BEAVER_IDLE = [
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],
  [0,0,0,1,1,2,2,1,1,2,2,1,1,0,0,0],
  [0,0,0,1,1,1,1,3,3,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,4,4,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
  [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
]

const BEAVER_BLINK = [
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,6,6,1,1,6,6,1,1,0,0,0],
  [0,0,0,1,1,6,6,1,1,6,6,1,1,0,0,0],
  [0,0,0,1,1,1,1,3,3,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,4,4,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
  [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
]

// Beaver alert — sits up straighter, teeth more prominent (building)
const BEAVER_ALERT = [
  [0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,2,2,2,1,1,2,2,2,1,0,0],
  [0,0,0,1,1,2,2,2,1,1,2,2,2,1,0,0],
  [0,0,0,1,1,1,1,3,3,3,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,4,4,4,1,1,1,1,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
  [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
]

// ── Pet component with state machine ───────────────────────────────────────

interface PetComponentProps {
  engine: EngineType
  size?: number
  state?: PetState
  animate?: boolean  // legacy prop — if true, uses bounce animation
}

/**
 * Get the pixel grid for a given engine + state.
 */
function getPetGrid(engine: EngineType, state: PetState, blink: boolean): number[][] {
  const isAlert = state === 'alert' || state === 'active'

  switch (engine) {
    case 'interceptor': // Owl
      if (blink) return OWL_BLINK
      return isAlert ? OWL_ALERT : OWL_IDLE
    case 'socratic': // Fox
      if (blink) return FOX_BLINK
      return isAlert ? FOX_ALERT : FOX_IDLE
    case 'citation': // Hound
      if (blink) return HOUND_BLINK
      return isAlert ? HOUND_ALERT : HOUND_IDLE
    case 'scaffold': // Beaver
      if (blink) return BEAVER_BLINK
      return isAlert ? BEAVER_ALERT : BEAVER_IDLE
  }
}

/**
 * Pet component with breathing, blinking, and state-based animation.
 *
 * State machine:
 *   idle   → breathing (subtle scale) + random blink every 3-6s
 *   alert  → perked-up pose (ears taller, eyes wider)
 *   active → alert pose + bounce (engine is working)
 *   react  → quick pulse (engine returned a result)
 *   sleep  → slow breathing, no blink (user idle >60s)
 */
export function EnginePet({
  engine,
  size = 32,
  state = 'idle',
  animate = false,
}: PetComponentProps) {
  const char = ENGINE_CHARACTERS[engine]
  const [blink, setBlink] = useState(false)

  // Random blink timer (every 3-6 seconds, only when not sleeping)
  useEffect(() => {
    if (state === 'sleep') return // no blinking when asleep

    let timeoutId: NodeJS.Timeout
    function scheduleBlink() {
      const delay = 3000 + Math.random() * 3000 // 3-6 seconds
      timeoutId = setTimeout(() => {
        setBlink(true)
        // Blink lasts 150ms
        setTimeout(() => {
          setBlink(false)
          scheduleBlink()
        }, 150)
      }, delay)
    }
    scheduleBlink()

    return () => clearTimeout(timeoutId)
  }, [state])

  // Determine the animation class based on state
  let animClass = ''
  if (state === 'idle' || state === 'sleep') {
    animClass = state === 'sleep' ? 'cogdoc-pet-sleep' : 'cogdoc-pet-breathe'
  } else if (state === 'active' || animate) {
    animClass = 'cogdoc-pet-bounce'
  } else if (state === 'react') {
    animClass = 'cogdoc-pet-pulse'
  }
  // alert state: no animation, just the perked-up pose

  const grid = getPetGrid(engine, state, blink)

  return (
    <div
      className={animClass}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        display: 'inline-block',
        transform: 'translateZ(0)', // hardware accel
        backfaceVisibility: 'hidden',
      }}
    >
      <PixelGrid pixels={grid} color={char.color} blink={blink} />
    </div>
  )
}

/**
 * Get just the character info (for non-visual contexts).
 */
export function getEngineCharacter(engine: EngineType): EngineCharacter {
  return ENGINE_CHARACTERS[engine]
}
