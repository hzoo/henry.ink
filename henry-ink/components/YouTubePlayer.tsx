interface YouTubePlayerProps {
  videoId: string;
  title?: string;
}

export function YouTubePlayer({ videoId, title }: YouTubePlayerProps) {
  return <div class="w-full min-w-0 max-w-4xl mx-auto p-3 sm:p-4">
    <div class="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={title || `YouTube Video ${videoId}`}
        class="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  </div>;
}
