declare module 'ini' {
  interface ParseOptions {
    // kept empty; ini typings are simple for our usage
  }
  export function parse(input: string): any
}


