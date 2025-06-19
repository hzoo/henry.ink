# Styled Content Service

## Purpose
This service extracts article content from websites while preserving their original visual styling and personality. Unlike traditional article extraction that converts content to markdown, this service maintains the site's visual identity by capturing and replicating the original HTML, CSS, fonts, and styling.

## Key Goals
- Extract clean article content without ads or navigation elements
- Preserve the source site's visual styling (fonts, colors, spacing, typography)
- Maintain link styling and decorations from the original site
- Extract and display images with proper sizing and captions
- Remove JavaScript dependencies while keeping visual fidelity
- Render content that feels like reading the original site

## Architecture

### Backend (`src/processor.ts`)
- Uses Playwright headless browser to load and render pages
- Extracts main article content using semantic selectors
- Removes advertisement elements and unwanted content
- Captures comprehensive CSS styles from the source site:
  - Font families, sizes, and weights
  - Colors and text decorations
  - Margins, padding, and spacing
  - Link styling (color, underlines, hover states)
  - Heading hierarchy and styling
- Extracts CSS rules that apply to content classes
- Converts pixel values to rem units for responsive scaling
- Captures font URLs for loading custom fonts
- Ensures full URLs for links and images

### Frontend (`src/app.tsx`)
- Applies extracted styles dynamically to preserve source site appearance
- Loads custom fonts from the source site
- Uses CSS scoping to prevent style conflicts
- Implements fallback styles only for elements without existing classes
- Displays content with original typography and visual hierarchy
- Shows image gallery for articles with multiple images

## Key Features

### Content Extraction
- Finds main article content using multiple selectors
- Removes ads, navigation, and promotional content
- Preserves semantic HTML structure and classes
- Maintains link URLs with proper absolute paths

### Style Preservation
- Extracts CSS rules from source site stylesheets
- Captures computed styles for paragraphs, links, and headings
- Preserves original font loading and typography
- Maintains color schemes and visual hierarchy
- Converts measurements to responsive units

### Image Handling
- Extracts all article images with full URLs
- Captures image captions and alt text
- Creates responsive image gallery for multi-image articles
- Handles lazy-loaded images

### Font Loading
- Extracts font URLs from CSS @font-face rules
- Loads Google Fonts and other web fonts
- Maintains typography consistency with source site

## Technical Details

### Style Extraction Process
1. Scan HTML for all CSS classes used in content
2. Extract CSS rules from stylesheets that apply to these classes
3. Capture computed styles for key elements (p, a, h1-h6)
4. Convert pixel measurements to rem units
5. Apply styles with proper scoping to avoid conflicts

### CSS Scoping Strategy
- All extracted styles are scoped to `.article-content` container
- Original CSS rules are preserved with scoped selectors
- Fallback styles only apply to elements without existing classes
- Uses `all: revert` to reset any interference from host site styles

### Performance Considerations
- Headless browser with short timeout for fast extraction
- CSS extraction limited to relevant rules only
- Font loading only for recognized font services
- Image lazy loading for gallery display

## Development Commands

```bash
# Start development server
bun run dev

# Build for production
bun run build

# Run tests
bun test
```

## API Endpoints

### POST `/api/extract`
Extracts and processes article content from a URL.

**Request:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "html": "cleaned article HTML",
  "title": "Article Title",
  "author": "Author Name",
  "domain": "example.com",
  "image": "hero image URL",
  "images": [{"src": "url", "alt": "text", "caption": "text"}],
  "styles": {
    "fonts": {"primary": "font-family", "fontSize": "1rem"},
    "paragraph": {"fontSize": "1rem", "lineHeight": "1.5"},
    "link": {"color": "blue", "textDecoration": "underline"},
    "headings": {"h1": {"fontSize": "2rem", "color": "black"}}
  },
  "extractedCSS": [{"selector": ".class", "cssText": "rule"}],
  "fontUrls": ["font URLs"],
  "url": "source URL"
}
```

## Troubleshooting

### Common Issues

**Fonts not loading properly:**
- Check console for font URLs being extracted
- Verify font loading in Network tab
- Ensure cross-origin font access

**Links not styled correctly:**
- Check if CSS rules for links are being extracted
- Look for "Found link rule" messages in console
- Verify content classes are being detected

**Content looks different from source:**
- Check if enough CSS rules are being extracted
- Verify root font size is being applied
- Look for style conflicts with host site CSS

**Small font sizes:**
- Check if rem conversion is working properly
- Verify root font size capture from source site
- Ensure minimum font size enforcement

### Debugging Tips
- Check browser console for detailed extraction logs
- Look for "Style sampling" and "Link styles" debug output
- Verify "Total extracted CSS rules" count
- Use browser dev tools to inspect applied styles

## Future Improvements
- Support for more complex CSS selectors and pseudo-elements
- Better handling of custom CSS properties and variables
- Improved font fallback mechanisms
- Support for responsive design breakpoints
- Enhanced image optimization and loading