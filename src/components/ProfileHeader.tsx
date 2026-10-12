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
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
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
          </div>
        </div>
      </div>
    </div>
  );
}
