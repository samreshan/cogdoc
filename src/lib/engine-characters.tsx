/**
 * Engine character profiles — names, personalities, and pixelated pet SVGs.
 *
 * Each AI engine has a memorable character name (after a historical figure
 * known for that engine's specific approach to knowledge) and a pixelated
 * pet that represents it visually.
 */

import type { EngineType } from './types'

export interface EngineCharacter {
  id: EngineType
  name: string           // Character name (e.g. "Socrates")
  role: string           // Short role description
  personality: string    // One-line personality
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
    color: '#0284c7',
    bgColor: '#e0f2fe',
    petName: 'Beaver',
    petEmoji: '🦫',
  },
}

/**
 * Pixelated pet SVGs — hand-crafted pixel art using small <rect> elements.
 * Each pet is 16x16 pixels, rendered at any size via SVG viewBox.
 * Uses shape-rendering="crispEdges" for the pixel aesthetic.
 */

function PixelOwl({ color }: { color: string }) {
  // 16x16 pixel owl — two big eyes, sharp beak
  const pixels = [
    // Row 0 (top)
    [0,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
    // Row 1
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    // Row 2 — eye row
    [0,1,1,1,2,2,2,1,1,2,2,2,1,1,1,0],
    // Row 3 — eye row
    [1,1,1,1,2,2,2,1,1,2,2,2,1,1,1,1],
    // Row 4 — beak
    [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
    // Row 5
    [1,1,1,1,1,1,3,3,3,1,1,1,1,1,1,1],
    // Row 6
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    // Row 7
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    // Row 8 — body
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    // Row 9
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    // Row 10 — feet
    [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
    // Row 11
    [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  ]
  return <PixelArt pixels={pixels} color={color} />
}

function PixelFox({ color }: { color: string }) {
  // 16x16 pixel fox — pointy ears, sly face
  const pixels = [
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
  return <PixelArt pixels={pixels} color={color} />
}

function PixelHound({ color }: { color: string }) {
  // 16x16 pixel bloodhound — droopy ears, nose down
  const pixels = [
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
  return <PixelArt pixels={pixels} color={color} />
}

function PixelBeaver({ color }: { color: string }) {
  // 16x16 pixel beaver — flat tail, big teeth
  const pixels = [
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
    // Tail (flat, paddle-like)
    [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
    [0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,0],
  ]
  return <PixelArt pixels={pixels} color={color} />
}

/**
 * Generic pixel art renderer — takes a 2D grid of color codes and renders
 * each non-zero cell as a <rect>. Color codes: 1=primary, 2=eye, 3=beak/nose, 4=teeth, 5=tail
 */
function PixelArt({ pixels, color }: { pixels: number[][]; color: string }) {
  const cellSize = 1 // 1 unit per pixel (viewBox is 16x16)
  const rects: React.ReactElement[] = []

  const colors: Record<number, string> = {
    1: color,
    2: '#ffffff',     // eyes
    3: '#f59e0b',     // beak/nose (amber)
    4: '#ffffff',     // teeth
    5: '#92400e',     // tail (dark brown)
  }

  pixels.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell !== 0 && colors[cell]) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * cellSize}
            y={y * cellSize}
            width={cellSize}
            height={cellSize}
            fill={colors[cell]}
          />
        )
      }
    })
  })

  return (
    <svg
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      {rects}
    </svg>
  )
}

/**
 * Get the pixelated pet SVG for a given engine.
 */
export function EnginePet({
  engine,
  size = 32,
  animate = false,
}: {
  engine: EngineType
  size?: number
  animate?: boolean
}) {
  const char = ENGINE_CHARACTERS[engine]
  const style: React.CSSProperties = {
    width: size,
    height: size,
    imageRendering: 'pixelated',
    display: 'inline-block',
  }

  if (animate) {
    style.animation = 'cogdoc-pet-bounce 0.6s ease-in-out infinite alternate'
  }

  return (
    <div style={style}>
      {engine === 'interceptor' && <PixelOwl color={char.color} />}
      {engine === 'socratic' && <PixelFox color={char.color} />}
      {engine === 'citation' && <PixelHound color={char.color} />}
      {engine === 'scaffold' && <PixelBeaver color={char.color} />}
    </div>
  )
}

/**
 * Get just the character info (for non-visual contexts).
 */
export function getEngineCharacter(engine: EngineType): EngineCharacter {
  return ENGINE_CHARACTERS[engine]
}
