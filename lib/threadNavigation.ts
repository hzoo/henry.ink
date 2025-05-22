import { signal, computed, type Signal } from "@preact/signals";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import type { Thread } from "@/lib/threadUtils";

interface TreeNode {
	uri: string;
	parentUri: string | null;
	childUris: string[];
	depth: number;
	indexedAt: string;
}

export class ThreadNavigator {
	// Core data structures
	private nodeMap = new Map<string, TreeNode>();
	private postMap = new Map<string, AppBskyFeedDefs.PostView>();
	public chronologicalUris: readonly string[] = [];
	
	// Current position
	public cursor: Signal<string | null>;
	public currentPost: Signal<AppBskyFeedDefs.PostView | null>;
	
	// Root node URI for reference
	public rootUri: string;

	constructor(threadData: Thread, initialCursorUri?: string) {
		this.rootUri = threadData.post.uri;
		
		// Build the tree structure and maps
		this.buildTree(threadData);
		
		// Set initial cursor position
		const initialUri = initialCursorUri && this.nodeMap.has(initialCursorUri) 
			? initialCursorUri 
			: this.rootUri;
		this.cursor = signal(initialUri);
		
		// Set up computed current post
		this.currentPost = computed(() => {
			if (!this.cursor.value) return null;
			return this.postMap.get(this.cursor.value) || null;
		});
	}

	private buildTree(threadData: Thread) {
		// Build tree recursively and populate maps
		this.addNodeRecursive(null, threadData, 0);
		
		// Create chronological ordering (by depth first, then by time)
		const allNodes = Array.from(this.nodeMap.values());
		this.chronologicalUris = allNodes
			.sort((a, b) => {
				if (a.depth !== b.depth) return a.depth - b.depth;
				return new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime();
			})
			.map(node => node.uri);
	}

	private addNodeRecursive(parentUri: string | null, thread: Thread, depth: number) {
		const { post } = thread;
		
		// Create tree node
		const node: TreeNode = {
			uri: post.uri,
			parentUri,
			childUris: [],
			depth,
			indexedAt: post.indexedAt
		};
		
		// Store in maps
		this.nodeMap.set(post.uri, node);
		this.postMap.set(post.uri, post);
		
		// Add to parent's children
		if (parentUri) {
			const parent = this.nodeMap.get(parentUri);
			if (parent) {
				parent.childUris.push(post.uri);
			}
		}
		
		// Process replies (sort by indexedAt for consistent ordering)
		if (thread.replies) {
			const sortedReplies = [...thread.replies].sort(
				(a, b) => new Date(a.post.indexedAt).getTime() - new Date(b.post.indexedAt).getTime()
			);
			
			for (const reply of sortedReplies) {
				this.addNodeRecursive(post.uri, reply, depth + 1);
			}
		}
	}

	// === NAVIGATION METHODS ===

	moveTo(uri: string): boolean {
		if (!this.nodeMap.has(uri)) return false;
		this.cursor.value = uri;
		return true;
	}

	moveToParent(): boolean {
		const current = this.getCurrentNode();
		if (!current?.parentUri) return false;
		return this.moveTo(current.parentUri);
	}

	moveToFirstChild(): boolean {
		const current = this.getCurrentNode();
		if (!current?.childUris.length) return false;
		return this.moveTo(current.childUris[0]);
	}

	moveToNextSibling(): boolean {
		const current = this.getCurrentNode();
		if (!current?.parentUri) return false;
		
		const parent = this.nodeMap.get(current.parentUri);
		if (!parent) return false;
		
		const currentIndex = parent.childUris.indexOf(current.uri);
		if (currentIndex === -1 || currentIndex >= parent.childUris.length - 1) return false;
		
		return this.moveTo(parent.childUris[currentIndex + 1]);
	}

	moveToPrevSibling(): boolean {
		const current = this.getCurrentNode();
		if (!current?.parentUri) return false;
		
		const parent = this.nodeMap.get(current.parentUri);
		if (!parent) return false;
		
		const currentIndex = parent.childUris.indexOf(current.uri);
		if (currentIndex <= 0) return false;
		
		return this.moveTo(parent.childUris[currentIndex - 1]);
	}

	// Linear navigation by chronological order
	moveToNext(): boolean {
		if (!this.cursor.value) return false;
		
		const currentIndex = this.chronologicalUris.indexOf(this.cursor.value);
		if (currentIndex === -1 || currentIndex >= this.chronologicalUris.length - 1) return false;
		
		return this.moveTo(this.chronologicalUris[currentIndex + 1]);
	}

	moveToPrev(): boolean {
		if (!this.cursor.value) return false;
		
		const currentIndex = this.chronologicalUris.indexOf(this.cursor.value);
		if (currentIndex <= 0) return false;
		
		return this.moveTo(this.chronologicalUris[currentIndex - 1]);
	}

	moveToRoot(): boolean {
		return this.moveTo(this.rootUri);
	}

	// === DATA ACCESS METHODS ===

	getCurrentNode(): TreeNode | null {
		if (!this.cursor.value) return null;
		return this.nodeMap.get(this.cursor.value) || null;
	}

	getPost(uri: string): AppBskyFeedDefs.PostView | null {
		return this.postMap.get(uri) || null;
	}

	getNode(uri: string): TreeNode | null {
		return this.nodeMap.get(uri) || null;
	}

	getCurrentPosition(): {
		index: number;
		total: number;
		isFirst: boolean;
		isLast: boolean;
	} {
		if (!this.cursor.value) {
			return { index: -1, total: this.chronologicalUris.length, isFirst: false, isLast: false };
		}
		
		const index = this.chronologicalUris.indexOf(this.cursor.value);
		const total = this.chronologicalUris.length;
		
		return {
			index,
			total,
			isFirst: index === 0,
			isLast: index === total - 1
		};
	}
}
