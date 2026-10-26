import { readFileSync } from 'node:fs';
import type { ArchiveResponse } from '@/api/archive/routes';

export interface ReaderFixture {
  id: 'custom-styled' | 'bare' | 'legacy';
  name: string;
  url: string;
  archive: ArchiveResponse & { title: string; css: string };
  paragraphs: string[];
  expectedParagraphs: string[];
  expectedEndingParagraphs: [string, string, string];
}

interface FixtureSource {
  id: ReaderFixture['id'];
  name: string;
  title: string;
  css: string;
  bodyAttrs: Record<string, string>;
  openingParagraphs: string[];
  expectedEndingParagraphs: ReaderFixture['expectedEndingParagraphs'];
}

const readFixture = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');

// Entirely synthetic prose. Expectations are literal, not extracted from the HTML.
const sources: FixtureSource[] = [
  {
    id: 'custom-styled',
    name: 'Custom-styled semantic essay',
    title: 'A shelf for shared tools',
    css: readFixture('custom-styled.css'),
    bodyAttrs: { class: 'workshop' },
    openingParagraphs: [
      'On Saturday we moved the shared tools from a locked cupboard to a shelf beside the workbench. The change was small, but it made the room easier to understand: a visitor could see what was available before asking anyone for help.',
      'We painted a quiet outline behind each tool and wrote its name on a paper label. The labels were not instructions for every possible task; they were invitations to begin. A well-used handle told the rest of the story without another sign.',
      'By noon the shelf had acquired a notebook, two spare pencils, and a small tray for loose screws. None of these additions appeared in our original sketch. They arrived because people could now notice what the workbench needed.',
    ],
    expectedEndingParagraphs: [
      "The next morning we left an empty space between the saw and the ruler. A useful arrangement should have room for the next person's idea.",
      'At closing time we counted the tools, wiped the shelf, and returned the notebook to its corner. Keeping a place legible is ordinary work, repeated together.',
      'The final label stayed blank, ready for a tool we had not yet imagined.',
    ],
  },
  {
    id: 'bare',
    name: 'Bare short note without an article wrapper',
    title: 'Rain at the station',
    css: '',
    bodyAttrs: {},
    openingParagraphs: [
      'The station notebook began with a simple observation: rain sounds different under each roof.',
    ],
    expectedEndingParagraphs: [
      'Under the metal awning, every drop made a bright tap. Under the old tree, the sound softened.',
      'We waited for the platform to empty before comparing our notes. Neither description needed a diagram.',
      'When the train arrived, we closed the notebook and kept listening.',
    ],
  },
  {
    id: 'legacy',
    name: 'Legacy table and font layout',
    title: 'The evening bulletin',
    css: '',
    bodyAttrs: { bgcolor: '#ded4b6', text: '#332918', marginwidth: '16' },
    openingParagraphs: [
      'Our bulletin started as a page beside the kettle. Each neighbor added one thing worth sharing.',
    ],
    expectedEndingParagraphs: [
      'Mira listed spare jars, and Sol offered to repair a loose chair leg. The page filled slowly.',
      'We left the last row open for late arrivals. A notice board should never look quite finished.',
      'At dusk, someone added one more chair to the table.',
    ],
  },
];

// API response bodies ready for route interception in Bun/Node browser smoke runners.
export const readerFixtures: ReaderFixture[] = sources.map((fixture) => {
  const url = `https://reader-fixtures.example/${fixture.id}`;
  const expectedParagraphs = [...fixture.openingParagraphs, ...fixture.expectedEndingParagraphs];
  return {
    id: fixture.id,
    name: fixture.name,
    url,
    archive: {
      resolvedUrl: url,
      title: fixture.title,
      html: readFixture(`${fixture.id}.html`),
      css: fixture.css,
      textContent: expectedParagraphs.join('\n\n'),
      htmlAttrs: { lang: 'en' },
      bodyAttrs: fixture.bodyAttrs,
    },
    paragraphs: expectedParagraphs,
    expectedParagraphs,
    expectedEndingParagraphs: fixture.expectedEndingParagraphs,
  };
});
