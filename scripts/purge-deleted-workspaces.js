/* Purges workspaces after the 30-day recovery window, retaining revocation-only tombstones. */
const { unlink } = require('node:fs/promises')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()
const bucket = process.env.COGDOC_STORAGE_BUCKET || 'cogdoc-private'
const storageRoot = process.env.COGDOC_STORAGE_DIR || path.join(process.cwd(), '.data', 'assets')
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY).storage
  : null

function safeKey(key) {
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._/-]+$/.test(key) && !key.includes('..')
}

async function removeStored(provider, key) {
  if (!key || !safeKey(key)) return
  if (provider === 'supabase') {
    if (!supabase) throw new Error('Supabase storage credentials are required to purge remote assets')
    const { error } = await supabase.from(bucket).remove([key])
    if (error) throw error
  } else {
    await unlink(path.join(storageRoot, key)).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}

async function main() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const projects = await db.project.findMany({
    where: { deletedAt: { lte: cutoff } },
    include: { assets: true, certificates: { include: { shares: true } } },
  })
  for (const project of projects) {
    for (const certificate of project.certificates) {
      await db.certificateRevocationTombstone.upsert({
        where: { certificateId: certificate.id },
        update: { revokedAt: certificate.revokedAt || project.deletedAt || new Date(), shareTokenHashesJson: JSON.stringify(certificate.shares.map((share) => share.tokenHash)) },
        create: {
          certificateId: certificate.id, payloadHash: certificate.payloadHash, publicKeyId: certificate.publicKeyId,
          revokedAt: certificate.revokedAt || project.deletedAt || new Date(),
          shareTokenHashesJson: JSON.stringify(certificate.shares.map((share) => share.tokenHash)),
        },
      })
      await removeStored(certificate.pdfStorageProvider, certificate.pdfStorageKey)
      await removeStored(certificate.docxStorageProvider, certificate.docxStorageKey)
    }
    for (const asset of project.assets) await removeStored(asset.storageProvider, asset.storageKey)
    await db.project.delete({ where: { id: project.id } })
  }
  console.log(`Purged ${projects.length} workspace(s) past the 30-day retention window.`)
}

main().finally(() => db.$disconnect())
