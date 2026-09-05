'use client'

import { useState } from 'react'
import { Check, FileSearch, RotateCcw, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FindingReviewDecision, FindingReviewState } from '@/lib/finding-review-types'
import { reviewDecisionLabel } from '@/lib/finding-review'

export interface FindingReviewPanelProps {
  findingRevisionId: string
  revision: number
  reviewState: FindingReviewState
  latestDecision?: FindingReviewDecision | null
  disabled?: boolean
  onReview: (input: {
    findingRevisionId: string
    expectedRevision: number
    decision: FindingReviewDecision
    note?: string
  }) => Promise<void> | void
}

const controls: Array<{ decision: FindingReviewDecision; label: string; icon: typeof Check }> = [
  { decision: 'accept', label: 'Accept current revision', icon: Check },
  { decision: 'retain_uncertainty', label: 'Retain uncertainty', icon: ShieldAlert },
  { decision: 'request_more_evidence', label: 'Investigate further', icon: FileSearch },
  { decision: 'withdraw', label: 'Withdraw acceptance', icon: RotateCcw },
]

export function FindingReviewPanel({
  findingRevisionId,
  revision,
  reviewState,
  latestDecision,
  disabled = false,
  onReview,
}: FindingReviewPanelProps) {
  const [pending, setPending] = useState<FindingReviewDecision | null>(null)

  async function review(decision: FindingReviewDecision) {
    setPending(decision)
    try {
      await onReview({ findingRevisionId, expectedRevision: revision, decision })
    } finally {
      setPending(null)
    }
  }

  const currentLabel = reviewState === 'reviewed'
    ? reviewDecisionLabel(latestDecision)
    : reviewDecisionLabel(null)

  return (
    <section aria-label="Finding review" className="rounded-xl border border-slate-200 bg-[#f7f6f3] p-4 text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Researcher review</p>
          <p className="mt-1 text-sm font-medium">Revision {revision}: {currentLabel}</p>
          <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">This records your choice about this revision. It does not certify truth, authorship, or completion of the investigation.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {controls.map(({ decision, label, icon: Icon }) => (
          <Button
            key={decision}
            type="button"
            size="sm"
            variant={decision === 'accept' ? 'default' : 'outline'}
            disabled={disabled || pending !== null}
            onClick={() => void review(decision)}
          >
            <Icon className="mr-2 h-4 w-4" />
            {pending === decision ? 'Saving…' : label}
          </Button>
        ))}
      </div>
    </section>
  )
}
