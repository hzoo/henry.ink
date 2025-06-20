import { chromium } from "playwright";
import { getConfigForDomain, type ExtractionConfig } from "./config";
import DOMPurify from "isomorphic-dompurify";

export async function extractContent(
	url: string,
	customConfig?: Partial<ExtractionConfig>,
) {
	console.log("Extracting content from:", url);

	// Get configuration for this domain
	const urlObj = new URL(url);
	const domain = urlObj.hostname.replace(/^www\./, "");
	const config = customConfig
		? { ...getConfigForDomain(domain), ...customConfig }
		: getConfigForDomain(domain);

	// console.log("Using config for domain:", domain, config);

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();

	// Listen for console messages from the page
	page.on("console", (msg) => {
		console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
	});

	// Capture font requests
	const fontRequests: Array<{ url: string; family?: string }> = [];

	page.on("response", async (response) => {
		const responseUrl = response.url();
		const contentType = response.headers()["content-type"] || "";

		// Check if this is a font file
		if (
			contentType.includes("font/") ||
			responseUrl.includes(".woff") ||
			responseUrl.includes(".woff2") ||
			responseUrl.includes(".ttf") ||
			responseUrl.includes(".otf")
		) {
			// console.log("Font request captured:", responseUrl);
			fontRequests.push({ url: responseUrl });
		}
	});

	try {
		// don't use waitUntil: 'networkidle' as it can cause issues with dynamic content
		await page.goto(url, {
			waitUntil: "domcontentloaded",
			timeout: config.timeout,
		});
		console.log("Page loaded successfully");

		// Wait for fonts and dynamic content to load
		await page.waitForTimeout(config.waitTime);

		const result = await page.evaluate((extractionConfig) => {
			console.log("Starting content extraction...");

			try {
				// Find main content using configured selectors
				let article: Element | null = null;
				for (const selector of extractionConfig.contentSelectors) {
					article = document.querySelector(selector);
					if (article) {
						console.log(
							"Found article element with selector:",
							selector,
							article.tagName,
							article.className,
						);
						break;
					}
				}

				// Fallback to body if no specific content area found
				if (!article) {
					article = document.body;
					console.log("Fallback to body element");
				}

				// Clone the article to avoid modifying the original
				const cleanedArticle = article.cloneNode(true) as HTMLElement;

				// Remove advertisement elements using configured selectors
				extractionConfig.adSelectors.forEach((selector) => {
					cleanedArticle.querySelectorAll(selector).forEach((el) => {
						// console.log(
						// 	"Removing ad element:",
						// 	selector,
						// 	el.tagName,
						// 	el.className,
						// );
						el.remove();
					});
				});

				// Remove unwanted elements using configured selectors
				extractionConfig.unwantedSelectors.forEach((selector) => {
					cleanedArticle.querySelectorAll(selector).forEach((el) => {
						// console.log(
						// 	"Removing unwanted element:",
						// 	selector,
						// 	el.tagName,
						// 	el.className,
						// );
						el.remove();
					});
				});

				// Remove text nodes matching unwanted patterns
				const walker = document.createTreeWalker(
					cleanedArticle,
					NodeFilter.SHOW_TEXT,
					{
						acceptNode: (node) => {
							const text = node.textContent?.trim();
							if (
								text &&
								extractionConfig.unwantedTextPatterns.some((pattern) =>
									pattern.test(text),
								)
							) {
								return NodeFilter.FILTER_ACCEPT;
							}
							return NodeFilter.FILTER_SKIP;
						},
					},
				);

				const nodesToRemove: Node[] = [];
				while (walker.nextNode()) {
					nodesToRemove.push(walker.currentNode);
				}
				nodesToRemove.forEach((node) => {
					console.log("Removing unwanted text node:", node.textContent);
					node.parentNode?.removeChild(node);
				});

				// Preserve links - ensure they have proper href attributes and capture their styles
				const linkClasses = new Set<string>();
				cleanedArticle.querySelectorAll("a").forEach((link) => {
					if (link.href && !link.href.startsWith("http")) {
						link.href = new URL(
							link.getAttribute("href") || "",
							location.href,
						).href;
					}
					// Collect unique class names from links
					if (link.className) {
						link.className.split(" ").forEach((cls) => {
							if (cls.trim()) linkClasses.add(cls.trim());
						});
					}
				});

				// Extract CSS rules for link classes and other common content classes
				const extractedCSS = [];
				const contentClasses = new Set<string>();

				// Collect all classes used in the content
				cleanedArticle.querySelectorAll("*").forEach((el) => {
					if (el.className && typeof el.className === "string") {
						el.className.split(" ").forEach((cls) => {
							if (cls.trim()) contentClasses.add(cls.trim());
						});
					}
				});

				// Extract font information from CSS @font-face rules first
				const fontFaces: Array<{
					family: string;
					src: string;
					weight?: string;
					style?: string;
				}> = [];
				const fontUrls = new Set<string>();

				try {
					for (const sheet of document.styleSheets) {
						try {
							const rules = sheet.cssRules || sheet.rules;
							for (const rule of rules) {
								if (rule.type === CSSRule.FONT_FACE_RULE) {
									const fontRule = rule as CSSFontFaceRule;
									const cssText = fontRule.cssText;

									// Extract font-family name
									const familyMatch = cssText.match(
										/font-family:\s*['"]([^'"]+)['"]|font-family:\s*([^;,]+)/,
									);
									const fontFamily = familyMatch
										? (familyMatch[1] || familyMatch[2]).trim()
										: "";

									// Extract font URLs
									const srcMatches = cssText.match(/src:\s*([^;]+)/);
									if (srcMatches) {
										const srcValue = srcMatches[1];
										const urlMatches = srcValue.match(
											/url\(['"]?([^'")]+)['"]?\)/g,
										);

										if (urlMatches && fontFamily) {
											urlMatches.forEach((urlMatch) => {
												const urlExtract = urlMatch.match(
													/url\(['"]?([^'")]+)['"]?\)/,
												);
												if (urlExtract) {
													const fontUrl = urlExtract[1];
													const fullUrl = fontUrl.startsWith("http")
														? fontUrl
														: new URL(fontUrl, location.href).href;

													fontUrls.add(fullUrl);

													// Extract weight and style
													const weightMatch = cssText.match(
														/font-weight:\s*([^;]+)/,
													);
													const styleMatch = cssText.match(
														/font-style:\s*([^;]+)/,
													);

													fontFaces.push({
														family: fontFamily,
														src: fullUrl,
														weight: weightMatch
															? weightMatch[1].trim()
															: undefined,
														style: styleMatch
															? styleMatch[1].trim()
															: undefined,
													});
												}
											});
										}
									}
								}
							}
						} catch (e) {
							// Skip cross-origin stylesheets
						}
					}
				} catch (e) {
					console.log("Could not extract font information:", e);
				}

				console.log("Extracted font faces:", fontFaces.length);

				// Create unified font mapping from CSS classes to semantic names
				const cssFontMapping: Record<
					string,
					{ semanticName: string; url: string }
				> = {};

				// Extract global font settings, CSS variables, and CSS rules
				const globalFontSettings: any = {};
				const cssVariables: Record<string, string> = {};

				// Collect all style rules first, then process them in order
				const allStyleRules: Array<{ selector: string; styleRule: CSSStyleRule }> = [];
				
				try {
					for (const sheet of document.styleSheets) {
						try {
							const rules = sheet.cssRules || sheet.rules;
							for (const rule of rules) {
								if (rule.type === CSSRule.STYLE_RULE) {
									const styleRule = rule as CSSStyleRule;
									allStyleRules.push({ selector: styleRule.selectorText, styleRule });
								}
							}
						} catch (e) {
							// Skip cross-origin stylesheets
						}
					}
				} catch (e) {
					console.log("Could not collect CSS rules:", e);
				}

				// Process rules in order: first extract mappings and global settings
				for (const { selector, styleRule } of allStyleRules) {
					// Check for universal selector patterns more flexibly
					const isUniversalSelector =
						selector === "*" ||
						selector.includes("*,:after,:before") ||
						selector.includes("*,*::before,*::after") ||
						selector.includes("*, :after, :before") ||
						selector.includes("*, *::before, *::after") ||
						selector.includes("*, ::after, ::before") ||
						selector === ":root" ||
						selector === "html" ||
						selector === "body";

					// Capture global font settings from universal selectors and :root
					if (isUniversalSelector) {
						const style = styleRule.style;

						const fontFeatureSettings = style.getPropertyValue("font-feature-settings");
						const fontKerning = style.getPropertyValue("font-kerning");
						const webkitFontSmoothing = style.getPropertyValue("-webkit-font-smoothing");
						const mozOsxFontSmoothing = style.getPropertyValue("-moz-osx-font-smoothing");
						const textRendering = style.getPropertyValue("text-rendering");

						if (fontFeatureSettings)
							globalFontSettings.fontFeatureSettings = fontFeatureSettings;
						if (fontKerning)
							globalFontSettings.fontKerning = fontKerning;
						if (webkitFontSmoothing)
							globalFontSettings.webkitFontSmoothing = webkitFontSmoothing;
						if (mozOsxFontSmoothing)
							globalFontSettings.mozOsxFontSmoothing = mozOsxFontSmoothing;
						if (textRendering)
							globalFontSettings.textRendering = textRendering;

						// Extract CSS custom properties (CSS variables)
						for (let i = 0; i < style.length; i++) {
							const propertyName = style.item(i);
							if (propertyName.startsWith("--")) {
								cssVariables[propertyName] = style.getPropertyValue(propertyName);
							}
						}
					}

					// Extract CSS variable font mappings (like .__variable_04d5ae)
					if (selector.includes("__variable_")) {
						const style = styleRule.style;
						for (let i = 0; i < style.length; i++) {
							const propertyName = style.item(i);
							if (propertyName.startsWith("--font-")) {
								const cssVarValue = style.getPropertyValue(propertyName);
								// Extract the first font family from the CSS variable value
								const firstFontFamily = cssVarValue.split(",")[0].replace(/['"]/g, "").trim();

								// Find matching @font-face rule
								const matchingFontFace = fontFaces.find((ff) => ff.family === firstFontFamily);

								if (matchingFontFace) {
									// Create semantic font name based on CSS variable name
									const baseName = propertyName.replace("--font-", "");
									// Convert kebab-case to PascalCase (e.g., "graphik-compact" -> "GraphikCompact")
									const pascalCaseName = baseName.split('-').map(part => 
										part.charAt(0).toUpperCase() + part.slice(1)
									).join('');
									const semanticName = `Captured${pascalCaseName}Font`;

									// Map CSS class to semantic name and URL
									const cssClass = selector.replace(/^\.|:.*$/g, ""); // Remove leading dot and pseudo-selectors
									cssFontMapping[cssClass] = {
										semanticName,
										url: matchingFontFace.src,
									};

									// Also map the CSS variable name for lookup during replacement
									cssFontMapping[propertyName] = {
										semanticName,
										url: matchingFontFace.src,
									};

									console.log(`✅ Font: ${propertyName} -> ${semanticName}`);
								}
							}
						}
					}
				}


				// Now process content CSS rules with completed font mappings
				for (const { selector, styleRule } of allStyleRules) {
					// Check if this rule applies to our content classes or common elements
					const appliesToContent =
						Array.from(contentClasses).some(
							(cls) =>
								selector.includes(`.${cls}`) ||
								selector.includes(`[class*="${cls}"]`),
						) ||
						// Also capture rules for common HTML elements within content classes
						Array.from(contentClasses).some(
							(cls) =>
								selector.includes(`.${cls} a`) ||
								selector.includes(`.${cls} p`) ||
								selector.includes(`.${cls} h1`) ||
								selector.includes(`.${cls} h2`) ||
								selector.includes(`.${cls} h3`) ||
								selector.includes(`.${cls} h4`) ||
								selector.includes(`.${cls} h5`) ||
								selector.includes(`.${cls} h6`) ||
								selector.includes(`.${cls} span`) ||
								selector.includes(`.${cls} div`) ||
								selector.includes(`.${cls} strong`) ||
								selector.includes(`.${cls} em`),
						);


					if (appliesToContent) {
						// Use the unified font mapping to replace font-family references
						let processedCssText = styleRule.cssText;
						let wasModified = false;

						// Replace font-family declarations with semantic font names
						processedCssText = processedCssText.replace(
											/font-family:\s*([^;]+);?/g,
											(fontMatch, fontValue) => {
												// If it contains var() or generated identifiers, try to resolve and replace
												if (
													fontValue.includes("var(") ||
													fontValue.includes("__")
												) {
													// Try to resolve CSS variables first
													if (fontValue.includes("var(")) {
														const varMatch = fontValue.match(/var\(([^)]+)\)/);
														if (varMatch) {
															const varName = varMatch[1];

															// Check if we have a direct mapping for this CSS variable
															const directMapping = cssFontMapping[varName];
															if (directMapping) {
																console.log(`✅ Replacing: ${selector} -> ${directMapping.semanticName}`);
																wasModified = true;
																const fallbackStack =
																	'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
																return `font-family: "${directMapping.semanticName}", ${fallbackStack};`;
															}

															// Fallback: try to resolve through cssVariables
															const cssVarValue = cssVariables[varName];
															if (cssVarValue) {
																// Extract the first font family from the CSS variable value
																const firstFontFamily = cssVarValue
																	.split(",")[0]
																	.replace(/['"]/g, "")
																	.trim();

																// Find matching font face and mapping
																const matchingFontFace = fontFaces.find(
																	(ff) => ff.family === firstFontFamily,
																);
																if (matchingFontFace) {
																	// Find the CSS class that maps to this font
																	const mappingEntry = Object.entries(
																		cssFontMapping,
																	).find(
																		([_, mapping]: [string, any]) =>
																			mapping.url === matchingFontFace.src,
																	);

																	if (mappingEntry) {
																		const [_, mapping] = mappingEntry;
																		wasModified = true;
																		const fallbackStack =
																			'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
																		return `font-family: "${mapping.semanticName}", ${fallbackStack};`;
																	}
																}
															}
														}
													}

													// Handle direct __ identifiers in font-family
													if (fontValue.includes("__")) {
														// Try to find a mapping by matching the identifier
														const matchingEntry = Object.entries(
															cssFontMapping,
														).find(([_, mapping]: [string, any]) => {
															const fontFace = fontFaces.find(
																(ff) => ff.src === mapping.url,
															);
															return (
																fontFace && fontValue.includes(fontFace.family)
															);
														});

														if (matchingEntry) {
															const [_, mapping] = matchingEntry;
															wasModified = true;
															const fallbackStack =
																'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
															return `font-family: "${mapping.semanticName}", ${fallbackStack};`;
														}
													}
												}
												return fontMatch;
											},
										);


										extractedCSS.push({
											selector: selector,
											cssText: processedCssText,
											originalCssText: styleRule.cssText,
										});

					}
				}


				// Extract images and ensure full URLs
				const images: Array<{ src: string; alt: string; caption?: string }> =
					[];
				cleanedArticle.querySelectorAll("img").forEach((img) => {
					const src =
						img.src ||
						img.getAttribute("data-src") ||
						img.getAttribute("data-lazy-src") ||
						"";
					if (src) {
						const fullSrc = src.startsWith("http")
							? src
							: new URL(src, location.href).href;
						img.src = fullSrc;

						// Look for captions
						const figcaption = img
							.closest("figure")
							?.querySelector("figcaption");
						images.push({
							src: fullSrc,
							alt: img.alt || "",
							caption: figcaption?.textContent?.trim(),
						});
					}
				});

				// Get comprehensive style information from the site
				const computedStyle = window.getComputedStyle(article);
				const bodyStyle = window.getComputedStyle(document.body);
				const rootStyle = window.getComputedStyle(document.documentElement);

				// Get root font size for rem calculations
				const rootFontSize = parseFloat(rootStyle.fontSize) || 16;

				// Helper to find the effective background color
				const getEffectiveBackgroundColor = (element: Element): string => {
					let currentElement: Element | null = element;
					
					while (currentElement) {
						const style = window.getComputedStyle(currentElement);
						const bgColor = style.backgroundColor;
						
						// Check if this element has a non-transparent background
						if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
							return bgColor;
						}
						
						currentElement = currentElement.parentElement;
					}
					
					// Default to white if no background found
					return 'rgb(255, 255, 255)';
				};

				// Get the effective background color
				const backgroundColor = getEffectiveBackgroundColor(article);

				// Get paragraph styles - try to find a paragraph with rich content
				const paragraphs = article.querySelectorAll("p");
				let bestParagraph = null;
				let maxLength = 0;

				// Find the paragraph with the most text content for better style sampling
				paragraphs.forEach((p) => {
					if (p.textContent && p.textContent.length > maxLength) {
						maxLength = p.textContent.length;
						bestParagraph = p;
					}
				});

				const paragraph = bestParagraph || paragraphs[0];
				const paragraphStyle = paragraph
					? window.getComputedStyle(paragraph)
					: computedStyle;

				// Helper to convert px to rem
				const pxToRem = (pxValue: string) => {
					const px = parseFloat(pxValue);
					if (px) {
						return `${(px / rootFontSize).toFixed(3)}rem`;
					}
					return pxValue;
				};


				// Get link styles - try to find a link that's visible and has content
				const links = article.querySelectorAll("a");
				let bestLink = null;
				for (const link of links) {
					if (link.textContent && link.textContent.trim().length > 0) {
						bestLink = link;
						break;
					}
				}
				const linkStyle = bestLink ? window.getComputedStyle(bestLink) : null;


				// Helper function to transform font families
				const transformFontFamily = (fontFamily: string): string => {
					// Check if font family contains generated identifiers
					if (fontFamily.includes("__")) {
						// Try to find a matching font face and map to semantic name
						for (const fontFace of fontFaces) {
							if (fontFamily.includes(fontFace.family)) {
								// Find the mapping for this font URL
								const mappingEntry = Object.entries(cssFontMapping).find(([_, mapping]: [string, any]) => 
									mapping.url === fontFace.src
								);
								if (mappingEntry) {
									const [_, mapping] = mappingEntry;
									// Replace the generated identifier with semantic name
									return fontFamily.replace(fontFace.family, `"${mapping.semanticName}"`);
								}
							}
						}
					}
					return fontFamily;
				};

				// Get heading styles for different levels
				const headingStyles: any = {};
				["h1", "h2", "h3", "h4", "h5", "h6"].forEach((tag) => {
					const heading = article.querySelector(tag);
					if (heading) {
						const style = window.getComputedStyle(heading);
						headingStyles[tag] = {
							fontFamily: transformFontFamily(style.fontFamily),
							fontSize: pxToRem(style.fontSize),
							fontWeight: style.fontWeight,
							lineHeight: style.lineHeight,
							color: style.color,
							marginTop: pxToRem(style.marginTop),
							marginBottom: pxToRem(style.marginBottom),
						};
					}
				});

				const styles = {
					// Root font size context
					rootFontSize: `${rootFontSize}px`,
					// Background color
					backgroundColor,
					// Base font styles
					fonts: {
						primary:
							paragraphStyle.fontFamily ||
							computedStyle.fontFamily ||
							bodyStyle.fontFamily,
						headingFont:
							headingStyles.h1?.fontFamily ||
							headingStyles.h2?.fontFamily ||
							computedStyle.fontFamily,
						fontSize: pxToRem(
							paragraphStyle.fontSize || computedStyle.fontSize,
						),
						lineHeight: paragraphStyle.lineHeight || computedStyle.lineHeight,
						color: paragraphStyle.color || computedStyle.color,
					},
					// Paragraph specific styles
					paragraph: {
						fontSize: pxToRem(paragraphStyle.fontSize),
						lineHeight:
							paragraphStyle.lineHeight === "normal"
								? "1.5"
								: paragraphStyle.lineHeight,
						color: paragraphStyle.color,
						marginBottom: pxToRem(paragraphStyle.marginBottom),
						fontWeight: paragraphStyle.fontWeight,
					},
					// Link styles
					link: linkStyle
						? {
								color: linkStyle.color,
								textDecoration: linkStyle.textDecoration,
								textDecorationColor: linkStyle.textDecorationColor,
								textUnderlineOffset: linkStyle.textUnderlineOffset,
								fontWeight: linkStyle.fontWeight,
							}
						: null,
					// Heading styles
					headings: headingStyles,
					// Additional styles
					blockquote: (() => {
						const blockquote = article.querySelector("blockquote");
						if (blockquote) {
							const style = window.getComputedStyle(blockquote);
							return {
								borderLeftColor: style.borderLeftColor,
								borderLeftWidth: style.borderLeftWidth,
								paddingLeft: pxToRem(style.paddingLeft),
								fontStyle: style.fontStyle,
								color: style.color,
							};
						}
						return null;
					})(),
				};

				// Get metadata
				const getMeta = (name: string) =>
					document
						.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
						?.getAttribute("content") || "";

				const extractedData = {
					html: cleanedArticle.innerHTML,
					title: getMeta("og:title") || document.title,
					author: getMeta("author") || getMeta("article:author") || "",
					domain: location.hostname.replace(/^www\./, ""),
					image: getMeta("og:image") || "",
					images,
					styles,
					extractedCSS,
					contentClasses: Array.from(contentClasses),
					fontUrls: Array.from(fontUrls),
					fontFaces,
					globalFontSettings,
					cssVariables,
					cssFontMapping,
					url: location.href,
				};

				console.log("✅ Extraction complete, HTML length:", extractedData.html.length);

				return extractedData;
			} catch (error) {
				console.error("Error in page evaluation:", error);
				throw error;
			}
		}, config);

		// Add the captured font requests to the result
		result.fontRequests = fontRequests;

		// Sanitize HTML on the backend for security
		result.html = DOMPurify.sanitize(result.html, {
			ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'div', 'span', 'figure', 'figcaption', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
			ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
			ALLOW_DATA_ATTR: false,
			KEEP_CONTENT: true
		});

		console.log("📁 Network font requests:", fontRequests.length);
		console.log("🔒 HTML sanitized, length:", result.html.length);

		// console.log("Extracted content:", {
		// 	title: result.title,
		// 	author: result.author,
		// 	domain: result.domain,
		// 	hasHtml: !!result.html,
		// 	htmlLength: result.html?.length,
		// 	imageCount: result.images?.length || 0,
		// 	fontRequestCount: fontRequests.length,
		// 	styles: result.styles,
		// });

		return result;
	} catch (error) {
		console.error("Error during extraction:", error);
		throw error;
	} finally {
		await browser.close();
	}
}
