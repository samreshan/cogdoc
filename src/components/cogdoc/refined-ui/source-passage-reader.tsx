'use client'

import { Bookmark, ChevronLeft, ChevronRight, ExternalLink, Link2, Maximize2 } from 'lucide-react'
import styles from './refined-ui.module.css'
import type { ResearchPassage, ResearchSource } from './types'

export interface SourcePassageReaderProps {
  source?: ResearchSource
  passage?: ResearchPassage
  previousPassageDisabled?: boolean
  nextPassageDisabled?: boolean
  onPreviousPassage?: () => void
  onNextPassage?: () => void
  onBookmark?: () => void
  onExpand?: () => void
  onLinkEvidence?: (passageId: string) => void
  emptyMessage?: string
}

const availabilityLabel: Record<ResearchSource['availability'], string> = {
  full_text: 'Full text available', excerpt: 'Excerpt available', metadata: 'Metadata only',
}

export function SourcePassageReader({
  source,
  passage,
  previousPassageDisabled,
  nextPassageDisabled,
  onPreviousPassage,
  onNextPassage,
  onBookmark,
  onExpand,
  onLinkEvidence,
  emptyMessage = 'Choose a source passage to read alongside your explanation.',
}: SourcePassageReaderProps) {
  if (!source || !passage) {
    return <section className={styles.panel} aria-label="Source reader"><div className={styles.emptyState}><p>{emptyMessage}</p></div></section>
  }
  const precisionLabel = passage.locator.precision === 'exact' ? 'Exact locator' : passage.locator.precision === 'approximate' ? 'Approximate locator' : 'Locator unavailable'
  return (
    <section className={styles.panel} aria-labelledby={`source-${source.id}-heading`}>
      <header className={styles.panelHeader}>
        <div>
          <p className={styles.panelKicker}>{source.kind ?? 'Source'} · {availabilityLabel[source.availability]}</p>
          <h3 id={`source-${source.id}-heading`} className={styles.panelTitle}>{source.title}</h3>
          <p className={styles.panelMeta}>{[source.authors, source.year, source.availabilityDetail].filter(Boolean).join(' · ')}</p>
        </div>
        <div className={styles.passageControls}>
          {onBookmark ? <button type="button" className={styles.iconButton} onClick={onBookmark} aria-label="Save source"><Bookmark size={17} aria-hidden="true" /></button> : null}
          {onExpand ? <button type="button" className={styles.iconButton} onClick={onExpand} aria-label="Open source in a larger reader"><Maximize2 size={17} aria-hidden="true" /></button> : null}
        </div>
      </header>
      <article className={styles.passageBody}>{passage.heading ? <h4>{passage.heading}</h4> : null}{passage.content}</article>
      <footer className={styles.locator}>
        <span className={styles.locatorText}><Link2 size={14} aria-hidden="true" />{passage.locator.label ?? 'Source location'}{passage.locator.detail ? ` · ${passage.locator.detail}` : ''}<span className={styles.precision} data-precision={passage.locator.precision}>{precisionLabel}</span></span>
        <span className={styles.passageControls}>
          {onPreviousPassage ? <button type="button" className={styles.iconButton} onClick={onPreviousPassage} disabled={previousPassageDisabled} aria-label="Previous passage"><ChevronLeft size={17} aria-hidden="true" /></button> : null}
          {onNextPassage ? <button type="button" className={styles.iconButton} onClick={onNextPassage} disabled={nextPassageDisabled} aria-label="Next passage"><ChevronRight size={17} aria-hidden="true" /></button> : null}
          {onLinkEvidence ? <button type="button" className={styles.textAction} onClick={() => onLinkEvidence(passage.id)}><ExternalLink size={14} aria-hidden="true" />Link evidence</button> : null}
        </span>
      </footer>
    </section>
  )
}
