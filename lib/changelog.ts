export interface ChangelogEntry {
    version: string;
    changes: string[];
  }
  
  export const changelogData: ChangelogEntry[] = [
    {
      version: "0.0.6",
      changes: [
        "welcome message for first-time users",
        "support for showing changelog since last version",
        "login to Bluesky (like, repost, reply)",
      ],
    },
  ];