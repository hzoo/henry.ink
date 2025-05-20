import { useSignal } from "@preact/signals-react/runtime";
import { FullPost } from "@/components/post/FullPost";

export function ThreadTest() {
    const threadUri = useSignal("https://bsky.app/profile/henryzoo.com/post/3lltzjrnjnc2b");

    return (
        <div className="p-4 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Thread Renderer</h1>
            <div className="mb-4">
                <label htmlFor="threadUri" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Enter Thread URI:
                </label>
                <input
                    type="text"
                    id="threadUri"
                    value={threadUri.value}
                    onInput={(e) => { threadUri.value = e.currentTarget.value; }}
                    placeholder="e.g., at://did:plc:example/app.bsky.feed.post/abcdefghijk"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
            </div>
            {threadUri.value && <FullPost uri={threadUri.value} />}
        </div>
    )
}