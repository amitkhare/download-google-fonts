import { FontsStore } from '@/plugins/storage.js'
import { getCssDownloadURL } from './index.js'
import latinFonts from "./latin.js"
/**
 * Enhanced font storage composable for downloading and storing actual font files
 * Supports Google Fonts API with IndexedDB storage for offline usage
 */
export function useFontStorage() {  /**
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
      })      // Extract font file URL
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
   * @returns {string} Font format (woff2, woff, ttf, etc.)
   */
  function getFormatFromUrl(url) {
    if (url.includes('.woff2')) return 'woff2'
    if (url.includes('.woff')) return 'woff'
    if (url.includes('.ttf')) return 'truetype'
    if (url.includes('.otf')) return 'opentype'
    if (url.includes('.eot')) return 'embedded-opentype'
    return 'unknown'
  }
  /**
   * Generate unique font ID for storage
   * @param {string} fontFamily - Font family name
   * @param {string} fontWeight - Font weight
   * @param {string} fontStyle - Font style
   * @returns {string} Unique font ID
   */
  function generateFontId(fontFamily, fontWeight = '400', fontStyle = 'normal') {
    // Ensure fontFamily is a string
    const familyStr = typeof fontFamily === 'string' ? fontFamily : String(fontFamily || 'unknown')
    return `${familyStr.replace(/\s+/g, '-').toLowerCase()}-${fontWeight}-${fontStyle}`
  }

  /**
   * Download font file and store in IndexedDB
   * @param {Object} fontFace - Font face object with URL and metadata
   * @param {string} fontFamily - Original font family name
   * @returns {Promise<Object>} Stored font object
   */
  async function downloadAndStoreFont(fontFace, fontFamily) {
    try {
      console.log(`Downloading font file: ${fontFace.url}`)
      
      // Download font file
      const response = await fetch(fontFace.url)
      if (!response.ok) {
        throw new Error(`Failed to download font: ${response.statusText}`)
      }

      const fontBlob = await response.blob()
      const fontId = generateFontId(fontFamily, fontFace.fontweight, fontFace.fontstyle)

      // Prepare font object for storage
      const fontObject = {
        id: fontId,
        fontFamily: fontFamily,
        fontWeight: fontFace.fontweight || '400',
        fontStyle: fontFace.fontstyle || 'normal',
        fontStretch: fontFace.fontstretch || 'normal',
        fontDisplay: fontFace.fontdisplay || 'swap',
        format: fontFace.format,
        blob: fontBlob,
        originalUrl: fontFace.url,
        downloadedAt: new Date().toISOString(),
        size: fontBlob.size
      }      // Store in IndexedDB
      await FontsStore.setItem(fontId, fontObject)
      console.log(`Font stored successfully: ${fontId}`)

      return fontObject
    } catch (error) {
      console.error(`Error downloading/storing font:`, error)
      throw error
    }
  }

  /**
   * Download and store multiple font variants
   * @param {Object} font - Font object with family and variants
   * @param {Array} variants - Array of font variants to download ['400', '700', etc.]
   * @returns {Promise<Array>} Array of stored font objects
   */  async function downloadFontVariants(font, variants = ['400']) {
    try {
      // Validate font parameter
      if (!font || typeof font !== 'object') {
        throw new Error('Font parameter must be an object with a family property')
      }
      
      if (!font.family || typeof font.family !== 'string') {
        throw new Error('Font object must have a valid family property')
      }

      const storedFonts = []
      
      // Process variants in batches to avoid overwhelming the server
      const batchSize = 3
      for (let i = 0; i < variants.length; i += batchSize) {
        const batch = variants.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async (variant) => {
          try {
            // Build Google Fonts CSS URL
            const fontName = font.family.replace(/\s/g, '+')
            const cssUrl = getCssDownloadURL(fontName, variant)

            console.log(`Fetching CSS for ${font.family} weight ${variant}`)
            
            // Fetch CSS
            const cssResponse = await fetch(cssUrl)
            if (!cssResponse.ok) {
              throw new Error(`Failed to fetch CSS: ${cssResponse.statusText}`)
            }
            
            const cssText = await cssResponse.text()
            
            // Parse CSS to extract font URLs
            const fontFaces = parseFontCSS(cssText)
            
            // Download and store each font face
            const fontPromises = fontFaces.map(fontFace => 
              downloadAndStoreFont(fontFace, font.family)
            )
            
            return await Promise.all(fontPromises)
          } catch (error) {
            console.error(`Failed to process variant ${variant} for ${font.family}:`, error)
            return []
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        storedFonts.push(...batchResults.flat())
        
        // Add delay between batches to be respectful to Google's servers
        if (i + batchSize < variants.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      return storedFonts
    } catch (error) {
      console.error(`Error downloading font variants for ${font.family}:`, error)
      throw error
    }
  }

  /**
   * Load font from IndexedDB and create CSS
   * @param {string} fontFamily - Font family name
   * @param {string} fontWeight - Font weight
   * @param {string} fontStyle - Font style
   * @returns {Promise<string|null>} Blob URL for the font or null if not found
   */  async function loadStoredFont(fontFamily, fontWeight = '400', fontStyle = 'normal') {
    try {
      const fontId = generateFontId(fontFamily, fontWeight, fontStyle)
      const fontObject = await FontsStore.getItem(fontId)
      
      if (!fontObject || !fontObject.blob) {
        console.log(`Font not found in storage: ${fontId}`)
        return null
      }
      
      // Create blob URL
      const blobUrl = URL.createObjectURL(fontObject.blob)
      console.log(`Loaded font from storage: ${fontId}`)
      
      return {
        blobUrl,
        fontObject
      }
    } catch (error) {
      console.error(`Error loading stored font:`, error)
      return null
    }
  }

  /**
   * Create CSS @font-face rule from stored font
   * @param {Object} fontObject - Stored font object
   * @param {string} blobUrl - Blob URL for the font
   * @returns {string} CSS @font-face rule
   */
  function createFontFaceCSS(fontObject, blobUrl) {
    return `
      @font-face {
        font-family: '${fontObject.fontFamily}';
        font-style: ${fontObject.fontStyle};
        font-weight: ${fontObject.fontWeight};
        font-stretch: ${fontObject.fontStretch};
        font-display: ${fontObject.fontDisplay};
        src: url('${blobUrl}') format('${fontObject.format}');
      }
    `
  }
  /**
   * Load and apply stored fonts to document
   * @param {string} fontFamily - Font family name
   * @param {Array} variants - Array of variants to load
   * @returns {Promise<boolean>} Success status
   */
  async function loadAndApplyStoredFonts(fontFamily, variants = ['400']) {
    try {
      // Validate fontFamily parameter
      if (!fontFamily || typeof fontFamily !== 'string') {
        console.error('loadAndApplyStoredFonts: fontFamily must be a string, received:', typeof fontFamily, fontFamily)
        return false
      }

      const cssRules = []
      const loadedVariants = []
      
      for (const variant of variants) {
        const result = await loadStoredFont(fontFamily, variant, 'normal')
        if (result) {
          const css = createFontFaceCSS(result.fontObject, result.blobUrl)
          cssRules.push(css)
          loadedVariants.push(variant)
        }
        
        // Also try italic if it exists
        const italicResult = await loadStoredFont(fontFamily, variant, 'italic')
        if (italicResult) {
          const css = createFontFaceCSS(italicResult.fontObject, italicResult.blobUrl)
          cssRules.push(css)
          loadedVariants.push(`${variant}-italic`)
        }
      }
      
      if (cssRules.length > 0) {
        // Create or update style element
        let styleElement = document.getElementById(`stored-font-${fontFamily.replace(/\s+/g, '-')}`)
        if (!styleElement) {
          styleElement = document.createElement('style')
          styleElement.id = `stored-font-${fontFamily.replace(/\s+/g, '-')}`
          document.head.appendChild(styleElement)
        }
        
        styleElement.textContent = cssRules.join('\n')
        console.log(`Applied stored fonts for ${fontFamily}:`, loadedVariants)
        return true
      }
      
      return false
    } catch (error) {
      console.error(`Error loading/applying stored fonts:`, error)
      return false
    }
  }

  /**
   * Get all stored fonts metadata
   * @returns {Promise<Array>} Array of stored font metadata
   */
  async function getStoredFontsMetadata() {
    try {
      const keys = await FontsStore.getAllKeys()
      const metadata = []
      
      for (const key of keys) {
        const fontObject = await FontsStore.getItem(key)
        if (fontObject) {
          metadata.push({
            id: fontObject.id,
            fontFamily: fontObject.fontFamily,
            fontWeight: fontObject.fontWeight,
            fontStyle: fontObject.fontStyle,
            format: fontObject.format,
            size: fontObject.size,
            downloadedAt: fontObject.downloadedAt
          })
        }
      }
      
      return metadata
    } catch (error) {
      console.error('Error getting stored fonts metadata:', error)
      return []
    }
  }

  /**
   * Check if font is stored locally
   * @param {string} fontFamily - Font family name
   * @param {Array} variants - Array of variants to check
   * @returns {Promise<Object>} Object with availability status
   */
  async function checkFontAvailability(fontFamily, variants = ['400']) {
    try {
      const availability = {
        fontFamily,
        isFullyStored: true,
        availableVariants: [],
        missingVariants: []
      }
      
      for (const variant of variants) {
        const fontId = generateFontId(fontFamily, variant, 'normal')
        const stored = await FontsStore.getItem(fontId)
        
        if (stored) {
          availability.availableVariants.push(variant)
        } else {
          availability.missingVariants.push(variant)
          availability.isFullyStored = false
        }
      }
      
      return availability
    } catch (error) {
      console.error('Error checking font availability:', error)
      return {
        fontFamily,
        isFullyStored: false,
        availableVariants: [],
        missingVariants: variants
      }
    }
  }
  /**
   * Delete stored font
   * @param {string} fontFamily - Font family name
   * @param {string} fontWeight - Font weight (optional, deletes all if not specified)
   * @param {string} fontStyle - Font style (optional)
   * @returns {Promise<boolean>} Success status
   */
  async function deleteStoredFont(fontFamily, fontWeight = null, fontStyle = null) {
    try {
      // Validate fontFamily parameter
      if (!fontFamily || typeof fontFamily !== 'string') {
        console.error('deleteStoredFont: fontFamily must be a string, received:', typeof fontFamily, fontFamily)
        return false
      }

      if (fontWeight && fontStyle) {
        // Delete specific variant
        const fontId = generateFontId(fontFamily, fontWeight, fontStyle)
        await FontsStore.removeItem(fontId)
        console.log(`Deleted font variant: ${fontId}`)
        return true
      } else {
        // Delete all variants of the font family
        const keys = await FontsStore.getAllKeys()
        const fontFamilyId = fontFamily.replace(/\s+/g, '-').toLowerCase()
        const keysToDelete = keys.filter(key => key.startsWith(fontFamilyId))
        
        for (const key of keysToDelete) {
          await FontsStore.removeItem(key)
        }
        
        console.log(`Deleted all variants of font: ${fontFamily}`)
        return true
      }
    } catch (error) {
      console.error('Error deleting stored font:', error)
      return false
    }
  }

  /**
   * Upload and store custom font file
   * @param {File} fontFile - Font file from file input
   * @param {string} customName - Optional custom name for the font
   * @returns {Promise<Object>} Result object with status and font data
   */
  async function uploadAndStoreCustomFont(fontFile, customName = null) {
    try {
      // Validate file type
      const supportedTypes = [
        'font/ttf',
        'font/otf', 
        'application/font-sfnt',
        'application/x-font-ttf',
        'application/x-font-otf',
        'font/woff',
        'font/woff2'
      ]
      
      const isValidType = supportedTypes.includes(fontFile.type) || 
                         fontFile.name.match(/\.(ttf|otf|woff|woff2)$/i)
      
      if (!isValidType) {
        throw new Error('Unsupported font file type. Please upload TTF, OTF, WOFF, or WOFF2 files.')
      }

      // Extract font name from file or use custom name
      const fontName = customName || fontFile.name.replace(/\.(ttf|otf|woff|woff2)$/i, '')
      const format = getFormatFromFileName(fontFile.name)
      const fontId = generateFontId(fontName, '400', 'normal') + '-custom'
      
      // Check if font already exists
      const existingFont = await FontsStore.getItem(fontId)
      if (existingFont) {
        console.log(`Font already exists: ${fontName}`)
        return {
          status: 'exists',
          fontName: fontName,
          fileName: fontFile.name,
          fontObject: existingFont
        }
      }

      console.log(`Uploading custom font: ${fontName}`)

      // Create blob from file
      const fontBlob = new Blob([await fontFile.arrayBuffer()], { type: fontFile.type })

      // Prepare font object for storage
      const fontObject = {
        id: fontId,
        fontFamily: fontName,
        fontWeight: '400',
        fontStyle: 'normal',
        fontStretch: 'normal',
        fontDisplay: 'swap',
        format: format,
        blob: fontBlob,
        originalName: fontFile.name,
        isCustomFont: true,
        uploadedAt: new Date().toISOString(),
        size: fontBlob.size
      }

      // Store in IndexedDB
      await FontsStore.setItem(fontId, fontObject)
      console.log(`Custom font stored successfully: ${fontId}`)

      // Create and inject CSS immediately
      const blobUrl = URL.createObjectURL(fontBlob)
      const css = createFontFaceCSS(fontObject, blobUrl)
      
      // Create style element for custom font
      let styleElement = document.getElementById(`custom-font-${fontName.replace(/\s+/g, '-')}`)
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = `custom-font-${fontName.replace(/\s+/g, '-')}`
        document.head.appendChild(styleElement)
      }
      styleElement.textContent = css

      return {
        status: 'uploaded',
        fontName: fontName,
        fileName: fontFile.name,
        fontObject: fontObject
      }
    } catch (error) {
      console.error(`Error uploading/storing custom font:`, error)
      return {
        status: 'error',
        fontName: customName || fontFile.name,
        fileName: fontFile.name,
        error: error.message
      }
    }
  }

  /**
   * Get font format from file name
   * @param {string} fileName - Font file name
   * @returns {string} Font format
   */
  function getFormatFromFileName(fileName) {
    const extension = fileName.toLowerCase().split('.').pop()
    switch (extension) {
      case 'woff2': return 'woff2'
      case 'woff': return 'woff'
      case 'ttf': return 'truetype'
      case 'otf': return 'opentype'
      default: return 'truetype'
    }
  }

  /**
   * Get all custom fonts
   * @returns {Promise<Array>} Array of custom font metadata
   */
  async function getCustomFonts() {
    try {
      const keys = await FontsStore.getAllKeys()
      const customFonts = []
      
      for (const key of keys) {
        if (key.includes('-custom')) {
          const fontObject = await FontsStore.getItem(key)
          if (fontObject && fontObject.isCustomFont) {
            customFonts.push({
              id: fontObject.id,
              fontFamily: fontObject.fontFamily,
              originalName: fontObject.originalName,
              format: fontObject.format,
              size: fontObject.size,
              uploadedAt: fontObject.uploadedAt
            })
          }
        }
      }
      
      return customFonts
    } catch (error) {
      console.error('Error getting custom fonts:', error)
      return []
    }
  }

  /**
   * Load custom font and apply to document
   * @param {string} fontFamily - Font family name
   * @returns {Promise<boolean>} Success status
   */
  async function loadCustomFont(fontFamily) {
    try {
      const fontId = generateFontId(fontFamily, '400', 'normal') + '-custom'
      const fontObject = await FontsStore.getItem(fontId)
      
      if (!fontObject || !fontObject.blob) {
        console.log(`Custom font not found: ${fontId}`)
        return false
      }
      
      // Create blob URL and CSS
      const blobUrl = URL.createObjectURL(fontObject.blob)
      const css = createFontFaceCSS(fontObject, blobUrl)
      
      // Create or update style element
      let styleElement = document.getElementById(`custom-font-${fontFamily.replace(/\s+/g, '-')}`)
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = `custom-font-${fontFamily.replace(/\s+/g, '-')}`
        document.head.appendChild(styleElement)
      }
      styleElement.textContent = css
      
      console.log(`Custom font loaded: ${fontFamily}`)
      return true
    } catch (error) {
      console.error(`Error loading custom font:`, error)
      return false
    }
  }

  return {
    // Core functionality
    downloadFontVariants,
    loadAndApplyStoredFonts,
    checkFontAvailability,
    
    // Custom font functionality
    uploadAndStoreCustomFont,
    getCustomFonts,
    loadCustomFont,
    
    // Utility functions
    loadStoredFont,
    createFontFaceCSS,
    generateFontId,
    getFormatFromFileName,
    
    // Management functions
    getStoredFontsMetadata,
    deleteStoredFont,
    
    // Low-level functions
    parseFontCSS,
    downloadAndStoreFont
  }
}
