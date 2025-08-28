import { useState } from "preact/hooks";
import { TrailList } from "@/src/components/TrailList";
import { TrailDetail } from "@/src/components/TrailDetail";
import { TrailForm } from "@/src/components/TrailForm";
import { MarkForm } from "@/src/components/MarkForm";
import type { TrailView, StoredMark } from "@/api/trails/trail-storage";

interface TrailsManagerProps {
  session?: any; // AT Protocol session
  initialView?: 'list' | 'create';
  className?: string;
}

type View = 'list' | 'create-trail' | 'trail-detail' | 'add-mark';

export function TrailsManager({ 
  session, 
  initialView = 'list',
  className = ''
}: TrailsManagerProps) {
  const currentUserDid = session?.did;
  const [currentView, setCurrentView] = useState<View>(initialView === 'create' ? 'create-trail' : 'list');
  const [selectedTrail, setSelectedTrail] = useState<TrailView | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuthor, setFilterAuthor] = useState<'all' | 'mine'>('all');

  const handleTrailClick = (trail: TrailView) => {
    setSelectedTrail(trail);
    setCurrentView('trail-detail');
  };

  const handleCreateTrail = () => {
    setCurrentView('create-trail');
  };

  const handleAddMark = () => {
    if (selectedTrail) {
      setCurrentView('add-mark');
    }
  };

  const handleBackToList = () => {
    setSelectedTrail(null);
    setCurrentView('list');
  };

  const handleTrailCreated = () => {
    setCurrentView('list');
  };

  const handleMarkCreated = () => {
    setCurrentView('trail-detail');
  };

  const handleMarkClick = (mark: StoredMark) => {
    // Handle mark click - could open URL, navigate to AT Protocol content, etc.
    if (mark.subject_type === 'external' && mark.external_url) {
      window.open(mark.external_url, '_blank', 'noopener,noreferrer');
    } else if (mark.subject_type === 'strongRef' && mark.subject_uri) {
      // Could implement AT Protocol content navigation
      console.log('Navigate to AT Protocol content:', mark.subject_uri);
    }
  };

  const authorFilter = filterAuthor === 'mine' && currentUserDid ? currentUserDid : undefined;

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {currentView !== 'list' && (
              <button
                onClick={handleBackToList}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
            
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {currentView === 'list' && 'Trails'}
              {currentView === 'create-trail' && 'Create Trail'}
              {currentView === 'trail-detail' && selectedTrail?.name}
              {currentView === 'add-mark' && 'Add Mark'}
            </h1>
          </div>

          {currentView === 'list' && (
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search trails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  className="w-48 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="absolute right-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Filter */}
              {currentUserDid && (
                <select
                  value={filterAuthor}
                  onChange={(e) => setFilterAuthor((e.target as HTMLSelectElement).value as 'all' | 'mine')}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Trails</option>
                  <option value="mine">My Trails</option>
                </select>
              )}

              {/* Create button */}
              {currentUserDid && (
                <button
                  onClick={handleCreateTrail}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Trail
                </button>
              )}
            </div>
          )}

          {currentView === 'trail-detail' && selectedTrail && currentUserDid && (
            <button
              onClick={handleAddMark}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Mark
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-hidden">
        {currentView === 'list' && (
          <TrailList
            authorDid={authorFilter}
            searchQuery={searchQuery || undefined}
            showMarkPreviews={true}
            onTrailClick={handleTrailClick}
          />
        )}

        {currentView === 'create-trail' && session && (
          <div className="p-4">
            <TrailForm
              session={session}
              onSuccess={handleTrailCreated}
              onCancel={handleBackToList}
            />
          </div>
        )}

        {currentView === 'trail-detail' && selectedTrail && (
          <TrailDetail
            trailUri={selectedTrail.uri}
            onMarkClick={handleMarkClick}
          />
        )}

        {currentView === 'add-mark' && selectedTrail && session && (
          <div className="p-4">
            <MarkForm
              trailUri={selectedTrail.uri}
              session={session}
              onSuccess={handleMarkCreated}
              onCancel={() => setCurrentView('trail-detail')}
            />
          </div>
        )}
      </div>

      {/* No user state */}
      {!session && currentView !== 'list' && (
        <div className="flex-grow flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Login Required
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You need to be logged in to create trails and marks.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}