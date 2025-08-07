import { useEffect, useRef, useState } from "preact/hooks";
import { useQuery } from "@tanstack/react-query";
import { 
  arenaUrlState,
  closeBlockOverlay,
  locationSignal
} from "@/src/lib/arena-navigation";
import { fetchChannelBlocks, arenaQueryKeys } from "@/src/lib/arena-api";
import type { ArenaBlock, ImageBlock, TextBlock, LinkBlock, EmbedBlock, AttachmentBlock } from "@/src/lib/arena-types";

interface ProgressiveImageProps {
  lowResUrl: string;
  highResUrl?: string;
  alt: string;
}

function ProgressiveImage({ lowResUrl, highResUrl, alt }: ProgressiveImageProps) {
  const [currentImageUrl, setCurrentImageUrl] = useState(lowResUrl);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);

  useEffect(() => {
    if (!highResUrl) return;

    // Preload high resolution image
    const highResImage = new Image();
    highResImage.onload = () => {
      setCurrentImageUrl(highResUrl);
      setIsHighResLoaded(true);
    };
    highResImage.src = highResUrl;
  }, [highResUrl]);

  return (
    <div className="flex justify-center">
      <img
        src={currentImageUrl}
        alt={alt}
        className={`max-w-full max-h-[80vh] object-contain rounded shadow-lg transition-opacity duration-300 ${
          !isHighResLoaded && highResUrl ? 'opacity-90' : 'opacity-100'
        }`}
        loading="eager"
      />
    </div>
  );
}

