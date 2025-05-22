import { useSignal, useComputed, useSignalEffect } from "@preact/signals-react/runtime";
import { useRef, useState, useEffect } from "react";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { PostText } from "@/components/post/PostText";
import { PostEmbed } from "@/components/post/PostEmbed";
import { Icon } from "@/components/Icon";
import type { DisplayableItem } from "@/components/post/FullPost";
import { getTimeAgo } from "@/lib/utils/time";
import type { ThreadNavigator } from "@/lib/threadNavigation";

interface ChatViewProps {
	displayItems: DisplayableItem[];
	showInputArea?: boolean;
	navigator: ThreadNavigator;
}

export function ChatView({
	displayItems,
	showInputArea = true,
	navigator,
}: ChatViewProps) {
	const [inputText, setInputText] = useState("");
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const currentUser = useSignal({
		did: "current-user", // Placeholder for the current user's DID
		handle: "you",
		displayName: "You",
		avatar:
			"https://cdn.bsky.app/img/avatar/plain/did:plc:current-user/placeholder",
	});

	// Get all posts in chronological order
	const chatMessages = useComputed(() => {
		return navigator.chronologicalUris.map(uri => {
			return navigator.getPost(uri);
		}).filter((post): post is AppBskyFeedDefs.PostView => post !== null);
	});

	// Group messages by author for visual grouping
	const groupedMessages = useComputed(() => {
		const groups: {
			author: string;
			messages: AppBskyFeedDefs.PostView[];
			timestamp: string;
		}[] = [];

		chatMessages.value.forEach((message) => {
			const authorDid = message.author.did;
			const lastGroup = groups[groups.length - 1];

			if (lastGroup && lastGroup.author === authorDid) {
				// Add to existing group if the last message was from the same author
				lastGroup.messages.push(message);
				lastGroup.timestamp = message.indexedAt;
			} else {
				// Create new group for different author
				groups.push({
					author: authorDid,
					messages: [message],
					timestamp: message.indexedAt,
				});
			}
		});

		return groups;
	});

	// Get current message index using the navigator's position
	const currentMessageIndex = useComputed(() => {
		const position = navigator.getCurrentPosition();
		return position.index;
	});

	// Scroll to the current message when the cursor changes
	useSignalEffect(() => {
		if (chatContainerRef.current && currentMessageIndex.value >= 0) {
			// Get all message elements
			const messageElements = chatContainerRef.current.querySelectorAll('[data-message-uri]');
			const currentElement = messageElements[currentMessageIndex.value];
			
			if (currentElement) {
				// Scroll the element into view with a small offset
				currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	});

	// Initial scroll to bottom or to current message
	useEffect(() => {
		if (chatContainerRef.current) {
			if (navigator.cursor?.value && currentMessageIndex.value >= 0) {
				// If we have a cursor, scroll to that message
				const messageElements = chatContainerRef.current.querySelectorAll('[data-message-uri]');
				const currentElement = messageElements[currentMessageIndex.value];
				
				if (currentElement) {
					currentElement.scrollIntoView({ behavior: 'auto', block: 'center' });
				}
			} else {
				// Otherwise, scroll to bottom (default behavior)
				const container = chatContainerRef.current;
				container.scrollTop = container.scrollHeight;
			}
		}
	}, [navigator.cursor?.value, currentMessageIndex.value]);

	// Handle message submission
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!inputText.trim()) return;

		// For demo purposes, we'll just add a fake message from the current user
		// In a real app, this would send the message to an API
		console.log("Message submitted:", inputText);

		// Clear input
		setInputText("");

		// Focus input again
		if (inputRef.current) {
			inputRef.current.focus();
		}
	};

	// Auto-expand textarea as content grows
	const autoResizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = e.target as HTMLTextAreaElement;
		if (!textarea) return;

		setInputText(textarea.value);

		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = "auto";

		// Set new height based on scrollHeight (with a max height)
		const newHeight = Math.min(textarea.scrollHeight, 150);
		textarea.style.height = `${newHeight}px`;
	};

	// Handle message click to update navigator cursor
	const handleMessageClick = (uri: string) => {
		navigator.moveTo(uri);
	};

	// Navigation controls
	const renderNavigationControls = () => {
		const position = navigator.getCurrentPosition();
		
		return (
			<div className="absolute bottom-16 right-4 flex flex-col gap-2 z-10">
				<button 
					onClick={() => navigator.moveToPrev()}
					disabled={position.isFirst}
					className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
					title="Previous message"
				>
					<Icon name="leftArrow" className="size-5 text-gray-700 dark:text-gray-300" />
				</button>
				<button 
					onClick={() => navigator.moveToNext()}
					disabled={position.isLast}
					className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
					title="Next message"
				>
					<Icon name="rightArrow" className="size-5 text-gray-700 dark:text-gray-300" />
				</button>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-[70vh] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 relative">
			{/* Chat header */}
			<div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-750 flex items-center justify-between">
				<div className="flex items-center space-x-3">
					<div className="flex items-center -space-x-2">
						{/* Group chat avatar stack */}
						{[...new Set(chatMessages.value.map((m) => m.author.did))]
							.slice(0, 3)
							.map((did, idx) => {
								const author = chatMessages.value.find(
									(m) => m.author.did === did,
								)?.author;
								return (
									<div
										key={did}
										className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden"
										style={{ zIndex: 10 - idx }}
									>
										{displayItems.includes("avatar") && author?.avatar ? (
											<img
												src={author.avatar}
												alt={author.displayName || author.handle}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400">
												<Icon name="user" className="size-4" />
											</div>
										)}
									</div>
								);
							})}
					</div>

					<div>
						<h2 className="font-medium text-sm">
							{displayItems.includes("displayName") ? (
								<>
									{[
										...new Set(
											chatMessages.value.map((m) => m.author.did),
										),
									]
										.slice(0, 3)
										.map((did, idx, arr) => {
											const author = chatMessages.value.find(
												(m) => m.author.did === did,
											)?.author;
											return (
												<span key={did}>
													{author?.displayName || author?.handle}
													{idx < arr.length - 1 && ", "}
												</span>
											);
										})}
									{[
										...new Set(
											chatMessages.value.map((m) => m.author.did),
										),
									].length > 3 && (
										<span>
											{" "}
											+
											{[
												...new Set(
													chatMessages.value.map((m) => m.author.did),
												),
											].length - 3}{" "}
											others
										</span>
									)}
								</>
							) : (
								<span>Group Chat</span>
							)}
						</h2>
						<p className="text-xs text-gray-500">
							{
								[...new Set(chatMessages.value.map((m) => m.author.did))]
									.length
							}{" "}
							participants
						</p>
					</div>
				</div>

				<div className="flex items-center space-x-2">
					<button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
						<Icon name="phone" className="size-5 text-blue-500" />
					</button>
					<button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
						<Icon name="video" className="size-5 text-blue-500" />
					</button>
					<button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
						<Icon name="information" className="size-5 text-gray-400" />
					</button>
				</div>
			</div>

			{/* Chat messages */}
			<div
				ref={chatContainerRef}
				className="flex-1 overflow-y-auto p-4 space-y-3"
				style={{ backgroundColor: "rgb(240, 242, 245)" }}
			>
				{groupedMessages.value.map((group, groupIndex) => {
					const isCurrentUser = group.author === currentUser.value.did;
					const author = group.messages[0].author;

					return (
						<div
							key={`group-${group.author}-${groupIndex}`}
							className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} gap-2`}
						>
							{!isCurrentUser &&
								displayItems.includes("avatar") &&
								author.avatar && (
									<div className="flex-shrink-0 h-8 w-8 mt-1">
										<img
											src={author.avatar}
											alt={author.displayName || author.handle}
											className="rounded-full w-8 h-8"
										/>
									</div>
								)}

							<div
								className={`flex flex-col max-w-[70%] ${isCurrentUser ? "items-end" : "items-start"}`}
							>
								{/* Author name (only shown for first message in group) */}
								{displayItems.includes("displayName") && !isCurrentUser && (
									<div className="text-xs font-medium text-gray-800 ml-1 mb-1">
										{author.displayName || author.handle}
										{displayItems.includes("handle") && (
											<span className="text-gray-500 font-normal ml-1">
												@{author.handle}
											</span>
										)}
									</div>
								)}

								{/* Message bubbles */}
								<div className="space-y-1">
									{group.messages.map((message, messageIndex) => {
										const isCurrentMessage = navigator.cursor?.value === message.uri;
										return (
											<div
												key={message.uri}
												data-message-uri={message.uri}
												className={`rounded-2xl px-3 py-2 ${
													isCurrentUser
														? "bg-blue-500 text-white"
														: "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
												} ${
													isCurrentMessage 
														? "ring-2 ring-yellow-400 dark:ring-yellow-500" 
														: ""
												} cursor-pointer transition-all`}
												onClick={() => handleMessageClick(message.uri)}
											>
												<div className="prose prose-sm max-w-none break-words">
													<PostText post={message} />
												</div>

												{/* Embedded content */}
												{messageIndex === group.messages.length - 1 && (
													<div
														className={`mt-1 ${isCurrentUser ? "bg-blue-400 rounded-lg overflow-hidden" : ""}`}
													>
														<PostEmbed post={message} />
													</div>
												)}
											</div>
										);
									})}
								</div>

								{/* Timestamp (only shown for last message in group) */}
								<div className="text-[10px] text-gray-500 mt-1 mx-1">
									{getTimeAgo(group.timestamp)}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Navigation controls */}
			{renderNavigationControls()}

			{/* Message input area */}
			{showInputArea && (
				<form
					onSubmit={handleSubmit}
					className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-750"
				>
					<div className="flex items-center gap-2">
						<div className="flex-grow relative flex items-center">
							<textarea
								ref={inputRef}
								value={inputText}
								onChange={autoResizeTextarea}
								placeholder="Aa"
								className="w-full border border-gray-300 dark:border-gray-600 rounded-full py-2 px-4 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none max-h-[150px] min-h-[40px]"
								style={{ height: "40px" }}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleSubmit(e);
									}
								}}
							/>

							<div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
								<button
									type="button"
									className="text-gray-500 hover:text-gray-700"
								>
									<Icon name="photo" className="size-5" />
								</button>
								<button
									type="button"
									className="text-gray-500 hover:text-gray-700"
								>
									<Icon name="faceSmile" className="size-5" />
								</button>
							</div>
						</div>

						<button
							type="submit"
							disabled={!inputText.trim()}
							className={`p-2 rounded-full h-10 w-10 flex items-center justify-center ${
								inputText.trim()
									? "bg-blue-500 text-white"
									: "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
							}`}
						>
							<Icon name="send" className="size-5" />
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
