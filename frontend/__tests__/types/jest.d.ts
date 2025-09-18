/// <reference types="jest" />

declare global {
  namespace jest {
    interface Matchers<R> {
      // Custom Jest matchers can be added here
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toHaveClass(className: string): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveValue(value: string | number): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeChecked(): R;
      toHaveFocus(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toBeInvalid(): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
      toHaveAccessibleName(text?: string | RegExp): R;
      toHaveFormValues(expectedValues: Record<string, any>): R;
      toHaveErrorMessage(text?: string | RegExp): R;
      toBePartiallyChecked(): R;
      toBeEmptyDOMElement(): R;
    }

    interface Mock<T = any, Y extends any[] = any> {
      new (...args: Y): T;
      (...args: Y): T;
      mockClear(): this;
      mockReset(): this;
      mockRestore(): void;
      mockImplementation(fn?: (...args: Y) => T): this;
      mockImplementationOnce(fn?: (...args: Y) => T): this;
      mockName(name: string): this;
      mockReturnThis(): this;
      mockReturnValue(value: T): this;
      mockReturnValueOnce(value: T): this;
      mockResolvedValue(value: Awaited<T>): this;
      mockResolvedValueOnce(value: Awaited<T>): this;
      mockRejectedValue(value: any): this;
      mockRejectedValueOnce(value: any): this;
      getMockName(): string;
      mock: MockContext<T, Y>;
    }

    interface MockContext<T, Y extends any[]> {
      calls: Y[];
      instances: T[];
      invocationCallOrder: number[];
      results: Array<{
        type: 'return' | 'throw' | 'incomplete';
        value: T;
      }>;
      lastCall?: Y;
    }

    interface SpyInstance<T = any, Y extends any[] = any> extends Mock<T, Y> {}

    interface MockedFunction<T extends (...args: any[]) => any> extends Mock<ReturnType<T>, Parameters<T>> {
      new (...args: Parameters<T>): ReturnType<T>;
      (...args: Parameters<T>): ReturnType<T>;
    }

    interface MockedClass<T extends new (...args: any[]) => any> extends Mock<InstanceType<T>, ConstructorParameters<T>> {
      new (...args: ConstructorParameters<T>): InstanceType<T>;
      (...args: ConstructorParameters<T>): InstanceType<T>;
    }

    interface MockedObject<T extends object> {
      [K in keyof T]: T[K] extends (...args: any[]) => any
        ? MockedFunction<T[K]>
        : T[K] extends new (...args: any[]) => any
        ? MockedClass<T[K]>
        : T[K] extends object
        ? MockedObject<T[K]>
        : T[K];
    }
  }

  // Jest globals
  declare const describe: {
    (name: string, fn: () => void): void;
    each<T extends readonly any[] | readonly [any, ...any[]]>(
      table: T
    ): (name: string, fn: (...args: T[number][]) => void) => void;
    only: typeof describe;
    skip: typeof describe;
    todo: (name: string) => void;
  };

  declare const it: {
    (name: string, fn?: () => void | Promise<void>, timeout?: number): void;
    each<T extends readonly any[] | readonly [any, ...any[]]>(
      table: T
    ): (name: string, fn: (...args: T[number][]) => void | Promise<void>, timeout?: number) => void;
    only: typeof it;
    skip: typeof it;
    todo: (name: string) => void;
    concurrent: typeof it;
  };

  declare const test: typeof it;

  declare const beforeAll: (fn: () => void | Promise<void>, timeout?: number) => void;
  declare const beforeEach: (fn: () => void | Promise<void>, timeout?: number) => void;
  declare const afterAll: (fn: () => void | Promise<void>, timeout?: number) => void;
  declare const afterEach: (fn: () => void | Promise<void>, timeout?: number) => void;

  declare const expect: {
    <T = any>(actual: T): jest.Matchers<void> & Inverse<jest.Matchers<void>> & PromiseLike<T>;
    extend(matchers: Record<string, any>): void;
    anything(): any;
    any(constructor: any): any;
    arrayContaining<E = any>(sample: readonly E[]): any;
    objectContaining<E = {}>(sample: E): any;
    stringContaining(sample: string): any;
    stringMatching(sample: string | RegExp): any;
    addSnapshotSerializer(serializer: any): void;
    assertions(num: number): void;
    hasAssertions(): void;
    not: {
      arrayContaining<E = any>(sample: readonly E[]): any;
      objectContaining<E = {}>(sample: E): any;
      stringContaining(sample: string): any;
      stringMatching(sample: string | RegExp): any;
    };
  };

  interface Inverse<T> {
    not: T;
  }

  declare namespace jest {
    function fn<T extends (...args: any[]) => any>(implementation?: T): MockedFunction<T>;
    function fn<T = any, Y extends any[] = any>(implementation?: (...args: Y) => T): Mock<T, Y>;

    function spyOn<T extends {}, M extends keyof T>(
      object: T,
      method: M,
      accessType?: 'get' | 'set'
    ): T[M] extends (...args: any[]) => any
      ? SpyInstance<ReturnType<T[M]>, Parameters<T[M]>>
      : SpyInstance<T[M], []>;

    function clearAllMocks(): void;
    function resetAllMocks(): void;
    function restoreAllMocks(): void;

    function useFakeTimers(config?: {
      advanceTimers?: boolean | number;
      doNotFake?: string[];
      now?: number | Date;
      timerLimit?: number;
      legacyFakeTimers?: boolean;
    }): void;
    function useRealTimers(): void;
    function runAllTimers(): void;
    function runOnlyPendingTimers(): void;
    function advanceTimersByTime(msToRun: number): void;
    function runAllTicks(): void;
    function runAllImmediates(): void;

    function setTimeout(timeout: number): void;
    function retryTimes(numRetries: number): void;

    const setTimeout: typeof global.setTimeout;
    const clearTimeout: typeof global.clearTimeout;
    const setInterval: typeof global.setInterval;
    const clearInterval: typeof global.clearInterval;
    const setImmediate: typeof global.setImmediate;
    const clearImmediate: typeof global.clearImmediate;
  }
}

export {};