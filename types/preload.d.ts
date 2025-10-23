export {}

import type { PreloadApi } from '@main/preload'

declare global {
  interface Window {
    cloudpass: PreloadApi
  }
  namespace JSX {
    interface IntrinsicElements {
      'dotlottie-wc': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        autoplay?: boolean | string
        loop?: boolean | string
        speed?: number | string
        data?: string
        segment?: string
        mode?: string
        'background-color'?: string
        'render-config'?: string
        style?: React.CSSProperties
      }
    }
  }
}

