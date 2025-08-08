import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";

function App() {
	const [url, setUrl] = useState(
		// "https://time.com/7295195/ai-chatgpt-google-learning-school/",
		"https://dynamicland.org/2024/FAQ/"
	);
	const [content, setContent] = useState<any>(null);
	const [loading, setLoading] = useState(false);

	// Format date helper
	const formatDate = (dateString: string) => {
		if (!dateString) return "";
		try {
			const date = new Date(dateString);
			// Format as "JUN 17, 2025 3:40 PM ET"
			return date
				.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
					hour: "numeric",
					minute: "2-digit",
					hour12: true,
					timeZoneName: "short",
				})
				.toUpperCase();
		} catch (e) {
			return dateString; // Return original if parsing fails
		}
	};

	const processUrl = async () => {
		if (!url) return;

		setLoading(true);
		try {
			const res = await fetch("/api/extract", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url }),
			});
			const data = await res.json();
			console.log("Received data:", data);
			setContent(data);
		} catch (error) {
			console.error("Failed to process URL:", error);
		}
		setLoading(false);
	};

	// Apply custom styles from the source site
	useEffect(() => {
		if (content?.styles) {
			const { rootFontSize, fonts, paragraph, link, headings, blockquote } =
				content.styles;
			const {
				extractedCSS,
				fontRequests,
				globalFontSettings,
				cssVariables,
				cssFontMapping,
			} = content;

			// Set the root font size to match the source site
				document.documentElement.style.fontSize = rootFontSize;

			// Apply background color if available
			if (content.styles.backgroundColor) {
				document.body.style.backgroundColor = content.styles.backgroundColor;
			}

			// Create CSS variables and font rules dynamically
			let fontFaceRules = "";

			// Add extracted CSS variables to :root
			if (cssVariables && Object.keys(cssVariables).length > 0) {
				// console.log("Found CSS variables:", cssVariables);
				const variableDeclarations = Object.entries(cssVariables)
					.map(([name, value]) => `${name}: ${value};`)
					.join("\n\t\t\t\t");

				fontFaceRules += `
					:root {
						${variableDeclarations}
					}
				`;
			}

			console.log(
				"Loading fonts:",
				Object.keys(cssFontMapping || {}).filter((k) => k.startsWith("--"))
					.length,
			);

			// Create @font-face rules from the unified mapping (deduplicated)
			const processedFonts = new Set<string>();
			if (cssFontMapping && Object.keys(cssFontMapping).length > 0) {
				Object.entries(cssFontMapping).forEach(
					([cssClass, mapping]: [string, any]) => {
						// Skip if we've already processed this font
						if (processedFonts.has(mapping.semanticName)) {
							return;
						}
						processedFonts.add(mapping.semanticName);

						const proxiedFontUrl = `/api/font-proxy?url=${encodeURIComponent(mapping.url)}`;

						fontFaceRules += `
						@font-face {
							font-family: "${mapping.semanticName}";
							src: url("${proxiedFontUrl}");
							font-display: swap;
						}
					`;

						// No UI tracking of fonts in minimal mode
					},
				);
			}

			// Helper to ensure minimum font size while preserving rem units
			const ensureMinFontSize = (size: string, minRem: number = 1) => {
				if (size.includes("rem")) {
					const remValue = parseFloat(size);
					if (remValue && remValue < minRem) {
						return `${minRem}rem`;
					}
				}
				return size;
			};

			// Apply global font settings
			const globalFontRules = globalFontSettings
				? `
				.article-content,
				.article-content *,
				.article-content *::before,
				.article-content *::after {
					${globalFontSettings.fontFeatureSettings ? `font-feature-settings: ${globalFontSettings.fontFeatureSettings};` : ""}
					${globalFontSettings.fontKerning ? `font-kerning: ${globalFontSettings.fontKerning};` : ""}
					${globalFontSettings.webkitFontSmoothing ? `-webkit-font-smoothing: ${globalFontSettings.webkitFontSmoothing};` : ""}
					${globalFontSettings.mozOsxFontSmoothing ? `-moz-osx-font-smoothing: ${globalFontSettings.mozOsxFontSmoothing};` : ""}
					${globalFontSettings.textRendering ? `text-rendering: ${globalFontSettings.textRendering};` : ""}
				}
			`
				: "";

			// Start with extracted CSS rules from the source site
			let styleRules = `
				/* Font face rules */
				${fontFaceRules}
				
				/* Global font settings */
				${globalFontRules}
				
				/* Article title using extracted h2 styles */
				.article-title {
					${
						headings?.h2
							? `
						font-family: ${headings.h2.fontFamily};
						font-size: ${ensureMinFontSize(headings.h2.fontSize, 1.5)};
						font-weight: ${headings.h2.fontWeight};
						line-height: ${headings.h2.lineHeight};
						color: ${headings.h2.color};
						margin-bottom: 1rem;
					`
							: `
						font-size: 1.5rem;
						font-weight: 500;
						line-height: 1.2;
						margin-bottom: 1rem;
					`
					}
				}
				
				/* Prevent horizontal scrolling */
				.article-content {
					max-width: 100%;
					overflow-x: hidden;
					word-wrap: break-word;
					word-break: break-word;
				}
				
				.article-content * {
					max-width: 100%;
					box-sizing: border-box;
				}
				
				.article-content img {
					max-width: 100% !important;
					height: auto !important;
				}
			`;

			// STEP 1: Add the original CSS rules in their ORIGINAL ORDER
			// This preserves the cascade as intended by the source site
			if (extractedCSS && extractedCSS.length > 0) {
				console.log(`Applying ${extractedCSS.length} extracted CSS rules in original order`);
				
				// Apply rules in the order they were extracted (preserves cascade)
				extractedCSS.forEach((rule: any, index: number) => {
					// Scope the selector to our article content with increased specificity
					const scopedSelector = rule.selector
						.split(",")
						.map((s: string) => {
							const trimmed = s.trim();
							// Don't add .article-content if the selector already includes it
							if (trimmed.startsWith(".article-content")) {
								return trimmed;
							}
							// Add higher specificity for important elements
							if (trimmed === "a" || trimmed.startsWith("a:")) {
								return `.article-content ${trimmed}`;
							}
							if (trimmed === "li" || trimmed.startsWith("li") || trimmed.includes("li")) {
								return `.article-content ${trimmed}`;
							}
							if (trimmed.startsWith("h") && trimmed.match(/^h[1-6]/)) {
								return `.article-content ${trimmed}`;
							}
							return `.article-content ${trimmed}`;
						})
						.join(", ");

					// Extract just the CSS properties from the processed cssText
					const match = rule.cssText.match(/\{([^}]*)\}/);
					if (match) {
						const properties = match[1].trim();
						
						// Apply the extracted CSS rules as-is to preserve original styling
						styleRules += `${scopedSelector} { ${properties} }\n`;
					}
				});
			}

			// STEP 2: Add base styles as fallbacks only (without !important)
			styleRules += `
				/* Base styles - will be overridden by extracted CSS */
				.article-content {
					font-family: ${fonts.primary};
					font-size: ${ensureMinFontSize(fonts.fontSize)};
					line-height: ${fonts.lineHeight};
				}
				
				/* Paragraph fallbacks for elements without classes */
				.article-content p:not([class]):not([id]) {
					font-size: ${ensureMinFontSize(paragraph.fontSize)};
					line-height: ${paragraph.lineHeight};
					color: ${paragraph.color};
					margin-bottom: ${paragraph.marginBottom};
					font-weight: ${paragraph.fontWeight};
				}
			`;

			// Always add comprehensive link styles (with extracted styles taking priority)
			const hasLinkCSS = extractedCSS?.some(
				(rule: any) =>
					rule.selector.includes("a") || rule.selector.includes("link"),
			);

			// STEP 3: Add computed styles as ultra-weak fallbacks
			if (!hasLinkCSS && link) {
				console.log("No link CSS rules found, adding computed link styles as fallback");
				styleRules += `
					/* Link fallbacks - low specificity */
					.article-content a:where(:not([class]):not([id])) {
						color: ${link.color};
						text-decoration: ${link.textDecoration || 'none'};
						${link.textDecorationColor ? `text-decoration-color: ${link.textDecorationColor};` : ''}
						${link.textUnderlineOffset ? `text-underline-offset: ${link.textUnderlineOffset};` : ''}
						${link.fontWeight && link.fontWeight !== 'normal' ? `font-weight: ${link.fontWeight};` : ''}
						${link.fontSize ? `font-size: ${link.fontSize};` : ''}
						${link.fontFamily ? `font-family: ${link.fontFamily};` : ''}
					}
					
					${link.hoverColor ? `
					.article-content a:where(:not([class]):not([id])):hover {
						color: ${link.hoverColor};
						${link.hoverTextDecoration ? `text-decoration: ${link.hoverTextDecoration};` : ''}
					}
					` : ''}
				`;
			}

			// STEP 4: List element fallbacks
			styleRules += `
				/* List fallbacks */
				.article-content ul:where(:not([class]):not([id])), 
				.article-content ol:where(:not([class]):not([id])) {
					margin: 1em 0;
					padding-left: 2em;
				}
				
				.article-content li:where(:not([class]):not([id])) {
					color: ${paragraph.color};
					margin-bottom: 0.5em;
				}
				
				.article-content ul:where(:not([class])) li:where(:not([class])) {
					list-style-type: disc;
				}
				
				.article-content ol:where(:not([class])) li:where(:not([class])) {
					list-style-type: decimal;
				}
			`;

			// STEP 5: Heading fallbacks using computed styles
			Object.entries(headings).forEach(([tag, style]: [string, any]) => {
				// Ensure minimum sizes for headings too (in rem)
				const minSizes: Record<string, number> = {
					h1: 1.5, // 24px at 16px root
					h2: 1.25, // 20px at 16px root
					h3: 1.125, // 18px at 16px root
					h4: 1, // 16px at 16px root
					h5: 1,
					h6: 1,
				};
				// Use :where() for zero specificity fallbacks
				styleRules += `
					/* ${tag} fallbacks - zero specificity */
					.article-content ${tag}:where(:not([class]):not([id])) {
						font-family: ${style.fontFamily};
						font-size: ${ensureMinFontSize(style.fontSize, minSizes[tag])};
						font-weight: ${style.fontWeight};
						line-height: ${style.lineHeight};
						color: ${style.color};
						${style.backgroundColor ? `background-color: ${style.backgroundColor};` : ''}
						${style.padding ? `padding: ${style.padding};` : ''}
						${style.paddingTop ? `padding-top: ${style.paddingTop};` : ''}
						${style.paddingRight ? `padding-right: ${style.paddingRight};` : ''}
						${style.paddingBottom ? `padding-bottom: ${style.paddingBottom};` : ''}
						${style.paddingLeft ? `padding-left: ${style.paddingLeft};` : ''}
						${style.borderRadius ? `border-radius: ${style.borderRadius};` : ''}
						${style.border ? `border: ${style.border};` : ''}
						${style.textAlign && style.textAlign !== 'start' ? `text-align: ${style.textAlign};` : ''}
						margin-top: ${style.marginTop};
						margin-bottom: ${style.marginBottom};
					}
				`;
			});

			// STEP 6: Blockquote fallbacks
			if (blockquote) {
				styleRules += `
					/* Blockquote fallbacks */
					.article-content blockquote:where(:not([class]):not([id])) {
						border-left: ${blockquote.borderLeftWidth} solid ${blockquote.borderLeftColor};
						padding-left: ${blockquote.paddingLeft};
						font-style: ${blockquote.fontStyle};
						color: ${blockquote.color};
					}
				`;
			}

			// Minimal mode: omit font debug UI and loading checks

			// Add CSS sanitization
			const sanitizeCSS = (css: string): string => {
				// Remove dangerous CSS functions
				return css
					.replace(/javascript:/gi, "")
					.replace(/expression\(/gi, "")
					.replace(/behavior:/gi, "")
					.replace(/binding:/gi, "")
					.replace(/@import/gi, "");
			};

			const style = document.createElement("style");
			style.textContent = sanitizeCSS(styleRules);
			document.head.appendChild(style);

			return () => {
				document.head.removeChild(style);
				// Reset root font size when component unmounts
				document.documentElement.style.fontSize = "";
				// Reset background color
				document.body.style.backgroundColor = "";
			};
		}
	}, [content]);

	// Minimal UI: remove heading font override feature

	useEffect(() => {
		processUrl();
	}, []);

	return (
		<div className="min-h-screen">
			{/* Compact floating controls to maximize content space */}
			<div className="fixed top-3 right-3 z-50 flex items-center gap-1 bg-white/80 backdrop-blur px-2 py-1 rounded border border-neutral-200 shadow-sm">
				<input
					type="url"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && processUrl()}
					placeholder="paste url"
					className="w-56 px-2 py-1 bg-transparent outline-none text-xs placeholder:text-neutral-400"
				/>
				<button
					onClick={processUrl}
					disabled={loading}
					className="px-2 py-1 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50"
				>
					{loading ? ".." : "Go"}
				</button>
			</div>

			<div className="max-w-2xl mx-auto px-4 py-8">
				{/* Content */}
				{content && (
					<article className="space-y-6">
						<header className="mb-2">
						{content.publishedTime && (
							<div className="text-[10px] text-neutral-500 uppercase tracking-tight mb-1">
								{formatDate(content.publishedTime)}
							</div>
						)}
							<h2 className="article-title">{content.title}</h2>
							<div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
								<a
									href={content.url}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-neutral-900 transition-colors"
								>
									{content.domain}
								</a>
							</div>
						</header>

						{/* Hero image if available */}
						{content.image && (
							<figure className="my-8">
								<img
									src={content.image}
									alt={content.title}
									className="w-full rounded-lg"
								/>
							</figure>
						)}

						<div
							className="article-content"
							dangerouslySetInnerHTML={{ __html: content.html }}
						/>

						{/* Additional images section if there are multiple images */}
						{content.images && content.images.length > 1 && (
							<div className="mt-16 pt-8 border-t border-neutral-100">
								<div className="mb-6">
									<span className="text-xs uppercase tracking-wider text-neutral-400">
										Images
									</span>
								</div>
								<div className="grid grid-cols-3 gap-3">
									{content.images.slice(0, 6).map((img: any, idx: number) => (
										<figure key={idx} className="group cursor-pointer">
											<div className="aspect-square overflow-hidden rounded bg-neutral-100">
												<img
													src={img.src}
													alt={img.alt || `Image ${idx + 1}`}
													className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
													loading="lazy"
												/>
											</div>
											{img.caption && (
												<figcaption className="mt-2 text-xs text-neutral-500 line-clamp-2">
													{img.caption}
												</figcaption>
											)}
										</figure>
									))}
								</div>
								{content.images.length > 6 && (
									<p className="mt-4 text-xs text-neutral-400">
										+{content.images.length - 6} more images
									</p>
								)}
							</div>
						)}
					</article>
				)}
			</div>
		</div>
	);
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
