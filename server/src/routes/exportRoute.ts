import { Router } from 'express'
import { asyncHandler } from '../http.js'
import { generateExcel } from '../services/excelService.js'

const router = Router()

router.get('/excel', asyncHandler(async (_req, res) => {
  const wb = await generateExcel()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=IGS_Assessment_GamleOslo.xlsx')
  await wb.xlsx.write(res)
  res.end()
}))

export default router
