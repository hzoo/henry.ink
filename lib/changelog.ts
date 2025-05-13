export interface ChangelogEntry {
    version: string;
    changes: string[];
  }
  
  export const changelogData: ChangelogEntry[] = [
    {
      version: "0.0.8",
      changes: [
        "basic inline image support",
        "usable when not logged in",
        "basic filters"
      ],
    },
    {
      version: "0.0.7",
      changes: [
        "when selecting text, show popup to annotate (when sidebar is open) and post to bsky",
        "show clearer error message about /search not working when not logged in",
      ],
    },
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