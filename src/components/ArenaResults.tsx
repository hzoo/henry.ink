import { useSignal } from '@preact/signals';
import type { ArenaChannel, ArenaPerson, ArenaUrlBlock } from '@/src/lib/arena-types';

export const arenaBlockUrl = (id: number) => `https://www.are.na/block/${id}`;
const external = { target: '_blank', rel: 'noopener noreferrer' };
const sectionLabel = 'px-4 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';
// Each row is one link; the stretched ::after makes the whole row its target,
// and secondary links sit above it.
const rowClass = 'relative px-4 py-2.5 hover:bg-gray-50 has-[a:focus-visible]:bg-gray-50 dark:hover:bg-gray-800/60 dark:has-[a:focus-visible]:bg-gray-800/60';
const rowLink = 'after:absolute after:inset-0 focus-visible:outline-none';
const innerLink = 'relative z-10 hover:text-gray-950 hover:underline focus-visible:underline focus-visible:outline-none dark:hover:text-white';
const dot = <span aria-hidden="true" class="px-1.5 text-gray-300 dark:text-gray-600">·</span>;

function PersonLink({ person, label }: { person: ArenaPerson; label: string }) {
  return <a {...external} href={`https://www.are.na/${encodeURIComponent(person.slug)}`}
    class={`${innerLink} min-w-0 truncate`} aria-label={`${label}: ${person.name}`}>{person.name}</a>;
}

function ChannelRow({ channel }: { channel: ArenaChannel }) {
  const title = channel.title || 'Untitled channel';
  return <li class={rowClass}>
    <a {...external} href={`https://www.are.na/channel/${encodeURIComponent(channel.slug)}`}
      title={channel.visibility === 'public' ? 'Open channel — anyone can add' : 'Closed channel — collaborators can add'}
      class={`${rowLink} flex items-start gap-2 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100`}>
      <span aria-hidden="true" class={`mt-1.5 size-2 shrink-0 rounded-[2px] border ${channel.visibility === 'public'
        ? 'border-green-600 bg-green-600/20 dark:border-green-400' : 'border-gray-400 dark:border-gray-500'}`} />
      <span class="min-w-0 break-words">{title}</span>
    </a>
    {(channel.owner || channel.blockCount !== undefined) && <p class="mt-0.5 flex min-w-0 items-center pl-4 text-xs text-gray-500 dark:text-gray-400">
      {channel.owner && <PersonLink person={channel.owner} label="Channel owner" />}
      {channel.owner && channel.blockCount !== undefined && dot}
      {channel.blockCount !== undefined && <span class="shrink-0 tabular-nums">{channel.blockCount.toLocaleString()} {channel.blockCount === 1 ? 'block' : 'blocks'}</span>}
    </p>}
    {channel.description && <p class="mt-1 line-clamp-2 whitespace-pre-line break-words pl-4 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{channel.description}</p>}
  </li>;
}

function BlockPreview({ block }: { block: ArenaUrlBlock }) {
  const failed = useSignal(false);
  return <span class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-gray-50 text-[9px] text-gray-500 ring-1 ring-inset ring-black/10 dark:bg-gray-800 dark:text-gray-400 dark:ring-white/10">
    {block.previewUrl && !failed.value
      ? <img src={block.previewUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          class="size-full object-cover" onError={() => { failed.value = true; }} />
      : block.kind === 'Attachment' ? 'File' : block.kind}
  </span>;
}

function SaveRow({ block, pageTitle }: { block: ArenaUrlBlock; pageTitle: string }) {
  const date = block.createdAt ? new Date(block.createdAt) : null;
  const kind = block.kind === 'Attachment' ? 'File' : block.kind;
  // Most saves repeat the page's own title; show one only when the saver renamed it.
  const renamed = block.title !== 'Saved page' && !block.title.toLowerCase().includes(pageTitle.toLowerCase()) ? block.title : null;
  const creator = block.creator && <PersonLink person={block.creator} label="Block creator" />;
  return <li class={`${rowClass} flex gap-3`}>
    <a {...external} href={arenaBlockUrl(block.id)} aria-label={`Open saved block ${block.id} on Are.na`} class={`${rowLink} shrink-0`}>
      <BlockPreview block={block} />
    </a>
    <div class="min-w-0 flex-1">
      <p class="flex min-w-0 break-words text-sm leading-snug text-gray-900 dark:text-gray-100">{renamed ?? creator ?? `${kind} block`}</p>
      <p class="mt-0.5 flex min-w-0 items-center text-xs text-gray-500 dark:text-gray-400">
        {renamed && creator && <>{creator}{dot}</>}
        <span class="shrink-0">{kind}</span>
        {date && <>{dot}<time dateTime={block.createdAt} title={date.toLocaleString()} class="shrink-0 tabular-nums">
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></>}
      </p>
      {block.excerpt && <p class={`mt-1.5 line-clamp-4 whitespace-pre-line break-words text-sm leading-relaxed text-gray-600 dark:text-gray-300 ${block.kind === 'Text' ? 'border-l-2 border-gray-200 pl-3 font-serif dark:border-gray-700' : ''}`}>{block.excerpt}</p>}
    </div>
  </li>;
}

const count = (n: number, more: boolean, one: string, many: string) =>
  <><span class="tabular-nums text-gray-700 dark:text-gray-300">{n}{more ? '+' : ''}</span> {n === 1 && !more ? one : many}</>;

export function ArenaResults({ blocks, hasMore }: { blocks: ArenaUrlBlock[]; hasMore: boolean }) {
  const channels = new Map<string, ArenaChannel>();
  for (const block of blocks) {
    if (block.channels.state !== 'ready') continue;
    for (const channel of block.channels.items) if (!channels.has(channel.slug)) channels.set(channel.slug, channel);
  }
  const pageTitle = blocks.find(block => block.sourceTitle)?.sourceTitle || blocks[0].title;
  const incomplete = hasMore || blocks.some(block => block.channels.state === 'error' || block.channels.hasMore);
  return <div class="pb-2">
    <p class="px-4 pt-3 text-xs text-gray-500 dark:text-gray-400">
      Saved {count(blocks.length, hasMore, 'time', 'times')} into {count(channels.size, incomplete, 'channel', 'channels')} on Are.na
    </p>
    {!!channels.size && <section aria-label="Channels collecting this page">
      <h3 class={sectionLabel}>Channels</h3>
      <ul>{[...channels.values()].map(channel => <ChannelRow key={channel.slug} channel={channel} />)}</ul>
    </section>}
    <section aria-label="Saved versions">
      <h3 class={`${sectionLabel} mt-2 border-t border-gray-100 dark:border-gray-800`}>Saves</h3>
      <ul>{blocks.map(block => <SaveRow key={block.id} block={block} pageTitle={pageTitle} />)}</ul>
    </section>
  </div>;
}
