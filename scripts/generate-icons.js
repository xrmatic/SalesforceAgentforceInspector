import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')

mkdirSync(iconsDir, { recursive: true })

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background gradient (Salesforce blue)
  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, '#0070d2')
  gradient.addColorStop(1, '#16325c')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.2)
  ctx.fill()

  // Lightning bolt symbol
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.55}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⚡', size / 2, size / 2)

  return canvas.toBuffer('image/png')
}

const sizes = [16, 32, 48, 128]
for (const size of sizes) {
  const buffer = generateIcon(size)
  const outputPath = join(iconsDir, `icon${size}.png`)
  writeFileSync(outputPath, buffer)
  console.log(`Generated ${outputPath}`)
}

console.log('Icons generated successfully!')
