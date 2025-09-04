import { profileTrailsCount, scrollToElement } from "@/src/lib/trails-signals";

interface Profile {
  displayName?: string;
  handle: string;
  description?: string;
  avatar?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

interface ProfileHeaderProps {
  profile: Profile;
  username: string;
}

export function ProfileHeader({ profile, username }: ProfileHeaderProps) {
  const handleTrailsClick = (e: Event) => {
    e.preventDefault();
    scrollToElement('trails');
  };

  return (
    <div className="mb-4 pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-4">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.displayName || profile.handle}
            className="w-20 h-20 rounded-full object-cover bg-gray-100 dark:bg-gray-800"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {profile.displayName || profile.handle}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            @{profile.handle}
          </p>
          {profile.description && (
            <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
              {profile.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {profile.followersCount || 0}
              </span>{" "}
              followers
            </span>
            <span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {profile.followsCount || 0}
              </span>{" "}
              following
            </span>
            <span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {profile.postsCount || 0}
              </span>{" "}
              posts
            </span>
            {profileTrailsCount.value > 0 && (
              <button
                onClick={handleTrailsClick}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {profileTrailsCount.value}
                </span>{" "}
                trails
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}