import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const DISCLAIMER =
  'เอกสารนี้เป็นการประเมินเบื้องต้นเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุนที่การันตีผล ' +
  'กรุณาปรึกษาผู้เชี่ยวชาญทางการเงินก่อนตัดสินใจลงทุน'

export async function exportToPDF(elementId: string, filename = 'financial-assessment.pdf') {
  const el = document.getElementById(elementId)
  if (!el) throw new Error(`Element #${elementId} not found`)

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    scrollY: -window.scrollY,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentW = pageW - margin * 2
  const imgH = (canvas.height * contentW) / canvas.width

  let y = margin
  let remainH = imgH

  while (remainH > 0) {
    const sliceH = Math.min(remainH, pageH - margin * 2)
    const srcY = (imgH - remainH) * (canvas.height / imgH)
    const srcH = sliceH * (canvas.height / imgH)

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = srcH
    const ctx = sliceCanvas.getContext('2d')!
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, y, contentW, sliceH)
    remainH -= sliceH

    if (remainH > 0) {
      pdf.addPage()
      y = margin
    }
  }

  pdf.setFontSize(7)
  pdf.setTextColor(150, 150, 150)
  pdf.text(DISCLAIMER, margin, pageH - 6, { maxWidth: contentW })

  pdf.setFontSize(7)
  pdf.setTextColor(180, 180, 180)
  pdf.text(
    `สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}`,
    margin, pageH - 3
  )

  pdf.save(filename)
}
