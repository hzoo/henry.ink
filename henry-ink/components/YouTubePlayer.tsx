import { useRef, useEffect } from "preact/hooks";
import { signal, useSignal, useComputed } from "@preact/signals";
import type { TranscriptItem } from "@/henry-ink/signals";

interface YouTubePlayerProps {
	videoId: string;
	title?: string;
	transcript: TranscriptItem[];
}

const currentTime = signal(0);
const ALLOWED_ORIGINS = new Set([
	'https://www.youtube.com',
	'https://www.youtube-nocookie.com',
]);

// Format time for display (e.g., "1:23" or "12:34")
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Find the current transcript segment based on video time
function findCurrentSegment(transcript: TranscriptItem[], currentTimeValue: number): number {
	let currentIndex = -1;
	for (let i = 0; i < transcript.length; i++) {
		if (currentTimeValue >= transcript[i].offset) {
			currentIndex = i;
		} else {
			break;
		}
	}
	return currentIndex;
}

export function YouTubePlayer({ videoId, title, transcript }: YouTubePlayerProps) {
	const playerRef = useRef<HTMLIFrameElement>(null);
	const transcriptRef = useRef<HTMLDivElement>(null);
	const searchQuery = useSignal("");
	const showSearch = useSignal(false);
	const progressTimerRef = useRef<number>();

	// Find current segment based on video time
	const currentSegmentIndex = useComputed(() =>
		findCurrentSegment(transcript, currentTime.value)
	);

	const postToPlayer = (payload: Record<string, unknown>) => {
		const frameWindow = playerRef.current?.contentWindow;
		if (!frameWindow) return;
		frameWindow.postMessage(JSON.stringify(payload), '*');
	};

	const sendPlayerCommand = (func: string, args: unknown[] = []) => {
		postToPlayer({ event: 'command', func, args });
	};

	const requestCurrentTime = () => {
		sendPlayerCommand('getCurrentTime');
	};

	const startProgressUpdates = () => {
		if (progressTimerRef.current) return;
		progressTimerRef.current = window.setInterval(() => {
			requestCurrentTime();
		}, 500);
	};

	const stopProgressUpdates = () => {
		if (!progressTimerRef.current) return;
		window.clearInterval(progressTimerRef.current);
		progressTimerRef.current = undefined;
	};

	const initializePlayer = () => {
		postToPlayer({ event: 'listening', id: `henry-ink-${videoId}` });
		sendPlayerCommand('addEventListener', ['onStateChange']);
		sendPlayerCommand('addEventListener', ['onPlaybackRateChange']);
		sendPlayerCommand('addEventListener', ['onPlaybackQualityChange']);
		sendPlayerCommand('addEventListener', ['onReady']);
		requestCurrentTime();
		startProgressUpdates();
	};

	// Filter transcript based on search query
	const filteredTranscript = useComputed(() => {
		if (!searchQuery.value.trim()) return transcript;
		const query = searchQuery.value.toLowerCase();
		return transcript.filter(item =>
			item.text.toLowerCase().includes(query)
		);
	});

	useEffect(() => {
		currentTime.value = 0;
		return () => {
			currentTime.value = 0;
		};
	}, [videoId]);

	// Listen to video time updates via postMessage API
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (!ALLOWED_ORIGINS.has(event.origin)) return;

			let data: any = event.data;
			if (typeof data === 'string') {
				try {
					data = JSON.parse(data);
				} catch (error) {
					console.warn('Failed to parse YouTube postMessage payload:', error);
					return;
				}
			}

			if (!data || typeof data !== 'object') return;

			if (data.event === 'infoDelivery' && typeof data.info?.currentTime === 'number') {
				currentTime.value = data.info.currentTime;
				return;
			}

			if (data.event === 'onReady') {
				startProgressUpdates();
				requestCurrentTime();
				return;
			}

			if (data.event === 'onStateChange' && typeof data.info === 'number') {
				if (data.info === 1) {
					startProgressUpdates();
				} else if (data.info === 2 || data.info === 0) {
					stopProgressUpdates();
				}
			}
		};

		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
			stopProgressUpdates();
		};
	}, [videoId]);

	useEffect(() => () => stopProgressUpdates(), []);

	// Auto-scroll transcript to current segment
	useEffect(() => {
		if (currentSegmentIndex.value >= 0 && transcriptRef.current) {
			const currentElement = transcriptRef.current.querySelector(
				`[data-segment-index="${currentSegmentIndex.value}"]`
			);
			if (currentElement) {
				currentElement.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
				});
			}
		}
	}, [currentSegmentIndex.value]);

	// Seek to specific time in video
	const seekTo = (time: number) => {
		if (!playerRef.current) return;
		sendPlayerCommand('seekTo', [time, true]);
		currentTime.value = time;
		requestCurrentTime();
	};

	// Copy transcript text to clipboard
	const copyTranscript = async () => {
		const text = transcript
			.map(item => `[${formatTime(item.offset)}] ${item.text}`)
			.join('\n');

		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.warn('Failed to copy transcript:', err);
		}
	};

	// YouTube embed URL with privacy-enhanced domain
	const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;

	return (
			<div className="max-w-4xl mx-auto space-y-6">
				{/* Video Player */}
				<div className="relative">
					<div className="aspect-video rounded-xl overflow-hidden shadow-lg bg-gray-100 dark:bg-gray-800">
						<iframe
							ref={playerRef}
							src={embedUrl}
							title={title || `YouTube Video ${videoId}`}
							className="w-full h-full"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
							onLoad={initializePlayer}
						/>
				</div>

				{/* Video Title */}
				{title && (
					<h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
						{title}
					</h1>
				)}
			</div>

			{/* Transcript Section */}
			<div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden">
				{/* Transcript Header */}
				<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
					<div className="flex items-center gap-3">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
							Transcript
						</h2>
						<span className="text-sm text-gray-500 dark:text-gray-400">
							{transcript.length} segments
						</span>
					</div>

					<div className="flex items-center gap-2">
						{/* Search Toggle */}
						<button
							onClick={() => showSearch.value = !showSearch.value}
							className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							title="Search transcript"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
							Search
						</button>

						{/* Copy Button */}
						<button
							onClick={copyTranscript}
							className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							title="Copy transcript"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							Copy
						</button>
					</div>
				</div>

				{/* Search Bar */}
				{showSearch.value && (
					<div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
						<input
							type="text"
							value={searchQuery.value}
							onInput={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
							placeholder="Search transcript..."
							className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
				)}

				{/* Transcript Content */}
				<div
					ref={transcriptRef}
					className="max-h-96 overflow-y-auto p-4 space-y-2"
				>
					{filteredTranscript.value.map((item, index) => {
						const originalIndex = transcript.indexOf(item);
						const isActive = originalIndex === currentSegmentIndex.value;

						return (
							<div
								key={originalIndex}
								data-segment-index={originalIndex}
								className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
										: 'hover:bg-gray-50 dark:hover:bg-gray-700'
								}`}
								onClick={() => seekTo(item.offset)}
							>
								{/* Timestamp */}
								<button className="flex-shrink-0 text-sm font-mono text-blue-600 dark:text-blue-400 hover:underline">
									{formatTime(item.offset)}
								</button>

								{/* Text */}
								<div className={`text-sm leading-relaxed ${
									isActive
										? 'text-gray-900 dark:text-gray-100 font-medium'
										: 'text-gray-700 dark:text-gray-300'
								}`}>
									{item.text}
								</div>
							</div>
						);
					})}

					{filteredTranscript.value.length === 0 && searchQuery.value && (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							No results found for "{searchQuery.value}"
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
