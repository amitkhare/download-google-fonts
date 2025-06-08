import latinFonts from './latin.js';
import devanagariFonts from './devanagari.js';
import arabicFonts from './arabic.js';

export default [
  ...latinFonts,
  ...devanagariFonts,
  ...arabicFonts,
];

const GOOGLE_FONT_API_URL = 'https://fonts.googleapis.com/css2';

export const getCssDownloadURL = (fontName, variant) => {
  return `${GOOGLE_FONT_API_URL}?family=${fontName}:ital,wght@${variant}&display=swap`
}


export const fontCategories = [
  { title: 'All Categories', value: 'all' },
  { title: 'Serif', value: 'serif' },
  { title: 'Sans Serif', value: 'sans-serif' },
  { title: 'Display', value: 'display' },
  { title: 'Handwriting', value: 'handwriting' },
  { title: 'Monospace', value: 'monospace' }
]

export const fontSubsets = [
  { title: 'All Languages', value: 'all' },
  { title: 'Latin', value: 'latin' },
  { title: 'Latin Extended', value: 'latin-ext' },
  { title: 'Cyrillic', value: 'cyrillic' },
  { title: 'Cyrillic Extended', value: 'cyrillic-ext' },
  { title: 'Greek', value: 'greek' },
  { title: 'Greek Extended', value: 'greek-ext' },
  { title: 'Vietnamese', value: 'vietnamese' },
  { title: 'Arabic', value: 'arabic' },
  { title: 'Hebrew', value: 'hebrew' },
  { title: 'Thai', value: 'thai' },
  { title: 'Devanagari', value: 'devanagari' },
  { title: 'Chinese (Simplified)', value: 'chinese-simplified' },
  { title: 'Chinese (Traditional)', value: 'chinese-traditional' },
  { title: 'Japanese', value: 'japanese' },
  { title: 'Korean', value: 'korean' }
]