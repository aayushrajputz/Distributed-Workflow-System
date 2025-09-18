/// <reference types="jest" />

declare namespace jest {
  interface Global extends NodeJS.Global {
    ResizeObserver: any;
  }
}