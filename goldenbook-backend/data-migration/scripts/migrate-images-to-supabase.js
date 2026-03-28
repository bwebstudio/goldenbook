require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const ROOT = process.cwd()
const TRANSFORMED_DIR = path.join(ROOT, 'data-migration', 'transformed')
const REPORTS_DIR = path.join(ROOT, 'data-migration', 'reports')

const INPUT_FILES = [
  'media_assets.locations.json',
  'media_assets.establishments.json',
  // Si luego existen, puedes añadir:
  // 'media_assets.categories.json',
  // 'media_assets.routes.json',
]

const CONCURRENCY = Number(process.env.CONCURRENCY || 5)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env de la raíz.')
  process.exit(1)
}

fs.mkdirSync(REPORTS_DIR, { recursive: true })

const PROGRESS_PATH = path.join(REPORTS_DIR, 'migrate-images-progress.json')
const ERRORS_PATH = path.join(REPORTS_DIR, 'migrate-images-errors.json')
const LOG_PATH = path.join(REPORTS_DIR, 'migrate-images-log.json')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function loadAssets() {
  const all = []

  for (const file of INPUT_FILES) {
    const fullPath = path.join(TRANSFORMED_DIR, file)
    if (!fs.existsSync(fullPath)) continue

    const items = readJson(fullPath, [])
    for (const item of items) {
      if (!item || !item.bucket || !item.path || !item.original_url) continue
      all.push(item)
    }
  }

  // dedupe by bucket + path
  const seen = new Set()
  return all.filter((item) => {
    const key = `${item.bucket}:${item.path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeStoragePath(bucket, rawPath) {
  if (!rawPath) return rawPath
  const prefix = `${bucket}/`
  return rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadFile(url, attempts = 3) {
  let lastError = null

  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'application/octet-stream'

      return {
        buffer: Buffer.from(arrayBuffer),
        contentType,
      }
    } catch (error) {
      lastError = error
      if (i < attempts) await sleep(500 * i)
    }
  }

  throw lastError
}

async function uploadAsset(asset) {
  const bucket = asset.bucket
  const objectPath = normalizeStoragePath(bucket, asset.path)

  const { buffer, contentType } = await downloadFile(asset.original_url)

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, {
      contentType,
      upsert: false,
      cacheControl: '31536000',
    })

  if (error) {
    // already exists -> treat as success
    const message = String(error.message || '')
    if (
      message.toLowerCase().includes('already exists') ||
      message.toLowerCase().includes('duplicate')
    ) {
      return { alreadyExisted: true, bucket, objectPath }
    }

    throw error
  }

  return { uploaded: true, bucket, objectPath }
}

async function runWorker(queue, state) {
  while (queue.length > 0) {
    const asset = queue.shift()
    if (!asset) return

    const key = `${asset.bucket}:${asset.path}`

    if (state.completed[key]) {
      state.stats.skipped += 1
      continue
    }

    try {
      const result = await uploadAsset(asset)
      state.completed[key] = {
        bucket: asset.bucket,
        path: asset.path,
        normalizedPath: normalizeStoragePath(asset.bucket, asset.path),
        original_url: asset.original_url,
        uploadedAt: new Date().toISOString(),
        status: result.alreadyExisted ? 'already_exists' : 'uploaded',
      }

      state.stats.done += 1
      if (result.alreadyExisted) state.stats.alreadyExisted += 1
      else state.stats.uploaded += 1

      if (state.stats.done % 25 === 0) {
        persistState(state)
        console.log(`✅ ${state.stats.done}/${state.stats.total} procesadas`)
      }
    } catch (error) {
      state.errors.push({
        bucket: asset.bucket,
        path: asset.path,
        normalizedPath: normalizeStoragePath(asset.bucket, asset.path),
        original_url: asset.original_url,
        message: error.message || String(error),
        at: new Date().toISOString(),
      })
      state.stats.failed += 1
      persistState(state)
      console.error(`❌ Error: ${asset.bucket}/${asset.path} -> ${error.message || error}`)
    }
  }
}

function persistState(state) {
  writeJson(PROGRESS_PATH, state.completed)
  writeJson(ERRORS_PATH, state.errors)
  writeJson(LOG_PATH, {
    updatedAt: new Date().toISOString(),
    stats: state.stats,
  })
}

async function main() {
  const assets = loadAssets()
  const completed = readJson(PROGRESS_PATH, {})
  const errors = readJson(ERRORS_PATH, [])

  const state = {
    completed,
    errors,
    stats: {
      total: assets.length,
      done: 0,
      uploaded: 0,
      alreadyExisted: 0,
      skipped: 0,
      failed: 0,
    },
  }

  const pending = assets.filter((asset) => !completed[`${asset.bucket}:${asset.path}`])

  state.stats.total = assets.length

  console.log(`📦 Assets totales: ${assets.length}`)
  console.log(`⏭️  Ya completados: ${assets.length - pending.length}`)
  console.log(`🚀 Pendientes: ${pending.length}`)
  console.log(`⚙️  Concurrencia: ${CONCURRENCY}`)

  const workers = Array.from({ length: CONCURRENCY }, () => runWorker(pending, state))
  await Promise.all(workers)

  persistState(state)

  console.log('\n--- Resultado final ---')
  console.log(`✅ Subidos: ${state.stats.uploaded}`)
  console.log(`↩️  Ya existían: ${state.stats.alreadyExisted}`)
  console.log(`❌ Fallidos: ${state.stats.failed}`)
  console.log(`📁 Progress: ${PROGRESS_PATH}`)
  console.log(`📁 Errors:   ${ERRORS_PATH}`)
}

main().catch((error) => {
  console.error('Error fatal:', error)
  process.exit(1)
})