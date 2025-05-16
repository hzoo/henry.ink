import { Fragment, type JSX } from "preact";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { segmentize, type FacetFeature } from "@atcute/bluesky-richtext-segmenter";

import { isRecord } from "@/lib/postActions";
import { getPost } from "@/lib/utils/postUrls";
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
  post: AppBskyFeedDefs.PostView;
}

function getHandle(mention: string) {
  return mention.slice(1);
}

export function PostText(props: Props) {
  const { post } = props;
  const { record } = post;
  const postRecord = isRecord(record) ? record : null;
  const text = postRecord?.text ?? "";
  const facets = postRecord?.facets ?? [];
  const tags = postRecord?.tags ?? [];

  const segments = segmentize(text, facets);

  const content: { text: string; component: JSX.Element }[] = [];

  for (const segment of segments) {
    const feature = segment.features?.[0] as FacetFeature | undefined; // Assuming one feature per segment for simplicity based on context

    if (feature && feature.$type === 'app.bsky.richtext.facet#mention') {
      content.push({
        text: segment.text,
        component: (
          <>
            {feature.did && (
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
    } else if (feature && feature.$type === 'app.bsky.richtext.facet#link') {
      const url = feature.uri;
      if (url && normalizeUrl(url) === normalizeUrl(currentUrl.value)) {
        const postUrl = getPost(post.uri);
        content.push({
          text: "",
          component: (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-500 hover:underline text-xs"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              [↗]
            </a>
          )
        });
        continue;
      }
      content.push({
        text: segment.text,
        component: (
          <a
            className="text-blue-500 hover:text-blue-500 hover:underline break-all"
            href={feature.uri}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            {segment.text}
          </a>
        ),
      });
    } else if (feature && feature.$type === 'app.bsky.richtext.facet#tag') {
      const encodedTag = encodeURIComponent(feature.tag);
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
      className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap [overflow-wrap:break-word] flex-1 text-sm"
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