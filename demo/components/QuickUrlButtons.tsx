import { useLocation } from "preact-iso";
import { contentStateSignal, contentModeSignal } from "@/henry-ink/signals";
import { currentUrl } from "@/src/lib/messaging";

interface SampleUrl {
	name: string;
	url: string;
	description?: string;
}

const sampleUrls: SampleUrl[] = [
	{
		name: "Dan's Blog Post",
		url: "https://overreacted.io/suppressions-of-suppressions/",
		description: "React blog post",
	},
	{
		name: "brutecat",
		url: "https://brutecat.com/articles/leaking-google-phones",
		description: "Brutecat article on leaking Google phones",
	},
	{
		name: "Laurie Herault's Blog",
		url: "https://www.laurieherault.com/articles/a-thermal-receipt-printer-cured-my-procrastination",
		description: "Laurie Herault's blog post on procrastination",
	},
	{
		name: "Tailscale Blog",
		url: "https://tailscale.com/blog/frequent-reath-security",
		description: "Tailscale blog post on security",
	},
	{
		name: "Daringfireball",
		url: "https://daringfireball.net/linked/2025/06/07/bill-atkinson-rip",
		description: "Bill Atkinson Dies From Cancer at 74",
	},
];

export function QuickUrlButtons() {
	const location = useLocation();

	const loadUrl = (url: string) => {
		currentUrl.value = url;
		location.route(`/${url}`);
		contentStateSignal.value = { type: "loading", mode: contentModeSignal.value };
	};

	return (
		<>
			{sampleUrls.map((sample) => (
				<button
					key={sample.url}
					onClick={() => loadUrl(sample.url)}
					title={sample.description || `Load ${sample.url}`}
					className="px-3 py-1 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500/50 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-800 dark:text-blue-100 text-xs"
				>
					{sample.name}
				</button>
			))}
		</>
	);
}
