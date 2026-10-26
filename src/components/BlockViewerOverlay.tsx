import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { 
  arenaUrlState,
  closeBlockOverlay,
  openBlockOverlay
} from "@/src/lib/arena-navigation";
import type { ArenaMatch, ArenaBlock, ImageBlock, TextBlock, LinkBlock, EmbedBlock, AttachmentBlock } from "@/src/lib/arena-types";
import { sanitizeReadableHtml } from '@/henry-ink/reader/readable';
import { parseArenaSourceUrl } from '@/src/lib/arena-api';

interface ProgressiveImageProps {
  lowResUrl: string;
  highResUrl?: string;
  alt: string;
}

function ProgressiveImage({ lowResUrl, highResUrl, alt }: ProgressiveImageProps) {
  const currentImageUrl = useSignal(lowResUrl);

  useEffect(() => {
    currentImageUrl.value = lowResUrl;
    if (!highResUrl || highResUrl === lowResUrl) return;

    // Preload high resolution image
    const highResImage = new Image();
    highResImage.onload = () => {
      currentImageUrl.value = highResUrl;
    };
    highResImage.src = highResUrl;
    return () => { highResImage.onload = null; };
  }, [lowResUrl, highResUrl]);

  return (
    <div className="flex justify-center">
      <img
        src={currentImageUrl.value}
        alt={alt}
        className={`max-w-full max-h-[80vh] object-contain rounded shadow-lg transition-opacity duration-300 ${
          highResUrl && currentImageUrl.value !== highResUrl ? 'opacity-90' : 'opacity-100'
        }`}
        loading="eager"
      />
    </div>
  );
}

interface BlockViewerProps { channel: ArenaMatch; blocks: ArenaBlock[] }

export function BlockViewerOverlay({ channel, blocks }: BlockViewerProps) {
  const state = arenaUrlState.value;
  const index = blocks.findIndex(block => block.id === state.blockId);
  if (state.channelSlug !== channel.slug || index < 0) return null;
  return <BlockViewer channel={channel} blocks={blocks} index={index} />;
}

