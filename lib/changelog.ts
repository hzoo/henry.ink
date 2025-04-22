export interface ChangelogEntry {
    version: string;
    changes: string[];
  }
  
  export const changelogData: ChangelogEntry[] = [
    {
      version: "0.0.6",
      changes: [
        "Added a welcome message for first-time users.",
        "Added support for logging in to Bluesky to fetch posts, like, repost, reply",
      ],
    },
  ];