export function BlockViewerOverlay() {
  const urlState = arenaUrlState.value;

  // Only show overlay if we have both channel and block in URL
  if (!urlState.channelSlug || !urlState.blockId) {
    return null;
  }

  // Fetch channel data directly (same as ArenaChannelView)
  const { data: channelData, isLoading } = useQuery({
    queryKey: arenaQueryKeys.blocks(urlState.channelSlug, 24, 1),
    queryFn: () => fetchChannelBlocks(urlState.channelSlug!, 24, 1),
    enabled: !!urlState.channelSlug,
    staleTime: 10 * 60 * 1000,
  });

  // Don't show overlay while data is loading
  if (isLoading || !channelData) {
    return null;
  }

  const allBlocks = channelData.blocks;
  const blockIndex = allBlocks.findIndex(b => b.id === urlState.blockId);
  
  if (blockIndex === -1) {
    return null; // Block not found
  }

  const blockData = { 
    block: allBlocks[blockIndex], 
    index: blockIndex 
  };
  const channel = {
    title: channelData.title,
    slug: urlState.channelSlug
  };

  // Navigation functions using fresh state
  const navigateToNext = () => {
    const currentUrlState = arenaUrlState.value; // Get fresh state
    const currentBlockIndex = allBlocks.findIndex(b => b.id === currentUrlState.blockId);
    if (currentBlockIndex >= allBlocks.length - 1) return;
    
    const nextBlock = allBlocks[currentBlockIndex + 1];
    if (nextBlock) {
      const currentPath = window.location.pathname;
      const newUrl = `${currentPath}?channel=${currentUrlState.channelSlug}&block=${nextBlock.id}`;
      const searchParams = `?channel=${currentUrlState.channelSlug}&block=${nextBlock.id}`;
      
      window.history.pushState({}, '', newUrl);
      locationSignal.value = searchParams;
    }
  };

  const navigateToPrev = () => {
    const currentUrlState = arenaUrlState.value; // Get fresh state
    const currentBlockIndex = allBlocks.findIndex(b => b.id === currentUrlState.blockId);
    if (currentBlockIndex <= 0) return;
    
    const prevBlock = allBlocks[currentBlockIndex - 1];
    if (prevBlock) {
      const currentPath = window.location.pathname;
      const newUrl = `${currentPath}?channel=${currentUrlState.channelSlug}&block=${prevBlock.id}`;
      const searchParams = `?channel=${currentUrlState.channelSlug}&block=${prevBlock.id}`;
      
      window.history.pushState({}, '', newUrl);
      locationSignal.value = searchParams;
    }
  };

  // Prevent double-firing with a simple flag
  const handlingNavigation = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent double-firing
      if (handlingNavigation.current) return;
      
      // Don't intercept browser navigation shortcuts (Cmd/Ctrl + Arrow)
      if (e.metaKey || e.ctrlKey) return;
      
      let handled = false;
      switch (e.key) {
        case 'Escape':
          closeBlockOverlay();
          handled = true;
          break;
        case 'ArrowLeft':
        case 'j':
          handlingNavigation.current = true;
          navigateToPrev();
          setTimeout(() => { handlingNavigation.current = false; }, 50);
          handled = true;
          break;
        case 'ArrowRight':
        case 'k':
          handlingNavigation.current = true;
          navigateToNext();
          setTimeout(() => { handlingNavigation.current = false; }, 50);
          handled = true;
          break;
      }
      
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // Use capture phase to handle before other listeners
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [navigateToNext, navigateToPrev]);

  const hasPrev = blockData.index > 0;
  const hasNext = blockData.index < allBlocks.length - 1;

  const renderBlockContent = (block: ArenaBlock) => {
    switch (block.__typename) {
      case "Image": {
        const imageBlock = block as ImageBlock;
        const lowResUrl = imageBlock.resized_image?.grid_cell_resized_image?.src_1x;
        const highResUrl = imageBlock.resized_image?.grid_cell_resized_image?.src_2x;
        
        if (!lowResUrl) {
          return (
            <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
              No image available
            </div>
          );
        }

        return <ProgressiveImage lowResUrl={lowResUrl} highResUrl={highResUrl} alt={imageBlock.title || "Arena image"} />;
      }

      case "Text": {
        const textBlock = block as TextBlock;
        return (
          <div className="max-w-4xl mx-auto text-white text-lg leading-relaxed">
            {textBlock.content ? (
              <div 
                // biome-ignore lint/security/noDangerouslySetInnerHtml: content from Arena
                dangerouslySetInnerHTML={{ __html: textBlock.content }}
              />
            ) : (
              <p className="text-white italic">No text content</p>
            )}
          </div>
        );
      }

      case "Link": {
        const linkBlock = block as LinkBlock;
        const imageUrl = linkBlock.resized_image?.grid_cell_resized_image?.src_2x ||
                        linkBlock.resized_image?.grid_cell_resized_image?.src_1x;
        const domain = linkBlock.source?.url ? new URL(linkBlock.source.url).hostname : null;
        
        return (
          <div className="max-w-2xl mx-auto">
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
            {linkBlock.source?.url && (
              <a
                href={linkBlock.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-gray-300 hover:underline text-lg"
              >
                {domain}
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
        const imageUrl = embedBlock.resized_image?.grid_cell_resized_image?.src_2x ||
                        embedBlock.resized_image?.grid_cell_resized_image?.src_1x;
        
        return (
          <div className="max-w-2xl mx-auto">
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
        const imageUrl = attachmentBlock.resized_image?.grid_cell_resized_image?.src_2x ||
                        attachmentBlock.resized_image?.grid_cell_resized_image?.src_1x;
        
        return (
          <div className="max-w-2xl mx-auto">
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
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeBlockOverlay();
        }
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 text-white">
        <div className="flex items-center gap-4">
          <button
            onClick={closeBlockOverlay}
            className="hover:bg-white/10 p-2 rounded transition-colors"
            title="Close (ESC)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div>
            <div className="text-sm text-gray-300">
              {blockData.block.__typename} • {blockData.index + 1} of {allBlocks.length}
            </div>
            <div className="text-lg font-medium">
              {channel.title}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {blockData.block.title || "No title"}
            </div>
          </div>
        </div>

        <a
          href={`https://are.na${blockData.block.href}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-white/10 p-2 rounded transition-colors"
          title="Open in Are.na"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Previous button */}
        {hasPrev && (
          <button
            onClick={navigateToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
            title="Previous block (← or J)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Block content */}
        <div className="max-w-full max-h-full">
          {renderBlockContent(blockData.block)}
        </div>

        {/* Next button */}
        {hasNext && (
          <button
            onClick={navigateToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
            title="Next block (→ or K)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}