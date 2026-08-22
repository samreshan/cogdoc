export interface RecoveryDraft {
  content: string
  revision: number
  updatedAt: number
}

const DB_NAME = 'cogdoc-recovery'
const STORE = 'drafts'

function localKey(projectId: string) { return `cogdoc:draft:${projectId}` }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveRecoveryDraft(projectId: string, draft: RecoveryDraft): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(draft, projectId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  } catch {
    localStorage.setItem(localKey(projectId), JSON.stringify(draft))
  }
}

export async function loadRecoveryDraft(projectId: string): Promise<RecoveryDraft | null> {
  try {
    const db = await openDb()
    const result = await new Promise<RecoveryDraft | null>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(projectId)
      request.onsuccess = () => resolve((request.result as RecoveryDraft | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return result
  } catch {
    const value = localStorage.getItem(localKey(projectId))
    return value ? JSON.parse(value) as RecoveryDraft : null
  }
}

export async function clearRecoveryDraft(projectId: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).delete(projectId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  } catch {
    localStorage.removeItem(localKey(projectId))
  }
}

