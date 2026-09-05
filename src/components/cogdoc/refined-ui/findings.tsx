'use client'

import { ArrowUpRight, CheckCircle2, CircleHelp, ClipboardCheck, FilePenLine, ShieldAlert } from 'lucide-react'
import styles from './refined-ui.module.css'
import type { FindingDetail, FindingReviewState, FindingSummary } from './types'

export interface FindingsStripProps {
  findings: FindingSummary[]
  selectedFindingId?: string
  onSelectFinding?: (findingId: string) => void
  onViewAll?: () => void
  viewAllLabel?: string
}

function reviewLabel(state: FindingReviewState) {
  return state === 'accepted' ? 'Accepted by researcher' : state === 'review_needed' ? 'Review needed' : state === 'uncertain' ? 'Uncertainty retained' : 'Draft finding'
}

export function FindingsStrip({ findings, selectedFindingId, onSelectFinding, onViewAll, viewAllLabel = 'View all findings' }: FindingsStripProps) {
  return (
    <section className={styles.findings} aria-labelledby="findings-strip-title">
      <h3 id="findings-strip-title" className={styles.findingsHeading}>Your findings</h3>
      <div className={styles.findingList}>
        {findings.length ? findings.map((finding) => (
          <button key={finding.id} type="button" className={styles.findingButton} aria-current={finding.id === selectedFindingId ? 'true' : undefined} disabled={!onSelectFinding} onClick={() => onSelectFinding?.(finding.id)}>
            <span className={styles.findingState} data-state={finding.reviewState} aria-hidden="true" />
            <span className={styles.findingCopy}><span className={styles.findingTitle}>{finding.title}</span><span className={styles.findingMeta}>{finding.updatedLabel ?? reviewLabel(finding.reviewState)}</span></span>
          </button>
        )) : <div className={styles.emptyState}><p>No findings yet. Save a tentative answer or an explicit evidence gap when you are ready.</p></div>}
      </div>
      {onViewAll ? <button type="button" className={styles.findingsAction} onClick={onViewAll}>{viewAllLabel}<ArrowUpRight size={16} aria-hidden="true" /></button> : null}
    </section>
  )
}

export interface FindingDetailCardProps {
  finding: FindingDetail
  onEdit?: () => void
  onAccept?: () => void
  onRequestReview?: () => void
  onStartArticle?: () => void
}

export function FindingDetailCard({ finding, onEdit, onAccept, onRequestReview, onStartArticle }: FindingDetailCardProps) {
  const ReviewIcon = finding.reviewState === 'accepted' ? CheckCircle2 : finding.reviewState === 'review_needed' ? ShieldAlert : finding.reviewState === 'uncertain' ? CircleHelp : ClipboardCheck
  return (
    <article className={`${styles.panel} ${styles.findingDetail}`} aria-labelledby={`finding-${finding.id}-title`}>
      <header className={styles.detailTop}>
        <div><p className={styles.detailEyebrow}>Addresses: {finding.questionLabel}</p><h3 id={`finding-${finding.id}-title`} className={styles.detailTitle}>{finding.title}</h3></div>
        <span className={styles.reviewState} data-state={finding.reviewState}><ReviewIcon size={15} aria-hidden="true" />{reviewLabel(finding.reviewState)}</span>
      </header>
      <div className={styles.detailConclusion}>{finding.conclusion}</div>
      <div className={styles.detailGrid}>
        {finding.rationale ? <section className={styles.detailSection}><h4>Researcher rationale</h4><p>{finding.rationale}</p></section> : null}
        {finding.evidence?.length ? <section className={styles.detailSection}><h4>Linked evidence</h4><ul className={styles.evidenceList}>{finding.evidence.map((item) => <li key={item.id}>{item.label}{item.locator ? <span className={styles.evidenceLocator}>{item.locator}</span> : null}</li>)}</ul></section> : null}
        {finding.limitations ? <section className={styles.detailSection}><h4>Limitations</h4><p>{finding.limitations}</p></section> : null}
        {finding.uncertainty ? <section className={styles.detailSection}><h4>Uncertainty</h4><p>{finding.uncertainty}</p></section> : null}
      </div>
      {finding.reviewNote ? <p className={styles.reviewNote}>{finding.reviewNote}</p> : null}
      <footer className={styles.detailActions}>
        {onEdit ? <button type="button" className={styles.secondaryAction} onClick={onEdit}><FilePenLine size={15} aria-hidden="true" /> Edit finding</button> : null}
        {onAccept && finding.reviewState !== 'accepted' ? <button type="button" className={styles.primaryAction} onClick={onAccept}>Accept this revision</button> : null}
        {onRequestReview ? <button type="button" className={styles.secondaryAction} onClick={onRequestReview}>Review evidence</button> : null}
        {onStartArticle && finding.reviewState === 'accepted' ? <button type="button" className={styles.secondaryAction} onClick={onStartArticle}>Use in an article</button> : null}
      </footer>
    </article>
  )
}
