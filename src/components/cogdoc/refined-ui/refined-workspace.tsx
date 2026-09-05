'use client'

import { ArrowLeft, ChevronDown, FileText, FolderOpen, LayoutList, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './refined-ui.module.css'
import type { RefinedNavigationItem, SaveState } from './types'

export interface RefinedWorkspaceShellProps {
  workspaceTitle: string
  projectLabel?: string
  navigation: RefinedNavigationItem[]
  activeNavigationId: string
  onNavigationChange?: (id: string) => void
  onBack?: () => void
  onProjectMenu?: () => void
  onProfile?: () => void
  profileLabel?: string
  profileInitials?: string
  topActions?: ReactNode
  children: ReactNode
}

export function RefinedWorkspaceShell({
  workspaceTitle,
  projectLabel = 'Research workspace',
  navigation,
  activeNavigationId,
  onNavigationChange,
  onBack,
  onProjectMenu,
  onProfile,
  profileLabel = 'Account',
  profileInitials = 'R',
  topActions,
  children,
}: RefinedWorkspaceShellProps) {
  return (
    <section className={styles.workspace} aria-label={`${workspaceTitle} research workspace`}>
      <div className={styles.shellGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true" />Cogdoc</div>
          <p className={styles.sidebarLabel}>Project</p>
          <button type="button" className={styles.projectButton} onClick={onProjectMenu} disabled={!onProjectMenu} aria-label={`Open ${projectLabel} project menu`}>
            <FolderOpen size={17} aria-hidden="true" />
            <span>{projectLabel}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <nav className={styles.nav} aria-label="Research workspace sections">
            {navigation.map(({ id, label, icon: Icon = LayoutList, count, disabled }) => (
              <button
                key={id}
                type="button"
                className={`${styles.navItem} ${id === activeNavigationId ? styles.navItemActive : ''}`}
                aria-current={id === activeNavigationId ? 'page' : undefined}
                disabled={disabled || !onNavigationChange}
                onClick={() => onNavigationChange?.(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {typeof count === 'number' ? <span className={styles.navCount}>{count}</span> : null}
              </button>
            ))}
          </nav>
          <div className={styles.sidebarFooter}>
            <button type="button" className={styles.profile} onClick={onProfile} disabled={!onProfile}>
              <span className={styles.avatar} aria-hidden="true">{profileInitials}</span>
              <span>{profileLabel}</span>
            </button>
            <button type="button" className={styles.profile} onClick={onProjectMenu} disabled={!onProjectMenu}>
              <Settings size={17} aria-hidden="true" /><span>Workspace settings</span>
            </button>
          </div>
        </aside>
        <div className={styles.main}>
          <header className={styles.topbar}>
            <button type="button" className={styles.backButton} onClick={onBack} disabled={!onBack} aria-label="Back to workspaces">
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <h1 className={styles.workspaceTitle}>{workspaceTitle}</h1>
            {topActions ? <div className={styles.topActions}>{topActions}</div> : null}
          </header>
          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </section>
  )
}

export interface ResearchPageHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  saveState?: SaveState
  saveStateLabel?: string
  children?: ReactNode
}

export function ResearchPageHeading({
  eyebrow,
  title,
  description,
  saveState = 'idle',
  saveStateLabel,
  children,
}: ResearchPageHeadingProps) {
  const defaultLabel: Record<SaveState, string> = {
    saved: 'Saved', saving: 'Saving changes', error: 'Could not save', idle: 'Not yet saved',
  }
  return (
    <div className={styles.pageHeading}>
      <div>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.heading}>{title}</h2>
        {description ? <p className={styles.subheading}>{description}</p> : null}
      </div>
      {children ?? <span className={styles.saveState} data-state={saveState} role={saveState === 'error' ? 'alert' : 'status'}><span className={styles.saveDot} aria-hidden="true" />{saveStateLabel ?? defaultLabel[saveState]}</span>}
    </div>
  )
}

export { FileText }
