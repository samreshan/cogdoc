import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())
const python = process.env.RAG_PYTHON || resolve('.venv-rag/bin/python')
if (!existsSync(python)) {
  console.error('Run npm run rag:setup once before starting the retrieval service.')
  process.exit(1)
}
// psycopg does not accept Prisma-specific URL parameters.
const retrievalDatabase = new URL(process.env.DATABASE_URL)
for (const key of ['pgbouncer', 'connection_limit', 'pool_timeout', 'schema', 'statement_cache_size']) retrievalDatabase.searchParams.delete(key)
const child = spawn(python, ['-m', 'uvicorn', 'app.main:create_app_from_env', '--factory', '--host', '127.0.0.1', '--port', process.env.RAG_PORT || '8001'], {
  cwd: resolve('fastapi'), stdio: 'inherit',
  env: { ...process.env, EMBEDDING_PROVIDER: 'gemini', GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '', SUPABASE_DB_URL: retrievalDatabase.toString() },
})
child.on('error', () => { console.error('Could not start Python retrieval service. Check rag:setup.'); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
