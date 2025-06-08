import https from 'https'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import GoogleFonts from './index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const FONTS_DIR = path.join(__dirname, 'fonts')
const BATCH_SIZE = 3
const DELAY_BETWEEN_BATCHES = 500

// Parse command line arguments
const args = process.argv.slice(2)
const OVERWRITE = args.includes('--overwrite') || args.includes('-o')
const SKIP_EXISTING = args.includes('--skip') || args.includes('-s')

/**
 * Get Google Fonts CSS download URL
 * @param {string} fontName - Font name (space replaced with +)
 * @param {string} weight - Font weight
 * @param {boolean} italic - Whether to include italic variant
 * @returns {string} CSS URL
 */
function getCssDownloadURL(fontName, weight, italic = false) {
  const style = italic ? 'ital,wght@1,' : 'wght@'
  return `https://fonts.googleapis.com/css2?family=${fontName}:${style}${weight}&display=swap`
}

/**
 * Download content from URL using https
 * @param {string} url - URL to download from
 * @returns {Promise<Buffer>} Downloaded content
 */
function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }

      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * Parse Google Fonts CSS to extract font file URLs
 * @param {string} cssText - CSS text from Google Fonts API
 * @returns {Array} Array of font face objects with URLs and metadata
 */
function parseFontCSS(cssText) {
  const fontFaces = []
  const fontFaceRegex = /@font-face\s*{([^}]+)}/g
  let match

  while ((match = fontFaceRegex.exec(cssText)) !== null) {
    const rules = match[1]
    const fontFace = {}

    // Extract font properties
    const properties = [
      'font-family',
      'font-style',
      'font-weight',
      'font-stretch',
      'font-display'
    ]

    properties.forEach(prop => {
      const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i')
      const propMatch = rules.match(regex)
      if (propMatch) {
        fontFace[prop.replace('-', '')] = propMatch[1].trim().replace(/['"]/g, '')
      }
    })

    // Extract font file URL
    const urlMatch = rules.match(/url\(([^)]+)\)/)
    if (urlMatch) {
      const url = urlMatch[1].replace(/['"]/g, '')
      fontFace.url = url
      fontFace.format = getFormatFromUrl(url)
    }

    if (fontFace.url && fontFace.fontfamily) {
      fontFaces.push(fontFace)
    }
  }

  return fontFaces
}

/**
 * Get font format from URL
 * @param {string} url - Font file URL
 * @returns {string} Font format
 */
function getFormatFromUrl(url) {
  if (url.includes('.woff2')) return 'woff2'
  if (url.includes('.woff')) return 'woff'
  if (url.includes('.ttf')) return 'ttf'
  if (url.includes('.otf')) return 'otf'
  if (url.includes('.eot')) return 'eot'
  return 'woff2'
}

/**
 * Create directory structure for fonts categorized by language
 * @param {string} fontFamily - Font family name
 * @param {string} primaryLanguage - Primary language/subset for the font
 */
async function ensureFontDirectory(fontFamily, primaryLanguage = 'latin') {
  const languageDir = path.join(FONTS_DIR, primaryLanguage)
  const fontDir = path.join(languageDir, fontFamily.replace(/\s+/g, '-').toLowerCase())
  await fs.mkdir(fontDir, { recursive: true })
  return fontDir
}

/**
 * Download and save font file
 * @param {Object} fontFace - Font face object with URL and metadata
 * @param {string} fontFamily - Font family name
 * @param {string} fontDir - Directory to save font
 * @param {string} language - Primary language/subset for the font
 */
async function downloadAndSaveFont(fontFace, fontFamily, fontDir, language = 'latin') {
  try {
    // Generate filename
    const weight = fontFace.fontweight || '400'
    const style = fontFace.fontstyle || 'normal'
    const format = fontFace.format
    const filename = `${fontFamily.replace(/\s+/g, '-')}-${weight}-${style}.${format}`
    
    const filepath = path.join(fontDir, filename)
    
    // Check if file exists
    try {
      await fs.access(filepath)
      if (SKIP_EXISTING) {        console.log(`⏭️  Skipping existing file: ${filename}`)
        return {
          family: fontFamily,
          weight,
          style,
          format,
          filename,
          size: 0,
          skipped: true,
          language
        }
      } else {
        console.log(`  ⚠️  File exists, overwriting: ${filename}`)
      }
    } catch {
      // File doesn't exist, proceed normally
    }
    
    console.log(`Downloading: ${fontFamily} - ${weight} ${style}`)
    const fontData = await downloadUrl(fontFace.url)
    
    await fs.writeFile(filepath, fontData)
      console.log(`✓ Saved: ${filename}`)
    
    return {
      family: fontFamily,
      weight,
      style,
      format,
      filename,
      size: fontData.length,
      language
    }
  } catch (error) {
    console.error(`✗ Error downloading ${fontFamily}:`, error.message)
    throw error
  }
}

/**
 * Parse variant string to extract italic and weight
 * @param {string} variant - Variant string in format "italic,weight"
 * @returns {Object} Object with italic boolean and weight string
 */
function parseVariant(variant) {
  const [italic, weight] = variant.split(',')
  return {
    italic: italic === '1',
    weight: weight
  }
}

/**
 * Download font variants (normal and italic)
 * @param {Object} font - Font object with family and variants
 */
async function downloadFontVariants(font) {
  // Get primary language from subsets (first subset is usually the primary language)
  const primaryLanguage = font.subsets && font.subsets.length > 0 ? font.subsets[0] : 'latin'
  const fontDir = await ensureFontDirectory(font.family, primaryLanguage)
  const downloaded = []
  
  // Parse variants from font object
  const parsedVariants = font.variants.map(parseVariant)
  
  // Group by batches
  for (let i = 0; i < parsedVariants.length; i += BATCH_SIZE) {
    const batch = parsedVariants.slice(i, i + BATCH_SIZE)
    
    const batchPromises = batch.map(variant => {
      return (async () => {
        try {
          const fontName = font.family.replace(/\s/g, '+')
          const cssUrl = getCssDownloadURL(fontName, variant.weight, variant.italic)
          const cssText = (await downloadUrl(cssUrl)).toString('utf-8')
          const fontFaces = parseFontCSS(cssText)
            const results = []
          for (const fontFace of fontFaces) {
            const result = await downloadAndSaveFont(fontFace, font.family, fontDir, primaryLanguage)
            results.push(result)
          }
          return results
        } catch (error) {
          const style = variant.italic ? 'italic' : 'normal'
          console.error(`Failed to download ${font.family} ${style} weight ${variant.weight}:`, error.message)
          return []
        }
      })()
    })
    
    const batchResults = await Promise.all(batchPromises)
    downloaded.push(...batchResults.flat())
    
    // Add delay between batches
    if (i + BATCH_SIZE < parsedVariants.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }
  
  return downloaded
}

/**
 * Generate metadata file for downloaded fonts categorized by language
 * @param {Array} downloadedFonts - Array of downloaded font information
 */
async function generateMetadata(downloadedFonts) {
  // Filter out skipped fonts
  const actuallyDownloaded = downloadedFonts.filter(font => !font.skipped)
  
  const metadata = {
    generatedAt: new Date().toISOString(),
    totalFonts: actuallyDownloaded.length,
    skippedFonts: downloadedFonts.filter(font => font.skipped).length,
    languages: {}
  }
  
  // Group fonts by language
  actuallyDownloaded.forEach(font => {
    const language = font.language || 'latin'
    
    if (!metadata.languages[language]) {
      metadata.languages[language] = {
        totalFonts: 0,
        fonts: {}
      }
    }
    
    if (!metadata.languages[language].fonts[font.family]) {
      metadata.languages[language].fonts[font.family] = {
        variants: []
      }
      metadata.languages[language].totalFonts++
    }
    
    metadata.languages[language].fonts[font.family].variants.push({
      weight: font.weight,
      style: font.style,
      format: font.format,
      filename: font.filename,
      size: font.size
    })
  })
  
  // Add summary statistics
  metadata.languageStats = {}
  Object.keys(metadata.languages).forEach(language => {
    metadata.languageStats[language] = {
      fontFamilies: Object.keys(metadata.languages[language].fonts).length,
      totalVariants: metadata.languages[language].fonts ? 
        Object.values(metadata.languages[language].fonts).reduce((sum, font) => sum + font.variants.length, 0) : 0
    }
  })
  
  await fs.writeFile(
    path.join(FONTS_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  )
}

/**
 * Main function to download all fonts
 */
async function main() {
  console.log('Starting font download...')
  console.log(`Fonts will be saved to: ${FONTS_DIR}`)
  console.log(`Mode: ${SKIP_EXISTING ? 'Skip existing files' : 'Overwrite existing files'}`)
  console.log('Usage: node download-fonts.js [--overwrite|-o] [--skip|-s]\n')
  
  // Create fonts directory
  await fs.mkdir(FONTS_DIR, { recursive: true })
    const allDownloaded = []
  
  // Download all fonts
  const fontsToDownload = GoogleFonts
  // const fontsToDownload = GoogleFonts.slice(0, 10) // Use this for testing with first 10 fonts only
    // Process each font
  for (let i = 0; i < fontsToDownload.length; i++) {
    const font = fontsToDownload[i]
    const primaryLanguage = font.subsets && font.subsets.length > 0 ? font.subsets[0] : 'latin'
    console.log(`\n[${i + 1}/${fontsToDownload.length}] Processing: ${font.family}`)
    console.log(`  Language: ${primaryLanguage} (${font.subsets ? font.subsets.join(', ') : 'latin'})`)
    console.log(`  Variants: ${font.variants.length} (${font.variants.join(', ')})`)
    
    try {
      const downloaded = await downloadFontVariants(font)
      allDownloaded.push(...downloaded)
      
      // Add delay between fonts to be respectful to Google's servers
      if (i < GoogleFonts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`Failed to process ${font.family}:`, error)
    }
  }
  
  // Generate metadata
  await generateMetadata(allDownloaded)
  
  const actuallyDownloaded = allDownloaded.filter(font => !font.skipped).length
  const skipped = allDownloaded.filter(font => font.skipped).length
  
  console.log('\n✅ Font download completed!')
  console.log(`Total fonts downloaded: ${actuallyDownloaded}`)
  if (skipped > 0) {
    console.log(`Skipped existing: ${skipped}`)
  }
}

// Run the script
main().catch(console.error)
