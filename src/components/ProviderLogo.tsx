type Provider = 'Bluesky' | 'Margin' | 'Semble';

// Official marks, with original geometry and a shared monochrome UI treatment:
// https://bsky.social/about/support/icons
// https://github.com/paddinglabs/margin/blob/main/web/public/logo.svg
// https://github.com/cosmik-network/semble/blob/main/src/webapp/assets/semble-logo.svg
const marks: Record<Provider, { viewBox: string; paths: string[] }> = {
  Bluesky: {
    viewBox: '0 0 568 501',
    paths: ['M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 -1.61183 568 -28.9064 568 57.9464C568 75.2916 558.055 203.659 552.222 224.501C531.947 296.954 458.067 315.434 392.347 304.249C507.222 323.8 536.444 388.56 473.333 453.32C353.473 576.312 301.061 422.461 287.631 383.039C285.169 375.812 284.017 372.431 284 375.306C283.983 372.431 282.831 375.812 280.369 383.039C266.939 422.461 214.527 576.312 94.6667 453.32C31.5556 388.56 60.7778 323.8 175.653 304.249C109.933 315.434 36.0535 296.954 15.7778 224.501C9.94525 203.659 0 75.2916 0 57.9464C0 -28.9064 76.1345 -1.61183 123.121 33.6637Z'],
  },
  Margin: {
    viewBox: '0 0 265 231',
    paths: ['M0 230 V0 H199 V65.7156 H149.5 V115.216 H182.5 L199 131.716 V230 Z', 'M215 214.224 V230 H264.5 V0 H215 V16.2242 H248.5 V214.224 H215 Z'],
  },
  Semble: {
    viewBox: '0 0 32 43',
    paths: [
      'M31.0164 33.1306C31.0164 38.581 25.7882 42.9994 15.8607 42.9994C5.93311 42.9994 0 37.5236 0 32.0732C0 26.6228 5.93311 23.2617 15.8607 23.2617C25.7882 23.2617 31.0164 27.6802 31.0164 33.1306Z',
      'M25.7295 19.3862C25.7295 22.5007 20.7964 22.2058 15.1558 22.2058C9.51511 22.2058 4.93445 22.1482 4.93445 19.0337C4.93445 15.9192 9.71537 12.6895 15.356 12.6895C20.9967 12.6895 25.7295 16.2717 25.7295 19.3862Z',
      'M25.0246 10.9256C25.0246 14.0401 20.7964 11.9829 15.1557 11.9829C9.51506 11.9829 6.34424 13.6876 6.34424 10.5731C6.34424 7.45857 9.51506 5.63867 15.1557 5.63867C20.7964 5.63867 25.0246 7.81103 25.0246 10.9256Z',
      'M20.4426 3.5755C20.4426 5.8323 18.2088 4.22951 15.2288 4.22951C12.2489 4.22951 10.5737 5.8323 10.5737 3.5755C10.5737 1.31871 12.2489 0 15.2288 0C18.2088 0 20.4426 1.31871 20.4426 3.5755Z',
    ],
  },
};

export function ProviderLogo({ provider, size = 16 }: { provider: Provider; size?: number }) {
  const mark = marks[provider];
  return <svg width={size} height={size} viewBox={mark.viewBox} fill="currentColor" aria-hidden="true" focusable="false" class="shrink-0">
    {mark.paths.map(path => <path key={path} d={path} />)}
  </svg>;
}

/** Use the same marks in the script-free article's shadow DOM. */
export function createProviderLogo(doc: Document, provider: string, size = 14): SVGSVGElement | null {
  if (provider !== 'Bluesky' && provider !== 'Margin' && provider !== 'Semble') return null;
  const mark = marks[provider];
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries({ width: String(size), height: String(size), viewBox: mark.viewBox, fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(name, value);
  for (const data of mark.paths) {
    const path = doc.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', data);
    svg.appendChild(path);
  }
  return svg;
}
