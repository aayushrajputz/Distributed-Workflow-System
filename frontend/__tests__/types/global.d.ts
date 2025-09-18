declare global {
  namespace NodeJS {
    interface Global {
      ResizeObserver: any;
    }
  }
}

declare module 'jest-canvas-mock';