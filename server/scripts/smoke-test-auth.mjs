#!/usr/bin/env node
/**
 * Smoke test for auth.ts — verifies new safety logic without needing a database.
 *
 * Run from server/:
 *   npm run build
 *   node scripts/smoke-test-auth.mjs
 */

import {
  assertProductionAuthConfigured,
  extractEditorName,
} from '../dist/auth.js'

const results = []
function check(name, fn) {
  try {
    fn()
    results.push({ name, status: 'PASS' })
  } catch (error) {
    results.push({ name, status: 'FAIL', detail: error.message })
  }
}

function expectThrow(fn, includes) {
  try {
    fn()
  } catch (error) {
    if (!error.message.includes(includes)) {
      throw new Error(`expected error to include "${includes}", got "${error.message}"`)
    }
    return
  }
  throw new Error('expected function to throw, but it returned normally')
}

function expectNoThrow(fn) {
  try {
    fn()
  } catch (error) {
    throw new Error(`expected no throw, got: ${error.message}`)
  }
}

function withEnv(env, fn) {
  const saved = {}
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key]
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
  try {
    fn()
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

// ---- assertProductionAuthConfigured ----

check('dev: empty token passes', () => {
  withEnv({ NODE_ENV: 'development', EDITOR_API_TOKEN: '' }, () => {
    expectNoThrow(() => assertProductionAuthConfigured())
  })
})

check('dev: short token passes', () => {
  withEnv({ NODE_ENV: 'development', EDITOR_API_TOKEN: 'abc' }, () => {
    expectNoThrow(() => assertProductionAuthConfigured())
  })
})

check('prod: empty token throws', () => {
  withEnv({ NODE_ENV: 'production', EDITOR_API_TOKEN: '' }, () => {
    expectThrow(() => assertProductionAuthConfigured(), 'EDITOR_API_TOKEN must be set')
  })
})

check('prod: missing token throws', () => {
  withEnv({ NODE_ENV: 'production', EDITOR_API_TOKEN: undefined }, () => {
    expectThrow(() => assertProductionAuthConfigured(), 'EDITOR_API_TOKEN must be set')
  })
})

check('prod: 8-char token rejected', () => {
  withEnv({ NODE_ENV: 'production', EDITOR_API_TOKEN: 'abc12345' }, () => {
    expectThrow(() => assertProductionAuthConfigured(), 'too short')
  })
})

check('prod: 15-char token rejected (just under 16)', () => {
  withEnv({ NODE_ENV: 'production', EDITOR_API_TOKEN: '0123456789abcde' }, () => {
    expectThrow(() => assertProductionAuthConfigured(), 'too short')
  })
})

check('prod: 16-char token accepted', () => {
  withEnv({ NODE_ENV: 'production', EDITOR_API_TOKEN: '0123456789abcdef' }, () => {
    expectNoThrow(() => assertProductionAuthConfigured())
  })
})

check('prod: whitespace-padded token, trimmed length matters', () => {
  withEnv({ NODE_ENV: 'production', EDITOR_API_TOKEN: '   abc   ' }, () => {
    expectThrow(() => assertProductionAuthConfigured(), 'too short')
  })
})

// ---- extractEditorName ----

function fakeReq(headerValue) {
  return {
    header: (name) => (name.toLowerCase() === 'x-editor-name' ? headerValue : undefined),
  }
}

check('extractEditorName: missing header defaults to editor', () => {
  if (extractEditorName(fakeReq(undefined)) !== 'editor') throw new Error('expected default "editor"')
})

check('extractEditorName: empty string defaults to editor', () => {
  if (extractEditorName(fakeReq('')) !== 'editor') throw new Error('expected "editor"')
})

check('extractEditorName: whitespace-only defaults to editor', () => {
  if (extractEditorName(fakeReq('   ')) !== 'editor') throw new Error('expected "editor"')
})

check('extractEditorName: simple name passes', () => {
  if (extractEditorName(fakeReq('Kim')) !== 'Kim') throw new Error('expected "Kim"')
})

check('extractEditorName: Norwegian name passes', () => {
  if (extractEditorName(fakeReq('Kjell Åge')) !== 'Kjell Åge') throw new Error('expected "Kjell Åge"')
})

check('extractEditorName: hyphenated name passes', () => {
  if (extractEditorName(fakeReq('Mary-Anne')) !== 'Mary-Anne') throw new Error('expected "Mary-Anne"')
})

check('extractEditorName: apostrophe passes', () => {
  if (extractEditorName(fakeReq("O'Connor")) !== "O'Connor") throw new Error(`got: ${extractEditorName(fakeReq("O'Connor"))}`)
})

check('extractEditorName: HTML-injection rejected', () => {
  if (extractEditorName(fakeReq('<script>alert(1)</script>')) !== 'editor') {
    throw new Error('should fall back to default for chars outside allowlist')
  }
})

check('extractEditorName: SQL-ish rejected', () => {
  if (extractEditorName(fakeReq("Kim'; DROP TABLE")) !== 'editor') {
    throw new Error('should reject — semicolon not in allowlist')
  }
})

check('extractEditorName: newline rejected', () => {
  if (extractEditorName(fakeReq('Kim\nHacker')) !== 'editor') {
    throw new Error('should reject newline')
  }
})

check('extractEditorName: long name truncated to 60', () => {
  const long = 'a'.repeat(200)
  const out = extractEditorName(fakeReq(long))
  if (out.length !== 60) throw new Error(`expected length 60, got ${out.length}`)
})

// ---- print summary ----

let pass = 0
let fail = 0
for (const r of results) {
  const tag = r.status === 'PASS' ? 'PASS' : 'FAIL'
  console.log(`${tag}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  if (r.status === 'PASS') pass += 1
  else fail += 1
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
