import { useState } from "preact/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TID } from "@atcute/tid";
import type { StoredMark } from "@/api/trails/trail-storage";

interface MarkFormProps {
  trailUri: string;
  session: any; // AT Protocol session
  onSuccess?: (mark: StoredMark) => void;
  onCancel?: () => void;
  initialData?: {
    url?: string;
    title?: string;
    description?: string;
    note?: string;
  };
}

export function MarkForm({ 
  trailUri, 
  session, 
  onSuccess, 
  onCancel, 
  initialData 
}: MarkFormProps) {
  const [subjectType, setSubjectType] = useState<'strongRef' | 'external'>('external');
  const [externalUrl, setExternalUrl] = useState(initialData?.url || '');
  const [externalTitle, setExternalTitle] = useState(initialData?.title || '');
  const [externalDescription, setExternalDescription] = useState(initialData?.description || '');
  const [strongRefUri, setStrongRefUri] = useState('');
  const [strongRefCid, setStrongRefCid] = useState('');
  const [note, setNote] = useState(initialData?.note || '');
  
  const queryClient = useQueryClient();

  const createMarkMutation = useMutation({
    mutationFn: async (data: {
      subject_type: 'strongRef' | 'external';
      subject_uri?: string;
      subject_cid?: string;
      external_url?: string;
      external_title?: string;
      external_description?: string;
      note?: string;
    }) => {
      if (!session) {
        throw new Error('No session available');
      }

      const rkey = TID.now().toString();
      let subject: any;
      
      if (data.subject_type === 'strongRef') {
        subject = {
          $type: 'com.atproto.repo.strongRef',
          uri: data.subject_uri!,
          cid: data.subject_cid!,
        };
      } else {
        subject = {
          uri: data.external_url!,
          title: data.external_title || undefined,
          description: data.external_description || undefined,
        };
      }

      const markRecord = {
        $type: 'ink.henry.feed.mark',
        trail: trailUri,
        subject,
        note: data.note || undefined,
        createdAt: new Date().toISOString(),
      };

      const { ok, data: result } = await session.rpc.post('com.atproto.repo.createRecord', {
        repo: session.did,
        collection: 'ink.henry.feed.mark',
        rkey,
        record: markRecord,
      });

      if (!ok) {
        throw new Error(`Error creating mark: ${result.error}`);
      }

      const uri = `at://${session.did}/ink.henry.feed.mark/${rkey}`;
      return {
        id: Date.now(), // placeholder for UI
        uri,
        trail_uri: trailUri,
        subject_type: data.subject_type,
        subject_uri: data.subject_uri,
        subject_cid: data.subject_cid,
        external_url: data.external_url,
        external_title: data.external_title,
        external_description: data.external_description,
        note: data.note,
        author_did: session.did,
        created_at: markRecord.createdAt,
        indexed_at: new Date().toISOString(),
      } as StoredMark;
    },
    onSuccess: (mark) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['trail-marks', trailUri] });
      queryClient.invalidateQueries({ queryKey: ['trail-detail', trailUri] });
      queryClient.invalidateQueries({ queryKey: ['trails'] });
      
      onSuccess?.(mark);
      
      // Reset form
      setExternalUrl('');
      setExternalTitle('');
      setExternalDescription('');
      setStrongRefUri('');
      setStrongRefCid('');
      setNote('');
    },
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    
    const data: Parameters<typeof createMarkMutation.mutate>[0] = {
      subject_type: subjectType,
      note: note.trim() || undefined,
    };

    if (subjectType === 'external') {
      if (!externalUrl.trim()) {
        return;
      }
      data.external_url = externalUrl.trim();
      data.external_title = externalTitle.trim() || undefined;
      data.external_description = externalDescription.trim() || undefined;
    } else {
      if (!strongRefUri.trim() || !strongRefCid.trim()) {
        return;
      }
      data.subject_uri = strongRefUri.trim();
      data.subject_cid = strongRefCid.trim();
    }

    createMarkMutation.mutate(data);
  };

  const isSubmitting = createMarkMutation.isPending;
  const error = createMarkMutation.error;

  const canSubmit = subjectType === 'external' 
    ? externalUrl.trim()
    : strongRefUri.trim() && strongRefCid.trim();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Add Mark to Trail
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

        {/* Subject type selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Content Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="subjectType"
                value="external"
                checked={subjectType === 'external'}
                onChange={() => setSubjectType('external')}
                className="mr-2"
                disabled={isSubmitting}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">External URL</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="subjectType"
                value="strongRef"
                checked={subjectType === 'strongRef'}
                onChange={() => setSubjectType('strongRef')}
                className="mr-2"
                disabled={isSubmitting}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">AT Protocol Content</span>
            </label>
          </div>
        </div>

        {/* Form fields based on type */}
        <div className="space-y-4">
          {subjectType === 'external' ? (
            <>
              {/* External URL */}
              <div>
                <label htmlFor="external-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL *
                </label>
                <input
                  id="external-url"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl((e.target as HTMLInputElement).value)}
                  placeholder="https://example.com/article"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* External title */}
              <div>
                <label htmlFor="external-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  id="external-title"
                  type="text"
                  value={externalTitle}
                  onChange={(e) => setExternalTitle((e.target as HTMLInputElement).value)}
                  placeholder="Page title or custom title"
                  maxLength={300}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              {/* External description */}
              <div>
                <label htmlFor="external-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="external-description"
                  value={externalDescription}
                  onChange={(e) => setExternalDescription((e.target as HTMLTextAreaElement).value)}
                  placeholder="Brief description of the content"
                  rows={2}
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={isSubmitting}
                />
              </div>
            </>
          ) : (
            <>
              {/* Strong ref URI */}
              <div>
                <label htmlFor="strongref-uri" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AT-URI *
                </label>
                <input
                  id="strongref-uri"
                  type="text"
                  value={strongRefUri}
                  onChange={(e) => setStrongRefUri((e.target as HTMLInputElement).value)}
                  placeholder="at://did:plc:abc123/app.bsky.feed.post/3abc123def"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Strong ref CID */}
              <div>
                <label htmlFor="strongref-cid" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CID *
                </label>
                <input
                  id="strongref-cid"
                  type="text"
                  value={strongRefCid}
                  onChange={(e) => setStrongRefCid((e.target as HTMLInputElement).value)}
                  placeholder="bafyreiabc123def..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </>
          )}

          {/* Note field */}
          <div>
            <label htmlFor="mark-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Note
            </label>
            <textarea
              id="mark-note"
              value={note}
              onChange={(e) => setNote((e.target as HTMLTextAreaElement).value)}
              placeholder="Add your thoughts about this content..."
              rows={3}
              maxLength={300}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {note.length}/300 characters
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : 'Failed to create mark'}
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
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Add Mark
          </button>
        </div>
      </form>
    </div>
  );
}