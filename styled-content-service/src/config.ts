// Configuration for content extraction

export interface ExtractionConfig {
	contentSelectors: string[];
	adSelectors: string[];
	unwantedSelectors: string[];
	unwantedTextPatterns: RegExp[];
	waitTime?: number;
	timeout?: number;
}

export const defaultConfig: ExtractionConfig = {
	contentSelectors: [
		"article",
		"main",
		'[role="main"]',
		".article-content",
		".post-content",
		".content-body",
		".entry-content",
		".post-body",
		".article-body",
	],
	adSelectors: [
		'[class*="advertisement"]',
		'[class*="Advertisement"]',
		'[id*="advertisement"]',
		'[id*="Advertisement"]',
		'[class*="ad-container"]',
		'[class*="ad-wrapper"]',
		'[class*="google-ad"]',
		"[data-ad]",
		"[data-ad-wrapper]",
		"[data-advertisement]",
		".dfp-ad",
		".ad",
		".ads",
		".advert",
		".banner-ad",
		'aside[aria-label*="advertisement" i]',
		'div[aria-label*="advertisement" i]',
		'section[aria-label*="advertisement" i]',
	],
	unwantedSelectors: [
		"nav",
		"header",
		"footer",
		".navigation",
		".navbar",
		".menu",
		".sidebar",
		".comments",
		".related-posts",
		".social-share",
		".newsletter-signup",
	],
	unwantedTextPatterns: [
		/^(Advertisement|AD|Sponsored|SPONSORED)$/i,
		/^(Subscribe|Sign up|Newsletter)$/i,
	],
	waitTime: 0,
	timeout: 3000,
};

// Domain-specific configurations
export const domainConfigs: Record<string, Partial<ExtractionConfig>> = {
	"time.com": {
		contentSelectors: ["#article-body"],
	},
};

export function getConfigForDomain(domain: string): ExtractionConfig {
	// Remove www. prefix for matching
	const cleanDomain = domain.replace(/^www\./, "");

	const domainConfig = domainConfigs[cleanDomain];
	if (domainConfig) {
		return {
			...defaultConfig,
			...domainConfig,
			// Merge arrays properly
			contentSelectors:
				domainConfig.contentSelectors || defaultConfig.contentSelectors,
			adSelectors: [
				...defaultConfig.adSelectors,
				...(domainConfig.adSelectors || []),
			],
			unwantedSelectors: [
				...defaultConfig.unwantedSelectors,
				...(domainConfig.unwantedSelectors || []),
			],
		};
	}

	return defaultConfig;
}
