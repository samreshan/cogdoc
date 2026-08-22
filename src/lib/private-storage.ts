import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const BUCKET = process.env.COGDOC_STORAGE_BUCKET ?? 'cogdoc-private'

function safeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120)
  return base || 'asset.bin'
}

function supabaseStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage
}

export async function putPrivateAsset(projectId: string, filename: string, data: Buffer, mimeType: string): Promise<{
  provider: 'supabase' | 'filesystem'
  key: string
}> {
  const key = `${projectId}/${randomUUID()}-${safeFilename(filename)}`
  const remote = supabaseStorage()
  if (remote) {
    const { error } = await remote.from(BUCKET).upload(key, data, { contentType: mimeType, upsert: false })
    if (error) throw new Error(`Private storage upload failed: ${error.message}`)
    return { provider: 'supabase', key }
  }
  const root = process.env.COGDOC_STORAGE_DIR ?? path.join(process.cwd(), '.data', 'assets')
  const full = path.join(root, key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, data, { flag: 'wx' })
  return { provider: 'filesystem', key }
}

export async function readPrivateAsset(provider: string, key: string): Promise<Buffer> {
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._/-]+$/.test(key) || key.includes('..')) {
    throw new Error('Invalid storage key')
  }
  if (provider === 'supabase') {
    const remote = supabaseStorage()
    if (!remote) throw new Error('Private storage is not configured')
    const { data, error } = await remote.from(BUCKET).download(key)
    if (error) throw new Error(`Private storage download failed: ${error.message}`)
    return Buffer.from(await data.arrayBuffer())
  }
  const root = process.env.COGDOC_STORAGE_DIR ?? path.join(process.cwd(), '.data', 'assets')
  return readFile(path.join(root, key))
}

