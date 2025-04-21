import { type Signal, batch } from "@preact/signals";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import type { ThreadState } from "@/lib/signals";
import type { ThreadReply } from "@/lib/types";

/**
 * Recursively searches for a post within a ThreadReply array and its nested replies.
 */
function findPostRecursive(
    replies: ThreadReply[],
    postUri: string
): ThreadReply | null {
    for (const reply of replies) {
        if (reply.post.uri === postUri) {
            return reply;
        }
        if (reply.replies) {
            const foundInNested = findPostRecursive(reply.replies, postUri);
            if (foundInNested) {
                return foundInNested;
            }
        }
    }
    return null;
}

/**
 * Finds a post within a thread signal's data array (including nested replies)
 * by its URI and applies an update function to the post object.
 *
 * Note: This mutates the post object within the signal's data structure directly.
 * It relies on Preact Signals' tracking to detect changes within the nested structure
 * when the signal value is eventually updated.
 */
export function findAndUpdatePostInSignal(
    signal: Signal<ThreadState>,
    postUri: string,
    updateFn: (post: AppBskyFeedDefs.PostView) => AppBskyFeedDefs.PostView
): void {
    const currentSignalValue = signal.peek();
    const currentData = currentSignalValue.data;

    if (!Array.isArray(currentData)) {
        console.warn("Attempted to update post in signal where data is not an array or is null", signal);
        return;
    }

    const targetReply = findPostRecursive(currentData, postUri);

    if (targetReply) {
        // Apply the update function to the found post
        // This *mutates* the post object within the targetReply
        const originalPost = targetReply.post;
        targetReply.post = updateFn(originalPost);

        // Trigger signal update. Since we mutated an object within the array,
        // assigning the same top-level structure might not be enough if components
        // rely on array/object identity. Creating a new top-level object and
        // a new array ensures the signal update is detected.
        batch(() => {
            signal.value = {
                ...currentSignalValue,
                // Create a shallow copy of the data array to ensure identity change
                data: [...currentData],
            };
        });

    } else {
        console.warn(`Post with URI ${postUri} not found in signal data for update.`);
    }
} 