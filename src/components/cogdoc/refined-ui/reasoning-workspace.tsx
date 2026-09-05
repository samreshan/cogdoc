'use client'

import { Lightbulb, Search, Clock3, Sparkles } from 'lucide-react'
import styles from './refined-ui.module.css'
import type { ContextualPrompt, SaveState } from './types'

export interface ReasoningWorkspaceProps {
  explanation: string
  onExplanationChange: (value: string) => void
  onSaveFinding?: () => void
  saveFindingLabel?: string
  saveState?: SaveState
  errorMessage?: string
  contextualPrompt?: ContextualPrompt
  onHint?: () => void
  onFindEvidence?: () => void
  onLater?: () => void
  composerValue?: string
  onComposerChange?: (value: string) => void
  composerPlaceholder?: string
  composerLabel?: string
}

export function ReasoningWorkspace({
  explanation,
  onExplanationChange,
  onSaveFinding,
  saveFindingLabel = 'Save draft finding',
  saveState = 'idle',
  errorMessage,
  contextualPrompt,
  onHint,
  onFindEvidence,
  onLater,
  composerValue,
  onComposerChange,
  composerPlaceholder = 'Work through your reasoning…',
  composerLabel = 'Add to your reasoning',
}: ReasoningWorkspaceProps) {
  const explanationId = 'researcher-explanation'
  return (
    <section className={`${styles.panel} ${styles.reasoningPanel}`} aria-labelledby={explanationId}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelKicker}>Your interpretation</p>
          <h3 id={explanationId} className={styles.panelTitle}>Your explanation</h3>
        </div>
        <span className={styles.saveState} data-state={saveState} role={saveState === 'error' ? 'alert' : 'status'}><span className={styles.saveDot} aria-hidden="true" />{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Save failed' : 'Draft'}</span>
      </div>
      <div className={styles.explanationWrap}>
        <label className={styles.explanationLabel} htmlFor={`${explanationId}-field`}>Write what this evidence means to you</label>
        <textarea id={`${explanationId}-field`} className={styles.explanation} value={explanation} onChange={(event) => onExplanationChange(event.target.value)} placeholder="State a tentative answer, a conflict, or what the source cannot establish." />
      </div>
      {contextualPrompt ? (
        <aside className={styles.promptCard} aria-label="Contextual research question">
          <p className={styles.promptHeading}><Sparkles size={18} aria-hidden="true" />A question to explore</p>
          <h4 className={styles.promptTitle}>{contextualPrompt.title}</h4>
          <p className={styles.promptBody}>{contextualPrompt.body}</p>
          {contextualPrompt.sourceLabel ? <span className={styles.promptSource}>Based on {contextualPrompt.sourceLabel}</span> : null}
          <div className={styles.promptActions}>
            {onHint ? <button type="button" className={styles.textAction} onClick={onHint}><Lightbulb size={15} aria-hidden="true" />Give a hint</button> : null}
            {onFindEvidence ? <button type="button" className={styles.textAction} onClick={onFindEvidence}><Search size={15} aria-hidden="true" />Find evidence</button> : null}
            {onLater ? <button type="button" className={styles.textAction} onClick={onLater}><Clock3 size={15} aria-hidden="true" />Later</button> : null}
          </div>
        </aside>
      ) : null}
      {errorMessage ? <p className={styles.errorMessage} role="alert">{errorMessage}</p> : null}
      <div className={styles.composer}>
        <input aria-label={composerLabel} className={styles.composerInput} value={composerValue ?? ''} readOnly={!onComposerChange} onChange={(event) => onComposerChange?.(event.target.value)} placeholder={composerPlaceholder} />
        {onSaveFinding ? <button type="button" className={styles.primaryAction} onClick={onSaveFinding} disabled={saveState === 'saving'}>{saveFindingLabel}</button> : null}
      </div>
    </section>
  )
}
