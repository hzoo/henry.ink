import { SaxesParser } from 'saxes';
import type { TranscriptResponse } from '@/src/lib/youtube-transcript-types';
import { blockedError, TranscriptError, upstreamError } from '@/api/youtube/errors';

// A balanced object does not depend on YouTube's JSON property order or whitespace.
export function playerField(html: string, field: 'captions' | 'playabilityStatus'): any {
  const match = new RegExp(`"${field}"\\s*:\\s*`).exec(html);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  if (html.slice(start, start + 4) === 'null') return null;
  if (html[start] !== '{') throw upstreamError();
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { throw upstreamError(); }
    }
  }
  throw upstreamError();
}

export function checkPlayability(playability: any, html = ''): void {
  const reason = typeof playability?.reason === 'string' ? playability.reason : '';
  if (/g-recaptcha|unusual traffic/i.test(html) || /not a bot|unusual traffic/i.test(reason)) {
    throw blockedError();
  }
  if (playability?.status && playability.status !== 'OK') {
    if (['ERROR', 'UNPLAYABLE', 'LOGIN_REQUIRED', 'LIVE_STREAM_OFFLINE', 'AGE_CHECK_REQUIRED', 'CONTENT_CHECK_REQUIRED'].includes(playability.status)) {
      throw new TranscriptError('video_unavailable', 404, 'This video is not available to the transcript server.');
    }
    throw upstreamError();
  }
}

export function parseTranscript(body: string, lang: string): TranscriptResponse[] {
  if (!body.trim()) return [];
  const result: TranscriptResponse[] = [];
  const timing = (value: unknown, scale: number): number => {
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') throw upstreamError();
    const number = Number(value) / scale;
    if (!Number.isFinite(number) || number < 0) throw upstreamError();
    return number;
  };
  try {
    if (body.trimStart().startsWith('{')) {
      const json = JSON.parse(body);
      if (!Array.isArray(json.events)) throw upstreamError();
      for (const event of json.events) {
        if (!event || typeof event !== 'object') throw upstreamError();
        if (event.segs === undefined) continue; // JSON3 window/style events have no text.
        if (!Array.isArray(event.segs) || !event.segs.every((s: any) => typeof s?.utf8 === 'string')) throw upstreamError();
        const text = event.segs.map((s: { utf8: string }) => s.utf8).join('');
        if (text.trim()) result.push({ text, offset: timing(event.tStartMs, 1000), duration: timing(event.dDurationMs, 1000), lang });
      }
      return result;
    }
    // Use the API's existing XML parser, not regexes that drop nested text/entities.
    const parser = new SaxesParser({ xmlns: false, position: false });
    let root = '', depth = 0, segmentDepth = 0;
    let segment: TranscriptResponse | undefined;
    parser.on('doctype', () => { throw upstreamError(); });
    parser.on('opentag', tag => {
      depth++;
      if (depth === 1) {
        root = tag.name;
        if (!['transcript', 'timedtext'].includes(root)) throw upstreamError();
      }
      if ((root === 'transcript' && tag.name === 'text') || (root === 'timedtext' && tag.name === 'p')) {
        if (segment) throw upstreamError();
        const legacy = root === 'transcript';
        segmentDepth = depth;
        segment = { text: '', offset: timing(tag.attributes[legacy ? 'start' : 't'], legacy ? 1 : 1000),
          duration: timing(tag.attributes[legacy ? 'dur' : 'd'], legacy ? 1 : 1000), lang };
      } else if (segment && tag.name === 'br') segment.text += '\n';
    });
    const append = (text: string) => { if (segment) segment.text += text; };
    parser.on('text', append);
    parser.on('cdata', append);
    parser.on('closetag', () => {
      if (segment && depth === segmentDepth) {
        if (segment.text.trim()) result.push(segment);
        segment = undefined;
      }
      depth--;
    });
    parser.write(body).close();
    return result;
  } catch { throw upstreamError(); }
}
