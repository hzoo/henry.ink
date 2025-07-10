import { useState, useEffect } from 'preact/hooks';
import type { MatchResult } from '../arena/pattern-matcher';

interface ArenaLinksDisclosureProps {
  content: string;
}

interface ArenaMatch {
  slug: string;
  title: string;
  matchedText: string;
  context: string;
  url: string;
}

export function ArenaLinksDisclosure({ content }: ArenaLinksDisclosureProps) {
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    findArenaMatches();
  }, [content]);

  const findArenaMatches = async () => {
    if (!content) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          options: { maxLinksPerChannel: 1 }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const arenaMatches: ArenaMatch[] = result.matches.map((match: MatchResult) => {
          // Extract context around the match
          const contextStart = Math.max(0, match.bestMatch.position - 50);
          const contextEnd = Math.min(content.length, match.bestMatch.endPosition + 50);
          const context = content.substring(contextStart, contextEnd);
          
          return {
            slug: match.slug,
            title: match.title,
            matchedText: match.bestMatch.matchedText,
            context: context.trim(),
            url: `https://are.na/channels/${match.slug}`
          };
        });
        
        setMatches(arenaMatches);
      }
    } catch (error) {
      console.error('Failed to find Arena matches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div class="text-sm text-gray-500 mb-4">
        🔍 Finding Arena channels...
      </div>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <details class="mb-6 border border-gray-200 rounded-lg" open={isOpen}>
      <summary 
        class="cursor-pointer p-4 bg-gray-50 hover:bg-gray-100 font-medium text-green-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        • {matches.length} arena link{matches.length !== 1 ? 's' : ''}
      </summary>
      
      <div class="p-4 space-y-4">
        {matches.map((match, index) => (
          <div key={`${match.slug}-${index}`} class="border-l-2 border-green-200 pl-4">
            <div class="mb-2">
              <a 
                href={match.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-green-700 hover:text-green-800 font-medium underline"
              >
                {match.title}
              </a>
            </div>
            
            <div class="text-sm text-gray-600">
              <span class="bg-yellow-100 px-1 rounded">"{match.matchedText}"</span>
              {' '}in context:
            </div>
            
            <blockquote class="text-sm text-gray-700 italic mt-1 pl-2 border-l border-gray-300">
              ...{match.context}...
            </blockquote>
          </div>
        ))}
      </div>
    </details>
  );
}