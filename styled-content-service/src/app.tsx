import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";

function App() {
	const [url, setUrl] = useState(
		"https://time.com/7295195/ai-chatgpt-google-learning-school/",
	);
	const [content, setContent] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [availableFonts, setAvailableFonts] = useState<string[]>([]);
	const [selectedHeadingFont, setSelectedHeadingFont] = useState<string>("");
	const [fontLoadingStatus, setFontLoadingStatus] = useState<
		Record<string, string>
	>({});

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
			const collectedFonts: string[] = [];

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

						collectedFonts.push(mapping.semanticName);
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

			// Add the original CSS rules with scoped selectors
			if (extractedCSS && extractedCSS.length > 0) {
				extractedCSS.forEach((rule: any, index: number) => {
					// Scope the selector to our article content
					const scopedSelector = rule.selector
						.split(",")
						.map((s: string) => {
							const trimmed = s.trim();
							// Don't add .article-content if the selector already includes it
							if (trimmed.startsWith(".article-content")) {
								return trimmed;
							}
							return `.article-content ${trimmed}`;
						})
						.join(", ");

					// Extract just the CSS properties from the processed cssText
					const match = rule.cssText.match(/\{([^}]*)\}/);
					if (match) {
						const properties = match[1].trim();
						styleRules += `${scopedSelector} { ${properties} }\n`;
					}
				});
			}

			// Add base styles that won't conflict with existing classes
			styleRules += `
				.article-content {
					font-family: ${fonts.primary};
					font-size: ${ensureMinFontSize(fonts.fontSize)};
					line-height: ${fonts.lineHeight};
				}
				
				.article-content p:not([class]) {
					font-size: ${ensureMinFontSize(paragraph.fontSize)};
					line-height: ${paragraph.lineHeight};
					color: ${paragraph.color};
					margin-bottom: ${paragraph.marginBottom};
					font-weight: ${paragraph.fontWeight};
				}
			`;

			// Only add fallback link styles if no CSS was extracted for links
			const hasLinkCSS = extractedCSS?.some(
				(rule: any) =>
					rule.selector.includes("a") || rule.selector.includes("link"),
			);

			if (link && !hasLinkCSS) {
				styleRules += `
					.article-content a:not([class]) {
						color: ${link.color};
						text-decoration: ${link.textDecoration};
						text-decoration-color: ${link.textDecorationColor};
						text-underline-offset: ${link.textUnderlineOffset};
					}
				`;
			}

			// Add heading styles only for elements without classes
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
				styleRules += `
					.article-content ${tag}:not([class]) {
						font-family: ${style.fontFamily};
						font-size: ${ensureMinFontSize(style.fontSize, minSizes[tag])};
						font-weight: ${style.fontWeight};
						line-height: ${style.lineHeight};
						color: ${style.color};
						margin-top: ${style.marginTop};
						margin-bottom: ${style.marginBottom};
					}
				`;
			});

			// Add blockquote styles if available
			if (blockquote) {
				styleRules += `
					.article-content blockquote:not([class]) {
						border-left: ${blockquote.borderLeftWidth} solid ${blockquote.borderLeftColor};
						padding-left: ${blockquote.paddingLeft};
						font-style: ${blockquote.fontStyle};
						color: ${blockquote.color};
					}
				`;
			}

			// Update available fonts for the debugging UI
			setAvailableFonts([...collectedFonts, "system-ui"]);
			// if (!selectedHeadingFont && collectedFonts.length > 0) {
			// 	setSelectedHeadingFont(collectedFonts[0]);
			// }

			// Check if fonts are actually loading
			const checkFontLoading = async () => {
				const status: Record<string, string> = {};

				for (const fontName of collectedFonts) {
					try {
						// Use document.fonts.load to test if font is available
						await document.fonts.load(`16px "${fontName}"`);

						// Check if font is actually different from fallback
						const canvas = document.createElement("canvas");
						const ctx = canvas.getContext("2d");
						if (ctx) {
							// Test text with target font
							ctx.font = `16px "${fontName}", monospace`;
							const targetWidth = ctx.measureText("M").width;

							// Test text with known fallback
							ctx.font = "16px monospace";
							const fallbackWidth = ctx.measureText("M").width;

							status[fontName] =
								targetWidth !== fallbackWidth ? "loaded" : "fallback";
						} else {
							status[fontName] = "unknown";
						}
					} catch (e) {
						status[fontName] = "failed";
					}
				}

				setFontLoadingStatus(status);
			};

			// Check font loading after a brief delay
			setTimeout(checkFontLoading, 1000);

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

	// Function to dynamically change heading fonts
	const swapHeadingFont = (fontFamily: string) => {
		setSelectedHeadingFont(fontFamily);

		// Create override style for headings
		const existingOverride = document.getElementById("font-override");
		if (existingOverride) {
			existingOverride.remove();
		}

		// Sanitize font family name to prevent CSS injection
		const sanitizedFontFamily = fontFamily.replace(/[^a-zA-Z0-9\s\-_]/g, "");

		const override = document.createElement("style");
		override.id = "font-override";
		override.textContent = `
			.article-content h1,
			.article-content h2,
			.article-content h3,
			.article-content h4,
			.article-content h5,
			.article-content h6,
			.article-content .font-editorial {
				font-family: "${sanitizedFontFamily}", system-ui, -apple-system, sans-serif !important;
			}
		`;
		document.head.appendChild(override);
	};

	useEffect(() => {
		processUrl();
	}, []);

	return (
		<div className="min-h-screen">
			{/* Font Debug Panel */}
			{availableFonts.length > 0 && (
				<div className="fixed top-3 right-3 flex items-center gap-1 bg-black/5 rounded px-2 py-1 text-xs z-50">
					<select
						value={selectedHeadingFont}
						onChange={(e) => swapHeadingFont(e.target.value)}
						className="bg-transparent border-0 text-xs outline-none cursor-pointer"
						style={{ fontSize: "11px" }}
					>
						{availableFonts.map((font) => {
							const status = fontLoadingStatus[font];
							const statusIcon =
								status === "loaded" ? "✓" : status === "fallback" ? "○" : "✗";
							return (
								<option key={font} value={font}>
									{statusIcon}{" "}
									{font.replace("Captured", "").replace("Font", "")}
								</option>
							);
						})}
					</select>
				</div>
			)}

			<div className="max-w-2xl mx-auto px-4 py-8">
				{/* Minimal Header */}
				<div className="mb-12">
					<h1 className="text-sm font-normal text-neutral-500 mb-6">
						reader mode
					</h1>

					<div className="flex gap-2">
						<input
							type="url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && processUrl()}
							placeholder="paste url here"
							className="flex-1 px-4 py-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 text-sm placeholder:text-neutral-400"
						/>
						<button
							onClick={processUrl}
							disabled={loading}
							className="px-6 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
						>
							{loading ? ".." : "→"}
						</button>
					</div>
				</div>

				{/* Content */}
				{content && (
					<article className="space-y-8">
						<header className="pb-8 border-b border-neutral-200">
							<h2 className="article-title">{content.title}</h2>
							<div className="flex items-center gap-2 text-sm text-neutral-600">
								{content.author && (
									<>
										<span className="font-medium">{content.author}</span>
										<span className="text-neutral-400">•</span>
									</>
								)}
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
