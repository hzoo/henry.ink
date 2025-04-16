/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="@atcute/bluesky/lexicons" />

declare module '*.svg?react' {
    import type { ComponentType, JSX } from 'preact'
    const SVGComponent: ComponentType<JSX.SVGAttributes<SVGSVGElement>>
    export default SVGComponent
  }
  