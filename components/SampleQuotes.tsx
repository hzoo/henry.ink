const quotes = [
  {
    text: "People need new tools to work with rather than new tools that work for them.",
    author: "Ivan Illich, Tools for Conviviality (1973)",
  },
  {
    text: "In a consumer society there are inevitably two kinds of slaves: the prisoners of addiction and the prisoners of envy.",
    author: "Ivan Illich, Tools for Conviviality (1973)",
  },
  {
    text: "Most learning is not the result of instruction. It is rather the result of unhampered participation in a meaningful setting.",
    author: "Ivan Illich, Deschooling Society (1971)",
  },
  {
    text: "Silence, according to western and eastern tradition alike, is necessary for the emergence of persons.",
    author: "Ivan Illich, Silence is a Commons (1982)",
  },
  {
    text: "Learned and leisured hospitality is the only antidote to the stance of deadly cleverness that is acquired in the professional pursuit of objectively secured knowledge.",
    author: "Ivan Illich, The Cultivation of Conspiracy (1998)"
  }
];

export function SampleQuotes() {
  return (
    <div class="mt-4 p-4 border rounded dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 text-sm text-gray-700 dark:text-gray-300 space-y-3">
      <p class="mt-3 text-xs text-amber-500">Try selecting any part of this text to see the "Quote" popup appear.</p>
      {quotes.map((quote) => (
        <blockquote key={quote.text} class="border-l-4 border-gray-300 dark:border-gray-600 pl-3 italic">
          <p>"{quote.text}"</p>
          <footer class="text-xs text-gray-500 dark:text-gray-400 mt-1">- {quote.author}</footer>
        </blockquote>
      ))}
    </div>
  );
} 