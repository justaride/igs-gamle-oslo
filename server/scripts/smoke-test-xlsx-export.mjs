import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Buffer } from 'node:buffer'

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

assert.equal(
  packageJson.dependencies?.exceljs,
  undefined,
  'server dependencies should not include exceljs'
)
assert.equal(
  typeof packageJson.dependencies?.fflate,
  'string',
  'server should use fflate for small XLSX zip generation'
)

const excelServiceSource = fs.readFileSync(
  new URL('../src/services/excelService.ts', import.meta.url),
  'utf8'
)
assert.equal(
  /exceljs/i.test(excelServiceSource),
  false,
  'excelService should not import or mention exceljs'
)

const { unzipSync, strFromU8 } = await import('fflate')
const { buildXlsxWorkbook } = await import('../dist/services/xlsxWriter.js')

const workbook = buildXlsxWorkbook({
  sheetName: 'IGS Assessment',
  rows: [
    ['Field', 'Response / Code', 'IGS-1'],
    ['IGS TYPE (Lot, Edgeland, or Residual)', 'Lot / Edgeland / Residual', 'Residual'],
    ['Notes / Observations', '', 'A&B <check>'],
  ],
  columnWidths: [60, 20, 15],
})

assert.equal(Buffer.isBuffer(workbook), true, 'workbook should be a Node Buffer')
assert.equal(workbook.subarray(0, 2).toString('utf8'), 'PK', 'xlsx should be a zip package')

const files = unzipSync(new Uint8Array(workbook))
for (const name of [
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/worksheets/sheet1.xml',
  'xl/styles.xml',
]) {
  assert.ok(files[name], `xlsx should include ${name}`)
}

const sheetXml = strFromU8(files['xl/worksheets/sheet1.xml'])
const stylesXml = strFromU8(files['xl/styles.xml'])

assert.match(sheetXml, /<worksheet /, 'sheet xml should contain a worksheet root')
assert.match(sheetXml, /<dimension ref="A1:C3"/, 'sheet dimension should match written rows')
assert.match(sheetXml, /<col min="1" max="1" width="60"/, 'first column width should be preserved')
assert.match(sheetXml, /<c r="A1" t="inlineStr" s="1">/, 'header cells should use header style')
assert.match(sheetXml, /<t>IGS-1<\/t>/, 'site header should be present')
assert.match(sheetXml, /A&amp;B &lt;check&gt;/, 'cell text should be XML escaped')
assert.match(stylesXml, /<b\/>/, 'styles should include bold header font')
assert.match(stylesXml, /FF4472C4/, 'styles should include the existing header fill color')

console.log('xlsx export smoke passed')