function BlockViewer({ channel, blocks: allBlocks, index }: BlockViewerProps & { index: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blockData = { block: allBlocks[index], index };
  const navigate = (offset: number) => {
    const currentIndex = allBlocks.findIndex(block => block.id === arenaUrlState.peek().blockId);
    const next = allBlocks[currentIndex + offset];
    if (next) openBlockOverlay(next, channel.slug);
  };
  const navigateToNext = () => navigate(1);
  const navigateToPrev = () => navigate(-1);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog?.open && !dialog.contains(document.activeElement)) {
      dialog.querySelector('button')?.focus({ preventScroll: true });
    }
  }, [blockData.block.id]);

  const handleKeyDown = (e: KeyboardEvent) => {
    // Native modal focus and keys belong to this dialog, including when the
    // surrounding mobile Notes panel has its own Escape and Tab handling.
    e.stopPropagation();
    // Don't intercept browser navigation shortcuts (Cmd/Ctrl/Alt + Arrow)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case 'Escape':
        closeBlockOverlay();
        break;
      case 'ArrowLeft':
      case 'j':
        navigateToPrev();
        break;
      case 'ArrowRight':
      case 'k':
        navigateToNext();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const hasPrev = blockData.index > 0;
  const hasNext = blockData.index < allBlocks.length - 1;

  const renderBlockContent = (block: ArenaBlock) => {
    switch (block.__typename) {
      case "Image": {
        const imageBlock = block as ImageBlock;
        // Use CloudFront original URL for instant loading in fullscreen
        const cloudFrontUrl = imageBlock.image_url;
        const thumbnailUrl = imageBlock.resized_image?.grid_cell_resized_image?.src_1x;
        
        if (!cloudFrontUrl && !thumbnailUrl) {
          return (
            <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
              No image available
            </div>
          );
        }

        // Progressive loading: thumbnail preview → CloudFront original
        return <ProgressiveImage key={block.id}
          lowResUrl={thumbnailUrl || cloudFrontUrl!} 
          highResUrl={cloudFrontUrl}
          alt={imageBlock.title || "Arena image"} 
        />;
      }

      case "Text": {
        const textBlock = block as TextBlock;
        return (
          <div className="max-w-4xl mx-auto text-white text-lg leading-relaxed">
            {textBlock.content ? (
              <div 
                // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
                dangerouslySetInnerHTML={{ __html: sanitizeReadableHtml(textBlock.content) }}
              />
            ) : (
              <p className="text-white italic">No text content</p>
            )}
          </div>
        );
      }

      case "Link": {
        const linkBlock = block as LinkBlock;
        // Prefer CloudFront original, fallback to display size (1200x1200)
        const imageUrl = linkBlock.image_url || linkBlock.resized_image?.grid_cell_resized_image?.src_2x;
        const sourceUrl = parseArenaSourceUrl(linkBlock.source?.url);
        
        return (
          <div className="max-w-4xl mx-auto">
            {imageUrl && (
              <div className="mb-6">
                <img
                  src={imageUrl}
                  alt={linkBlock.title || "Link preview"}
                  className="w-full rounded shadow-lg"
                  loading="eager"
                />
              </div>
            )}
            {sourceUrl && (
              <a
                href={sourceUrl.href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-white hover:text-gray-300 hover:underline text-lg"
              >
                {sourceUrl.hostname}
                <svg className="inline-block w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      }

      case "Embed": {
        const embedBlock = block as EmbedBlock;
        // Prefer CloudFront original, fallback to display size (1200x1200)
        const imageUrl = embedBlock.image_url ||
                        embedBlock.resized_image?.grid_cell_resized_image?.src_2x;
        
        return (
          <div className="max-w-4xl mx-auto">
            {imageUrl && (
              <div className="mb-6">
                <img
                  src={imageUrl}
                  alt={embedBlock.title || "Embed preview"}
                  className="w-full rounded shadow-lg"
                  loading="eager"
                />
              </div>
            )}
            <p className="text-white text-lg">
              {embedBlock.source?.provider_name || "Embed"}
            </p>
          </div>
        );
      }

      case "Attachment": {
        const attachmentBlock = block as AttachmentBlock;
        // Prefer CloudFront original, fallback to display size (1200x1200)
        const imageUrl = attachmentBlock.image_url ||
                        attachmentBlock.resized_image?.grid_cell_resized_image?.src_2x;
        
        return (
          <div className="max-w-4xl mx-auto">
            {imageUrl ? (
              <div className="mb-6">
                <img
                  src={imageUrl}
                  alt={attachmentBlock.title || "Attachment preview"}
                  className="w-full rounded shadow-lg"
                  loading="eager"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded mb-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">
                    {attachmentBlock.file_extension?.toUpperCase() || "FILE"}
                  </div>
                  {attachmentBlock.file_size && (
                    <div className="text-sm">
                      {(attachmentBlock.file_size / 1024).toFixed(1)}KB
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }

      default:
        return <div className="text-center text-gray-500">Unknown block type</div>;
    }
  };

  return (
    <dialog ref={dialogRef} aria-label={`${channel.title} block viewer`}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black/95 p-0 text-white open:flex open:flex-col backdrop:bg-black/70"
      onKeyDown={handleKeyDown}
      onCancel={event => { event.preventDefault(); closeBlockOverlay(); }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeBlockOverlay();
        }
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 justify-between items-center gap-3 p-4 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={closeBlockOverlay}
            aria-label="Close block viewer"
            className="shrink-0 hover:bg-white/10 p-2 rounded transition-colors"
            title="Close (ESC)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="min-w-0">
            <div className="text-sm text-gray-300">
              {blockData.block.__typename} • {blockData.index + 1} of {allBlocks.length}
            </div>
            <div className="truncate text-lg font-medium" title={channel.title}>
              {channel.title}
            </div>
            <div className="truncate text-sm text-gray-400 mt-1" title={blockData.block.title}>
              {blockData.block.title || "No title"}
            </div>
          </div>
        </div>

        <a
          aria-label="Open block in Are.na"
          href={`https://are.na${blockData.block.href}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 hover:bg-white/10 p-2 rounded transition-colors"
          title="Open in Are.na"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Content */}
      <div key={blockData.block.id} className="min-h-0 flex-1 overflow-auto break-words px-4 py-8 sm:px-12">
        {renderBlockContent(blockData.block)}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex shrink-0 justify-between gap-4 px-4 py-2">
          <button
            onClick={navigateToPrev}
            disabled={!hasPrev}
            aria-label="Previous block"
            className="rounded-full p-3 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Previous block (← or J)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={navigateToNext}
            disabled={!hasNext}
            aria-label="Next block"
            className="rounded-full p-3 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Next block (→ or K)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </dialog>
  );
}
