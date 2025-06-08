# Google Fonts Downloader

A Node.js tool to download Google Fonts and organize them by language/script with automatic categorization and metadata generation.

## Features

- 🌍 **Language Categorization**: Automatically organizes fonts by script (Latin, Devanagari, Arabic, etc.)
- 📁 **Structured Storage**: Creates organized directory structure by language and font family
- 📊 **Detailed Metadata**: Generates comprehensive metadata with language statistics
- ⚡ **Batch Processing**: Downloads multiple font variants efficiently with rate limiting
- 🔄 **Skip/Overwrite Modes**: Control file handling behavior
- 📈 **Progress Tracking**: Real-time progress updates during download

## Directory Structure

After running the downloader, fonts are organized as follows:

```
fonts/
├── metadata.json          # Comprehensive metadata with language stats
├── latin/                 # Latin script fonts
│   ├── open-sans/
│   │   ├── Open-Sans-400-normal.ttf
│   │   └── Open-Sans-400-italic.ttf
│   └── roboto/
│       └── ...
├── devanagari/           # Devanagari script fonts
│   ├── poppins/
│   └── noto-sans-devanagari/
└── arabic/               # Arabic script fonts
    ├── cairo/
    └── noto-sans-arabic/
```

## Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

## Usage

### Basic Usage

Download all fonts (first 10 for testing):
```bash
node download-fonts.js
```

Download all fonts:
```bash
# Edit download-fonts.js and change line 319:
# const fontsToDownload = GoogleFonts // Use this to download all
node download-fonts.js
```

### Command Line Options

- `--skip` or `-s`: Skip existing files (don't re-download)
- `--overwrite` or `-o`: Overwrite existing files

```bash
# Skip existing files
node download-fonts.js --skip

# Overwrite existing files
node download-fonts.js --overwrite
```

## Configuration

### Font Collections

The tool includes pre-configured font collections:

- **`latin.js`**: Latin and Latin-Extended fonts
- **`devanagari.js`**: Devanagari script fonts (Hindi, Marathi, etc.)
- **`arabic.js`**: Arabic script fonts

### Download Settings

Configure in `download-fonts.js`:

```javascript
const BATCH_SIZE = 3              // Fonts processed simultaneously
const DELAY_BETWEEN_BATCHES = 500 // Delay in milliseconds
```

## Metadata Output

The generated `metadata.json` includes:

```json
{
  "generatedAt": "2025-06-08T11:59:22.899Z",
  "totalFonts": 66,
  "skippedFonts": 0,
  "languages": {
    "latin": {
      "totalFonts": 2,
      "fonts": {
        "Open Sans": {
          "variants": [
            {
              "weight": "400",
              "style": "normal",
              "format": "ttf",
              "filename": "Open-Sans-400-normal.ttf",
              "size": 122116
            }
          ]
        }
      }
    }
  },
  "languageStats": {
    "latin": {
      "fontFamilies": 2,
      "totalVariants": 22
    },
    "devanagari": {
      "fontFamilies": 2,
      "totalVariants": 27
    },
    "arabic": {
      "fontFamilies": 2,
      "totalVariants": 17
    }
  }
}
```

## Font Data Format

Each font in the collection includes:

```javascript
{
  family: 'Font Name',
  category: 'sans-serif',      // Font category
  variants: ['0,400', '1,400'], // Weight and style combinations
  subsets: ['latin', 'latin-ext'] // Supported scripts/languages
}
```

### Variant Format

Variants are encoded as `italic,weight`:
- `0,400`: Normal weight 400
- `1,400`: Italic weight 400
- `0,700`: Bold weight 700
- `1,700`: Bold italic weight 700

## Language Detection

The tool automatically categorizes fonts by their primary language:

1. **Primary Language**: Determined by the first value in the font's `subsets` array
2. **Directory Structure**: Fonts are saved in language-specific directories
3. **Metadata Grouping**: Statistics and font lists are grouped by language

## File Formats

- **Download Format**: TTF (TrueType Font) files
- **Naming Convention**: `FontName-Weight-Style.ttf`
- **Examples**: 
  - `Open-Sans-400-normal.ttf`
  - `Roboto-700-italic.ttf`

## Error Handling

The tool includes comprehensive error handling:

- **Network Errors**: Retries and continues with other fonts
- **File System Errors**: Creates directories as needed
- **Invalid Fonts**: Skips problematic fonts and continues
- **Rate Limiting**: Respects Google's API limits with delays

## Performance Considerations

- **Batch Processing**: Downloads multiple fonts simultaneously
- **Rate Limiting**: Includes delays to respect server limits
- **Memory Efficient**: Streams font files directly to disk
- **Progress Tracking**: Shows real-time download progress

## Adding New Fonts

To add new fonts, edit the appropriate language file (`latin.js`, `devanagari.js`, `arabic.js`):

```javascript
{
  family: 'New Font Name',
  category: 'sans-serif',
  variants: ['0,400', '1,400', '0,700', '1,700'],
  subsets: ['latin', 'latin-ext']
}
```

## Troubleshooting

### Common Issues

1. **Network Timeouts**: Increase delays between requests
2. **Missing Fonts**: Check if font name matches Google Fonts exactly
3. **Permission Errors**: Ensure write permissions in the output directory
4. **Memory Issues**: Reduce `BATCH_SIZE` for limited memory systems

### Debugging

Enable verbose logging by adding console.log statements in the download functions or check the generated metadata.json for detailed information about processed fonts.

## Contributing

1. Fork the repository
2. Add new font collections or improve existing functionality
3. Test with your changes
4. Submit a pull request

## License

This project is open source. Check the license file for details.

## Acknowledgments

- Google Fonts API for providing the font files
- Community contributors for font collections and improvements
