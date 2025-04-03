import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import { RichText as RichTextHelper, AppBskyFeedPost, type AppBskyRichtextFacet } from "@atproto/api";
import { Fragment, type JSX } from "preact";
import { currentUrl } from "@/lib/messaging";

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove www.
    const hostname = parsed.hostname.replace(/^www\./, '');
    // Reconstruct without www and trailing slash
    return `${parsed.protocol}//${hostname}${parsed.pathname.replace(/\/$/, '')}${parsed.search}${parsed.hash}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

interface Props {
  record: PostView["record"];
  truncate?: boolean;
}

export function getHandle(mention: string) {
  return mention.slice(1);
}

export function PostText(props: Props) {
  const { record, truncate } = props;
  const postRecord = AppBskyFeedPost.isRecord(record) ? record : null;
  const text = postRecord?.text as string || "";
  const facets = postRecord?.facets as AppBskyRichtextFacet.Main[] || [];
  const tags = postRecord?.tags as string[] || [];

  const richText = new RichTextHelper({
    text: text.toString(),
    facets: facets as AppBskyRichtextFacet.Main[],
  });

  const content: { text: string; component: JSX.Element }[] = [];

  for (const segment of richText.segments()) {
    if (segment.isMention()) {
      content.push({
        text: segment.text,
        component: (
          <>
            {segment.mention?.did && (
              <a
                className="text-blue-500 hover:text-blue-500 hover:underline break-after-auto"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://bsky.app/profile/${getHandle(segment.text)}`}
                onClick={(e: MouseEvent) => e.stopPropagation()}
              >
                {segment.text}
              </a>
            )}
          </>
        ),
      });
    } else if (segment.isLink()) {
      const url = segment.link?.uri;
      if (url && normalizeUrl(url) === normalizeUrl(currentUrl.value)) {
        content.push({
          text: "",
          component: <span className="text-gray-400 text-xs">[↗]</span>
        });
        continue;
      }
      content.push({
        text: segment.text,
        component: (
          <a
            className="text-blue-500 hover:text-blue-500 hover:underline break-all"
            href={segment.link?.uri!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            {segment.text}
          </a>
        ),
      });
    } else if (segment.isTag()) {
      const encodedTag = encodeURIComponent(segment.tag?.tag!);
      content.push({
        text: segment.text,
        component: (
          <a
            href={`https://bsky.app/hashtag/${encodedTag}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-500 hover:underline"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            {segment.text}
          </a>
        ),
      });
    } else {
      content.push({
        text: segment.text,
        component: (
          <span>
            {segment.text}
          </span>
        ),
      });
    }
  }

  return (
    <div
      dir="auto"
      className={`text-gray-900 dark:text-gray-100 whitespace-pre-wrap [overflow-wrap:break-word] flex-1 ${
        truncate && "line-clamp-6"
      } text-sm`}
    >
      {content.map((segment, i) => (
        <Fragment key={`${segment.text}-${i}`}>{segment.component}</Fragment>
      ))}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 my-2">
          {tags.map((tag: string) => (
            <span
              key={tag}
              className="text-blue-500 hover:text-blue-500 hover:underline text-sm"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
} 