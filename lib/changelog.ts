export interface ChangelogEntry {
    version: string;
    changes: string[];
  }
  
  export const changelogData: ChangelogEntry[] = [
    {
      version: "0.0.6",
      changes: [
        "welcome popup, show changelog",
        "login to Bluesky (like, repost, reply) with oauth",
        "show OP on posts",
        "cleanup expand/collapse UI",
        "remove mode toggle, show OP as 'full' post",
      ],
    },
  ];