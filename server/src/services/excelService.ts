import ExcelJS from 'exceljs'
import { query } from '../db.js'

export async function generateExcel(): Promise<ExcelJS.Workbook> {
  const result = await query(`
    SELECT * FROM sites ORDER BY site_number
  `)
  const sites = result.rows

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('IGS Assessment')

  const fields = [
    { key: 'header', label: 'Field', response: 'Response / Code' },
    { key: 'igs_type', label: 'IGS TYPE (Lot, Edgeland, or Residual)', response: 'Lot / Edgeland / Residual' },
    { key: 'lot_q', label: 'Is the space primarily a vacant/underused parcel clearly bounded by buildings/plots?', response: 'Yes / No' },
    { key: 'edge_q', label: 'Is the space\'s identity driven by being at a boundary between unlike systems?', response: 'Yes / No' },
    { key: 'residual_q', label: 'Did the space arise as leftover from infrastructure geometry?', response: 'Yes / No' },
    { key: 'type_auto', label: 'Primary Type (Auto-coded)', response: 'Lot / Edgeland / Residual / Review' },
    { key: 'subtype', label: 'Subtype(s)', response: 'Hydro / Bio / Geo / Infra / N/A' },
    { key: 'spacer1', label: '', response: '' },
    { key: 'section_oam', label: 'Ownership, access, and maintenance', response: '' },
    { key: 'ownership', label: 'Ownership (PUB / PRI / UNK)', response: 'PUB / PRI / UNK' },
    { key: 'access_control', label: 'Access Control (Open or partial or closed)', response: 'O / P / C' },
    { key: 'access_description', label: 'Access control description', response: '' },
    { key: 'natural_barrier', label: 'Natural barrier type', response: '' },
    { key: 'maintenance', label: 'Maintenance Regime (FM / IM / NM)', response: 'FM / IM / NM' },
    { key: 'maintenance_frequency', label: 'Maintenance Frequency (W / M / S / U)', response: 'W / M / S / U' },
    { key: 'spacer2', label: '', response: '' },
    { key: 'section_opp', label: 'Opportunities', response: '' },
    { key: 'prox_housing', label: 'Cultural Services: Proximity to dense housing (PROX)', response: 'Yes / No' },
    { key: 'hidden_gem', label: 'Cultural Services: Hidden gem quality (GEM)', response: 'Yes / No' },
    { key: 'dangerous', label: 'Cultural Service Deterrents: Dangerous infrastructure (DANG)', response: 'Yes / No' },
    { key: 'noisy', label: 'Cultural Service Deterrents: Noise >65 dB (NOIS)', response: 'Yes / No' },
    { key: 'too_small', label: 'Cultural Service Deterrents: Very small size (SML)', response: 'Yes / No' },
    { key: 'notes', label: 'Notes / Observations', response: '' },
    { key: 'spacer3', label: '', response: '' },
    { key: 'good_opp', label: 'GOOD OPPORTUNITY', response: '' },
  ]

  const headerRow = ['Field', 'Response / Code']
  sites.forEach((s: Record<string, unknown>) => headerRow.push(s.site_number as string))
  ws.addRow(headerRow)

  const boolToYesNo = (v: unknown) => v === true ? 'Yes' : v === false ? 'No' : ''

  for (const field of fields.slice(1)) {
    const row: (string | number | null)[] = [field.label, field.response]
    for (const site of sites) {
      let val: string | number | null = ''
      switch (field.key) {
        case 'igs_type': case 'type_auto':
          val = site.igs_type; break
        case 'subtype':
          val = site.subtype ?? 'N/A'; break
        case 'lot_q':
          val = site.igs_type === 'Lot' ? 'Yes' : 'No'; break
        case 'edge_q':
          val = site.igs_type === 'Edgeland' ? 'Yes' : 'No'; break
        case 'residual_q':
          val = site.igs_type === 'Residual' ? 'Yes' : 'No'; break
        case 'ownership':
          val = site.ownership; break
        case 'access_control':
          val = site.access_control; break
        case 'access_description':
          val = site.access_description; break
        case 'natural_barrier':
          val = site.natural_barrier; break
        case 'maintenance':
          val = site.maintenance; break
        case 'maintenance_frequency':
          val = site.maintenance_frequency; break
        case 'prox_housing':
          val = boolToYesNo(site.prox_housing); break
        case 'hidden_gem':
          val = boolToYesNo(site.hidden_gem); break
        case 'dangerous':
          val = boolToYesNo(site.dangerous); break
        case 'noisy':
          val = boolToYesNo(site.noisy); break
        case 'too_small':
          val = boolToYesNo(site.too_small); break
        case 'notes':
          val = site.notes; break
        case 'good_opp':
          val = boolToYesNo(site.good_opportunity); break
        default:
          val = ''
      }
      row.push(val)
    }
    ws.addRow(row)
  }

  ws.getColumn(1).width = 60
  ws.getColumn(2).width = 20
  for (let i = 3; i <= sites.length + 2; i++) {
    ws.getColumn(i).width = 15
  }

  const hdrRow = ws.getRow(1)
  hdrRow.font = { bold: true }
  hdrRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }

  return wb
}
