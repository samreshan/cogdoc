'use client'

import { Plus } from 'lucide-react'
import styles from './refined-ui.module.css'
import type { ResearchQuestionItem } from './types'

export interface QuestionPlanProps {
  topic: string
  purpose?: string
  questions: ResearchQuestionItem[]
  selectedQuestionId?: string
  onSelectQuestion?: (questionId: string) => void
  onAddQuestion?: () => void
  addQuestionLabel?: string
  emptyMessage?: string
}

export function QuestionPlan({
  topic,
  purpose,
  questions,
  selectedQuestionId,
  onSelectQuestion,
  onAddQuestion,
  addQuestionLabel = 'Add question',
  emptyMessage = 'Start with one question you want to investigate. You can branch it later.',
}: QuestionPlanProps) {
  return (
    <section className={styles.questionPlan} aria-labelledby="research-plan-heading">
      <div className={`${styles.panel} ${styles.planGoal}`}>
        <p className={styles.planGoalLabel}>Research topic</p>
        <h2 id="research-plan-heading" className={styles.planTopic}>{topic}</h2>
        {purpose ? <p className={styles.planPurpose}>{purpose}</p> : null}
      </div>
      <div className={styles.panel}>
        <div className={styles.questionsHeader}>
          <h3 className={styles.questionsHeading}>Questions to explore</h3>
          {onAddQuestion ? <button type="button" className={styles.textAction} onClick={onAddQuestion}><Plus size={15} aria-hidden="true" />{addQuestionLabel}</button> : null}
        </div>
        {questions.length ? (
          <ol className={styles.questionList}>
            {questions.map((question, index) => {
              const active = question.id === selectedQuestionId
              return (
                <li key={question.id} className={styles.questionItem} style={{ '--depth': question.branchDepth ?? 0 } as React.CSSProperties}>
                  <button type="button" className={styles.questionButton} aria-current={active ? 'true' : undefined} disabled={!onSelectQuestion} onClick={() => onSelectQuestion?.(question.id)}>
                    <span className={styles.questionIndex} aria-hidden="true">{index + 1}</span>
                    <span className={styles.questionCopy}>
                      <span className={styles.questionTitle}>{question.title}</span>
                      {question.purpose ? <span className={styles.questionPurpose}>{question.purpose}</span> : null}
                    </span>
                    {question.state ? <span className={styles.questionState}>{question.state}</span> : null}
                  </button>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className={styles.emptyState}><p>{emptyMessage}</p>{onAddQuestion ? <button type="button" className={styles.primaryAction} onClick={onAddQuestion}>{addQuestionLabel}</button> : null}</div>
        )}
      </div>
    </section>
  )
}
