import { useSignal } from '@preact/signals';
import type { ArenaChannel, ArenaPerson, ArenaUrlBlock } from '@/src/lib/arena-types';

export const arenaBlockUrl = (id: number) => `https://www.are.na/block/${id}`;
const external = { target: '_blank', rel: 'noopener noreferrer' };
const mutedLink = 'inline-flex min-h-10 items-center hover:text-gray-950 hover:underline dark:hover:text-white';

function PersonLink({ person, label }: { person: ArenaPerson; label: string }) {
  return <a {...external} href={`https://www.are.na/${encodeURIComponent(person.slug)}`}
    class={`${mutedLink} min-w-0`} aria-label={`${label}: ${person.name}`} title={person.name}>
    <span class="truncate">{person.name}</span>
  </a>;
}

function BlockPreview({ block }: { block: ArenaUrlBlock }) {
  const failed = useSignal(false);
  return <span class="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-gray-50 text-[10px] text-gray-500 ring-1 ring-inset ring-black/10 dark:bg-gray-800 dark:text-gray-400 dark:ring-white/10">
    {block.previewUrl && !failed.value
      ? <img src={block.previewUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          class="size-full object-contain" onError={() => { failed.value = true; }} />
      : block.kind === 'Attachment' ? 'File' : block.kind}
  </span>;
}

function SavedBlock({ block }: { block: ArenaUrlBlock }) {
  const date = block.createdAt ? new Date(block.createdAt) : null;
  return <article class="border-t border-gray-100 py-3 first:border-0 dark:border-gray-800">
    <a {...external} href={arenaBlockUrl(block.id)} aria-label={`Open saved block ${block.id} on Are.na`}
      class="group flex min-h-16 items-start gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-gray-500">
      <BlockPreview block={block} />
      <span class="min-w-0 flex-1">
        <span class="block text-[10px] text-gray-500 dark:text-gray-400">{block.kind === 'Attachment' ? 'File' : block.kind} <span class="px-1 text-gray-300 dark:text-gray-600">/</span> <span class="tabular-nums">#{block.id}</span></span>
        <span class="mt-1 block break-words text-sm leading-snug text-gray-900 group-hover:underline dark:text-gray-100">{block.title}</span>
      </span>
    </a>
    {block.excerpt && <p class={`mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-gray-600 dark:text-gray-300 ${block.kind === 'Text' ? 'border-l-2 border-gray-200 pl-3 font-serif dark:border-gray-700' : ''} line-clamp-4`}>{block.excerpt}</p>}
    {(block.creator || date) && <div class="flex min-w-0 items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
      {block.creator ? <PersonLink person={block.creator} label="Block creator" /> : <span />}
      {date && <time dateTime={block.createdAt} title={`Block created ${date.toLocaleString()}`}
        class="shrink-0 tabular-nums">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>}
    </div>}
  </article>;
}

function ChannelRow({ channel, blockIds }: { channel: ArenaChannel; blockIds: number[] }) {
  return <article class="border-b border-gray-100 py-2 last:border-0 dark:border-gray-800">
    <a {...external} href={`https://www.are.na/channel/${encodeURIComponent(channel.slug)}`}
      aria-label={channel.title || 'Untitled channel'}
      title={channel.visibility === 'public' ? 'Open channel — anyone can add' : 'Closed channel — collaborators can add'}
      class="group flex min-h-10 items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"
        class={`shrink-0 ${channel.visibility === 'public' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
        <rect x="2.5" y="5.5" width="11" height="12" rx="1" /><path d="M6.5 5.5v-3h11v12h-4" />
      </svg>
      <span class="min-w-0 flex-1 break-words group-hover:underline">{channel.title || 'Untitled channel'}</span>
      {channel.blockCount !== undefined && <span class="shrink-0 text-[11px] font-normal tabular-nums text-gray-500 dark:text-gray-400">{channel.blockCount.toLocaleString()} {channel.blockCount === 1 ? 'block' : 'blocks'}</span>}
    </a>
    {channel.description && <p class="mt-0.5 line-clamp-2 whitespace-pre-line break-words text-xs leading-relaxed text-gray-600 dark:text-gray-400">{channel.description}</p>}
    <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 text-xs text-gray-500 dark:text-gray-400">
      {channel.owner ? <PersonLink person={channel.owner} label="Channel owner" /> : <span />}
      <div class="flex flex-wrap items-center gap-x-3 text-[11px]">
        {blockIds.map(id => <a key={id} {...external} href={arenaBlockUrl(id)} class={`${mutedLink} tabular-nums`}
        aria-label={`Saved block ${id} in ${channel.title}`}>#{id}</a>)}
      </div>
    </div>
  </article>;
}

export function ArenaResults({ blocks, url, hasMore }: { blocks: ArenaUrlBlock[]; url: string; hasMore: boolean }) {
  const channels = new Map<string, { channel: ArenaChannel; blockIds: number[] }>();
  for (const block of blocks) {
    if (block.channels.state !== 'ready') continue;
    for (const channel of block.channels.items) {
      const row = channels.get(channel.slug) ?? { channel, blockIds: [] };
      if (!row.blockIds.includes(block.id)) row.blockIds.push(block.id);
      channels.set(channel.slug, row);
    }
  }
  const source = new URL(url);
  const title = blocks.find(block => block.sourceTitle)?.sourceTitle || blocks[0].title;
  const incomplete = blocks.some(block => block.channels.state === 'error' || block.channels.hasMore);
  return <>
    <header class="border-b border-gray-100 px-4 py-4 dark:border-gray-800">
      <a {...external} href={url} title={url} class="block min-h-10 truncate text-xs leading-10 text-gray-500 hover:underline dark:text-gray-400">{source.hostname.replace(/^www\./, '')}{source.pathname === '/' ? '' : source.pathname}</a>
      <h2 class="break-words text-base font-medium leading-snug text-gray-950 dark:text-white">{title}</h2>
      <p class="mt-2 text-xs text-gray-500 dark:text-gray-400"><span class="tabular-nums">{blocks.length}{hasMore ? '+' : ''}</span> {blocks.length === 1 && !hasMore ? 'save' : 'saves'} <span class="px-1 text-gray-300 dark:text-gray-600">/</span> <span class="tabular-nums">{channels.size}{hasMore || incomplete ? '+' : ''}</span> {channels.size === 1 && !hasMore && !incomplete ? 'channel' : 'channels'}</p>
    </header>
    {!!channels.size && <section class="px-4 pt-4" aria-label="Channels collecting this page">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">In these channels</h3>
      {[...channels.values()].map(row => <ChannelRow key={row.channel.slug} {...row} />)}
    </section>}
    <section class="border-t border-gray-100 px-4 pt-4 dark:border-gray-800" aria-label="Saved versions">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Saved versions</h3>
      {blocks.map(block => <SavedBlock key={block.id} block={block} />)}
    </section>
  </>;
}
