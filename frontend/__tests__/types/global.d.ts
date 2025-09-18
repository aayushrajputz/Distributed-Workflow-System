declare global {
  namespace NodeJS {
    interface Global {
      ResizeObserver: any;
      IntersectionObserver: any;
      MutationObserver: any;
      fetch: any;
    }
  }

  // Window object extensions for testing
  interface Window {
    ResizeObserver: any;
    IntersectionObserver: any;
    MutationObserver: any;
    matchMedia: (query: string) => MediaQueryList;
    localStorage: Storage;
    sessionStorage: Storage;
    location: Location;
    history: History;
    navigator: Navigator;
    document: Document;
    HTMLCanvasElement: {
      prototype: HTMLCanvasElement;
      new(): HTMLCanvasElement;
    };
    CanvasRenderingContext2D: {
      prototype: CanvasRenderingContext2D;
      new(): CanvasRenderingContext2D;
    };
    WebGLRenderingContext: any;
    AudioContext: any;
    webkitAudioContext: any;
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame: (handle: number) => void;
    requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback: (handle: number) => void;
    crypto: Crypto;
    performance: Performance;
    URL: typeof URL;
    URLSearchParams: typeof URLSearchParams;
    Blob: typeof Blob;
    File: typeof File;
    FileReader: typeof FileReader;
    FormData: typeof FormData;
    Headers: typeof Headers;
    Request: typeof Request;
    Response: typeof Response;
    AbortController: typeof AbortController;
    AbortSignal: typeof AbortSignal;
    CustomEvent: typeof CustomEvent;
    Event: typeof Event;
    EventTarget: typeof EventTarget;
    MessageEvent: typeof MessageEvent;
    ProgressEvent: typeof ProgressEvent;
    WebSocket: typeof WebSocket;
    Worker: typeof Worker;
    SharedWorker: typeof SharedWorker;
    ServiceWorker: any;
    ServiceWorkerRegistration: any;
    Notification: typeof Notification;
    PushManager: any;
    PushSubscription: any;
    MediaDevices: any;
    MediaStream: any;
    MediaStreamTrack: any;
    RTCPeerConnection: any;
    RTCDataChannel: any;
    RTCSessionDescription: any;
    RTCIceCandidate: any;
    GeolocationPosition: any;
    GeolocationPositionError: any;
    DeviceOrientationEvent: any;
    DeviceMotionEvent: any;
    TouchEvent: any;
    Touch: any;
    TouchList: any;
    PointerEvent: any;
    WheelEvent: any;
    KeyboardEvent: typeof KeyboardEvent;
    MouseEvent: typeof MouseEvent;
    FocusEvent: typeof FocusEvent;
    InputEvent: any;
    ClipboardEvent: any;
    DragEvent: any;
    DropEvent: any;
    ResizeObserverEntry: any;
    IntersectionObserverEntry: any;
    MutationRecord: any;
  }

  // Storage interface for localStorage/sessionStorage mocking
  interface Storage {
    readonly length: number;
    clear(): void;
    getItem(key: string): string | null;
    key(index: number): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
    [key: string]: any;
  }

  // MediaQueryList interface for matchMedia mocking
  interface MediaQueryList {
    readonly matches: boolean;
    readonly media: string;
    onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null;
    addListener(callback: (this: MediaQueryList, ev: MediaQueryListEvent) => any): void;
    removeListener(callback: (this: MediaQueryList, ev: MediaQueryListEvent) => any): void;
    addEventListener<K extends keyof MediaQueryListEventMap>(
      type: K,
      listener: (this: MediaQueryList, ev: MediaQueryListEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof MediaQueryListEventMap>(
      type: K,
      listener: (this: MediaQueryList, ev: MediaQueryListEventMap[K]) => any,
      options?: boolean | EventListenerOptions
    ): void;
    dispatchEvent(event: Event): boolean;
  }

  interface MediaQueryListEvent extends Event {
    readonly matches: boolean;
    readonly media: string;
  }

  interface MediaQueryListEventMap {
    change: MediaQueryListEvent;
  }

  // Idle callback interfaces
  interface IdleRequestCallback {
    (deadline: IdleDeadline): void;
  }

  interface IdleRequestOptions {
    timeout?: number;
  }

  interface IdleDeadline {
    readonly didTimeout: boolean;
    timeRemaining(): number;
  }

  // Performance interface extensions
  interface Performance {
    now(): number;
    mark(markName: string): void;
    measure(measureName: string, startMark?: string, endMark?: string): void;
    getEntriesByName(name: string, type?: string): PerformanceEntry[];
    getEntriesByType(type: string): PerformanceEntry[];
    clearMarks(markName?: string): void;
    clearMeasures(measureName?: string): void;
  }

  // Crypto interface for testing
  interface Crypto {
    readonly subtle: SubtleCrypto;
    getRandomValues<T extends ArrayBufferView | null>(array: T): T;
    randomUUID(): string;
  }

  // Console interface extensions
  interface Console {
    assert(condition?: boolean, ...data: any[]): void;
    clear(): void;
    count(label?: string): void;
    countReset(label?: string): void;
    debug(...data: any[]): void;
    dir(item?: any, options?: any): void;
    dirxml(...data: any[]): void;
    error(...data: any[]): void;
    group(...data: any[]): void;
    groupCollapsed(...data: any[]): void;
    groupEnd(): void;
    info(...data: any[]): void;
    log(...data: any[]): void;
    table(tabularData?: any, properties?: string[]): void;
    time(label?: string): void;
    timeEnd(label?: string): void;
    timeLog(label?: string, ...data: any[]): void;
    timeStamp(label?: string): void;
    trace(...data: any[]): void;
    warn(...data: any[]): void;
  }

  // Process interface for Node.js globals in tests
  namespace NodeJS {
    interface Process {
      env: ProcessEnv;
      version: string;
      versions: ProcessVersions;
      platform: Platform;
      arch: string;
      pid: number;
      ppid: number;
      title: string;
      argv: string[];
      argv0: string;
      execArgv: string[];
      execPath: string;
      cwd(): string;
      chdir(directory: string): void;
      umask(): number;
      umask(mask: string | number): number;
      uptime(): number;
      hrtime: HRTime;
      memoryUsage(): MemoryUsage;
      cpuUsage(previousValue?: CpuUsage): CpuUsage;
      nextTick(callback: Function, ...args: any[]): void;
      exit(code?: number): never;
      kill(pid: number, signal?: string | number): boolean;
    }

    interface ProcessEnv {
      [key: string]: string | undefined;
    }

    interface ProcessVersions {
      http_parser: string;
      node: string;
      v8: string;
      ares: string;
      uv: string;
      zlib: string;
      modules: string;
      openssl: string;
    }

    interface MemoryUsage {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    }

    interface CpuUsage {
      user: number;
      system: number;
    }

    interface HRTime {
      (time?: [number, number]): [number, number];
      bigint(): bigint;
    }

    type Platform = 'aix' | 'android' | 'darwin' | 'freebsd' | 'haiku' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd';
  }

  // Buffer interface for Node.js
  interface Buffer extends Uint8Array {
    constructor: typeof Buffer;
    write(string: string, encoding?: BufferEncoding): number;
    write(string: string, offset: number, encoding?: BufferEncoding): number;
    write(string: string, offset: number, length: number, encoding?: BufferEncoding): number;
    toString(encoding?: BufferEncoding, start?: number, end?: number): string;
    toJSON(): { type: 'Buffer'; data: number[] };
    equals(otherBuffer: Uint8Array): boolean;
    compare(target: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
    copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): Buffer;
    subarray(start?: number, end?: number): Buffer;
    writeBigInt64BE(value: bigint, offset?: number): number;
    writeBigInt64LE(value: bigint, offset?: number): number;
    writeBigUInt64BE(value: bigint, offset?: number): number;
    writeBigUInt64LE(value: bigint, offset?: number): number;
    writeIntBE(value: number, offset: number, byteLength: number): number;
    writeIntLE(value: number, offset: number, byteLength: number): number;
    writeUIntBE(value: number, offset: number, byteLength: number): number;
    writeUIntLE(value: number, offset: number, byteLength: number): number;
    writeInt8(value: number, offset?: number): number;
    writeInt16BE(value: number, offset?: number): number;
    writeInt16LE(value: number, offset?: number): number;
    writeInt32BE(value: number, offset?: number): number;
    writeInt32LE(value: number, offset?: number): number;
    writeUInt8(value: number, offset?: number): number;
    writeUInt16BE(value: number, offset?: number): number;
    writeUInt16LE(value: number, offset?: number): number;
    writeUInt32BE(value: number, offset?: number): number;
    writeUInt32LE(value: number, offset?: number): number;
    writeFloatBE(value: number, offset?: number): number;
    writeFloatLE(value: number, offset?: number): number;
    writeDoubleBE(value: number, offset?: number): number;
    writeDoubleLE(value: number, offset?: number): number;
    readBigInt64BE(offset?: number): bigint;
    readBigInt64LE(offset?: number): bigint;
    readBigUInt64BE(offset?: number): bigint;
    readBigUInt64LE(offset?: number): bigint;
    readIntBE(offset: number, byteLength: number): number;
    readIntLE(offset: number, byteLength: number): number;
    readUIntBE(offset: number, byteLength: number): number;
    readUIntLE(offset: number, byteLength: number): number;
    readInt8(offset?: number): number;
    readInt16BE(offset?: number): number;
    readInt16LE(offset?: number): number;
    readInt32BE(offset?: number): number;
    readInt32LE(offset?: number): number;
    readUInt8(offset?: number): number;
    readUInt16BE(offset?: number): number;
    readUInt16LE(offset?: number): number;
    readUInt32BE(offset?: number): number;
    readUInt32LE(offset?: number): number;
    readFloatBE(offset?: number): number;
    readFloatLE(offset?: number): number;
    readDoubleBE(offset?: number): number;
    readDoubleLE(offset?: number): number;
    reverse(): this;
    swap16(): Buffer;
    swap32(): Buffer;
    swap64(): Buffer;
    indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: BufferEncoding): number;
    lastIndexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: BufferEncoding): number;
    includes(value: string | number | Buffer, byteOffset?: number, encoding?: BufferEncoding): boolean;
    keys(): IterableIterator<number>;
    values(): IterableIterator<number>;
    entries(): IterableIterator<[number, number]>;
  }

  type BufferEncoding = 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex';

  const Buffer: {
    new (size: number): Buffer;
    new (array: Uint8Array): Buffer;
    new (arrayBuffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): Buffer;
    new (data: ReadonlyArray<any>): Buffer;
    new (data: Uint8Array): Buffer;
    new (str: string, encoding?: BufferEncoding): Buffer;
    prototype: Buffer;
    from(arrayBuffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): Buffer;
    from(data: ReadonlyArray<any>): Buffer;
    from(data: Uint8Array): Buffer;
    from(str: string, encoding?: BufferEncoding): Buffer;
    of(...items: number[]): Buffer;
    isBuffer(obj: any): obj is Buffer;
    isEncoding(encoding: string): encoding is BufferEncoding;
    byteLength(string: string | NodeJS.ArrayBufferView | ArrayBuffer | SharedArrayBuffer, encoding?: BufferEncoding): number;
    concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
    compare(buf1: Uint8Array, buf2: Uint8Array): number;
    alloc(size: number, fill?: string | Buffer | number, encoding?: BufferEncoding): Buffer;
    allocUnsafe(size: number): Buffer;
    allocUnsafeSlow(size: number): Buffer;
    poolSize: number;
  };

  const global: typeof globalThis;
  const process: NodeJS.Process;
  const console: Console;
  const __filename: string;
  const __dirname: string;
  const require: NodeRequire;
  const module: NodeModule;
  const exports: any;
  const setTimeout: typeof global.setTimeout;
  const clearTimeout: typeof global.clearTimeout;
  const setInterval: typeof global.setInterval;
  const clearInterval: typeof global.clearInterval;
  const setImmediate: (callback: (...args: any[]) => void, ...args: any[]) => NodeJS.Immediate;
  const clearImmediate: (immediateId: NodeJS.Immediate) => void;
}

// Module declarations for testing libraries and utilities
declare module 'jest-canvas-mock' {
  const jestCanvasMock: any;
  export = jestCanvasMock;
}

declare module 'resize-observer-polyfill' {
  class ResizeObserver {
    constructor(callback: ResizeObserverCallback);
    observe(target: Element, options?: ResizeObserverOptions): void;
    unobserve(target: Element): void;
    disconnect(): void;
  }
  export = ResizeObserver;
}

declare module 'jest-canvas-mock';