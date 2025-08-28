import { useState } from "preact/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { now as tidNow } from "@atcute/tid";
import type { StoredTrail } from "@/api/trails/trail-storage";

interface TrailFormProps {
  session: any; // AT Protocol session
  onSuccess?: (trail: StoredTrail) => void;
  onCancel?: () => void;
  initialData?: Partial<StoredTrail>;
  mode?: 'create' | 'edit';
}

export function TrailForm({ 
  session, 
  onSuccess, 
  onCancel, 
  initialData, 
  mode = 'create' 
}: TrailFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  
  const queryClient = useQueryClient();

  const createTrailMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      if (!session) {
        throw new Error('No session available');
      }

      const rkey = tidNow().toString();
      const trailRecord = {
        $type: 'ink.henry.feed.trail',
        name: data.name,
        description: data.description || undefined,
        createdAt: new Date().toISOString(),
      };

      const { ok, data: result } = await session.rpc.post('com.atproto.repo.createRecord', {
        input: {
          repo: session.session.info.sub,
          collection: 'ink.henry.feed.trail',
          rkey,
          record: trailRecord,
        }
      });

      if (!ok) {
        throw new Error(`Error creating trail: ${result.error}`);
      }

      const uri = `at://${session.session.info.sub}/ink.henry.feed.trail/${rkey}`;
      return {
        id: Date.now(), // placeholder for UI
        uri,
        name: trailRecord.name,
        description: trailRecord.description,
        author_did: session.session.info.sub,
        created_at: trailRecord.createdAt,
        indexed_at: new Date().toISOString(),
      } as StoredTrail;
    },
    onSuccess: (trail) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['trails'] });
      onSuccess?.(trail);
      
      // Reset form
      setName('');
      setDescription('');
    },
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    
    if (!name.trim()) {
      return;
    }

    createTrailMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const isSubmitting = createTrailMutation.isPending;
  const error = createTrailMutation.error;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {mode === 'create' ? 'Create New Trail' : 'Edit Trail'}
          </h3>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              disabled={isSubmitting}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Name field */}
          <div>
            <label htmlFor="trail-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Trail Name *
            </label>
            <input
              id="trail-name"
              type="text"
              value={name}
              onChange={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="Enter trail name..."
              maxLength={64}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {name.length}/64 characters
            </div>
          </div>

          {/* Description field */}
          <div>
            <label htmlFor="trail-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="trail-description"
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              placeholder="Describe what this trail is about..."
              rows={3}
              maxLength={300}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {description.length}/300 characters
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : 'Failed to create trail'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {mode === 'create' ? 'Create Trail' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}