declare module '@testing-library/react' {
  export interface RenderOptions {
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
    container?: HTMLElement;
    baseElement?: HTMLElement;
    hydrate?: boolean;
    legacyRoot?: boolean;
  }

  export interface RenderResult {
    container: HTMLElement;
    baseElement: HTMLElement;
    debug: (baseElement?: HTMLElement | DocumentFragment, maxLength?: number) => void;
    rerender: (ui: React.ReactElement) => void;
    unmount: () => void;
    asFragment: () => DocumentFragment;
  }

  export interface RenderHookOptions<TProps = any> {
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
    initialProps?: TProps;
  }

  export interface RenderHookResult<TResult, TProps = any> {
    result: { current: TResult };
    rerender: (newProps?: TProps) => void;
    unmount: () => void;
  }

  export const render: (
    ui: React.ReactElement,
    options?: RenderOptions
  ) => RenderResult;

  export const renderHook: <TResult, TProps = any>(
    hook: (props: TProps) => TResult,
    options?: RenderHookOptions<TProps>
  ) => RenderHookResult<TResult, TProps>;

  export const screen: {
    // Get queries (throw if not found)
    getByText: (text: RegExp | string, options?: any) => HTMLElement;
    getByRole: (role: string, options?: { name?: RegExp | string; [key: string]: any }) => HTMLElement;
    getByLabelText: (label: RegExp | string, options?: any) => HTMLElement;
    getByTestId: (testId: string, options?: any) => HTMLElement;
    getByDisplayValue: (value: RegExp | string, options?: any) => HTMLElement;
    getByPlaceholderText: (text: RegExp | string, options?: any) => HTMLElement;
    getByAltText: (text: RegExp | string, options?: any) => HTMLElement;
    getByTitle: (title: RegExp | string, options?: any) => HTMLElement;
    
    // Get all queries (throw if not found)
    getAllByText: (text: RegExp | string, options?: any) => HTMLElement[];
    getAllByRole: (role: string, options?: any) => HTMLElement[];
    getAllByLabelText: (label: RegExp | string, options?: any) => HTMLElement[];
    getAllByTestId: (testId: string, options?: any) => HTMLElement[];
    getAllByDisplayValue: (value: RegExp | string, options?: any) => HTMLElement[];
    getAllByPlaceholderText: (text: RegExp | string, options?: any) => HTMLElement[];
    getAllByAltText: (text: RegExp | string, options?: any) => HTMLElement[];
    getAllByTitle: (title: RegExp | string, options?: any) => HTMLElement[];
    
    // Query queries (return null if not found)
    queryByText: (text: RegExp | string, options?: any) => HTMLElement | null;
    queryByRole: (role: string, options?: any) => HTMLElement | null;
    queryByLabelText: (label: RegExp | string, options?: any) => HTMLElement | null;
    queryByTestId: (testId: string, options?: any) => HTMLElement | null;
    queryByDisplayValue: (value: RegExp | string, options?: any) => HTMLElement | null;
    queryByPlaceholderText: (text: RegExp | string, options?: any) => HTMLElement | null;
    queryByAltText: (text: RegExp | string, options?: any) => HTMLElement | null;
    queryByTitle: (title: RegExp | string, options?: any) => HTMLElement | null;
    
    // Query all queries (return empty array if not found)
    queryAllByText: (text: RegExp | string, options?: any) => HTMLElement[];
    queryAllByRole: (role: string, options?: any) => HTMLElement[];
    queryAllByLabelText: (label: RegExp | string, options?: any) => HTMLElement[];
    queryAllByTestId: (testId: string, options?: any) => HTMLElement[];
    queryAllByDisplayValue: (value: RegExp | string, options?: any) => HTMLElement[];
    queryAllByPlaceholderText: (text: RegExp | string, options?: any) => HTMLElement[];
    queryAllByAltText: (text: RegExp | string, options?: any) => HTMLElement[];
    queryAllByTitle: (title: RegExp | string, options?: any) => HTMLElement[];
    
    // Find queries (async, throw if not found)
    findByText: (text: RegExp | string, options?: any) => Promise<HTMLElement>;
    findByRole: (role: string, options?: any) => Promise<HTMLElement>;
    findByLabelText: (label: RegExp | string, options?: any) => Promise<HTMLElement>;
    findByTestId: (testId: string, options?: any) => Promise<HTMLElement>;
    findByDisplayValue: (value: RegExp | string, options?: any) => Promise<HTMLElement>;
    findByPlaceholderText: (text: RegExp | string, options?: any) => Promise<HTMLElement>;
    findByAltText: (text: RegExp | string, options?: any) => Promise<HTMLElement>;
    findByTitle: (title: RegExp | string, options?: any) => Promise<HTMLElement>;
    
    // Find all queries (async, throw if not found)
    findAllByText: (text: RegExp | string, options?: any) => Promise<HTMLElement[]>;
    findAllByRole: (role: string, options?: any) => Promise<HTMLElement[]>;
    findAllByLabelText: (label: RegExp | string, options?: any) => Promise<HTMLElement[]>;
    findAllByTestId: (testId: string, options?: any) => Promise<HTMLElement[]>;
    findAllByDisplayValue: (value: RegExp | string, options?: any) => Promise<HTMLElement[]>;
    findAllByPlaceholderText: (text: RegExp | string, options?: any) => Promise<HTMLElement[]>;
    findAllByAltText: (text: RegExp | string, options?: any) => Promise<HTMLElement[]>;
    findAllByTitle: (title: RegExp | string, options?: any) => Promise<HTMLElement[]>;
    
    // Utility methods
    debug: (element?: HTMLElement | DocumentFragment, maxLength?: number) => void;
    logTestingPlaygroundURL: (element?: HTMLElement) => void;
  };

  export const waitFor: <T>(
    callback: () => T | Promise<T>,
    options?: { 
      timeout?: number; 
      interval?: number; 
      onTimeout?: (error: Error) => Error;
      container?: HTMLElement;
      mutationObserverOptions?: MutationObserverInit;
    }
  ) => Promise<T>;

  export const waitForElementToBeRemoved: <T>(
    callback: (() => T) | T,
    options?: { 
      timeout?: number; 
      interval?: number; 
      onTimeout?: (error: Error) => Error;
      container?: HTMLElement;
      mutationObserverOptions?: MutationObserverInit;
    }
  ) => Promise<void>;

  export const act: (callback: () => void | Promise<void>) => Promise<void>;

  export const fireEvent: {
    click: (element: HTMLElement, eventProperties?: any) => void;
    change: (element: HTMLElement, eventProperties?: any) => void;
    input: (element: HTMLElement, eventProperties?: any) => void;
    keyDown: (element: HTMLElement, eventProperties?: any) => void;
    keyUp: (element: HTMLElement, eventProperties?: any) => void;
    keyPress: (element: HTMLElement, eventProperties?: any) => void;
    mouseDown: (element: HTMLElement, eventProperties?: any) => void;
    mouseUp: (element: HTMLElement, eventProperties?: any) => void;
    mouseEnter: (element: HTMLElement, eventProperties?: any) => void;
    mouseLeave: (element: HTMLElement, eventProperties?: any) => void;
    mouseOver: (element: HTMLElement, eventProperties?: any) => void;
    mouseOut: (element: HTMLElement, eventProperties?: any) => void;
    focus: (element: HTMLElement, eventProperties?: any) => void;
    blur: (element: HTMLElement, eventProperties?: any) => void;
    submit: (element: HTMLElement, eventProperties?: any) => void;
    scroll: (element: HTMLElement, eventProperties?: any) => void;
    [key: string]: (element: HTMLElement, eventProperties?: any) => void;
  };

  export const cleanup: () => void;
  export const configure: (options: any) => void;
  export const getDefaultNormalizer: (options?: any) => (text: string) => string;
}

declare module '@testing-library/user-event' {
  export interface UserEventOptions {
    delay?: number;
    skipClick?: boolean;
    skipAutoClose?: boolean;
    initialSelectionStart?: number;
    initialSelectionEnd?: number;
    advanceTimers?: (delay: number) => Promise<void> | void;
    writeToClipboard?: boolean;
    pointerEventsCheck?: 0 | 1 | 2;
    applyAccept?: boolean;
  }

  export interface UserEvent {
    // Convenience APIs
    click(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    dblClick(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    tripleClick(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    hover(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    unhover(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    
    // Keyboard APIs
    type(element: HTMLElement, text: string, options?: UserEventOptions): Promise<void>;
    keyboard(text: string, options?: UserEventOptions): Promise<void>;
    clear(element: HTMLElement): Promise<void>;
    
    // Form APIs
    selectOptions(element: HTMLElement, values: string | string[] | HTMLElement | HTMLElement[], options?: UserEventOptions): Promise<void>;
    deselectOptions(element: HTMLElement, values: string | string[] | HTMLElement | HTMLElement[], options?: UserEventOptions): Promise<void>;
    upload(element: HTMLElement, file: File | File[], options?: UserEventOptions): Promise<void>;
    
    // Clipboard APIs
    copy(options?: UserEventOptions): Promise<void>;
    cut(options?: UserEventOptions): Promise<void>;
    paste(clipboardData?: string | DataTransfer, options?: UserEventOptions): Promise<void>;
    
    // Pointer APIs
    pointer(input: string | Array<{ keys?: string; target?: HTMLElement; coords?: { x: number; y: number } }>, options?: UserEventOptions): Promise<void>;
    
    // Tab API
    tab(options?: { shift?: boolean } & UserEventOptions): Promise<void>;
  }

  export interface UserEventSetupOptions {
    delay?: number;
    document?: Document;
    advanceTimers?: (delay: number) => Promise<void> | void;
    pointerEventsCheck?: 0 | 1 | 2;
    writeToClipboard?: boolean;
    applyAccept?: boolean;
  }

  const userEvent: {
    setup(options?: UserEventSetupOptions): UserEvent;
    
    // Direct APIs (deprecated, use setup() instead)
    click(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    dblClick(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    type(element: HTMLElement, text: string, options?: UserEventOptions): Promise<void>;
    clear(element: HTMLElement): Promise<void>;
    selectOptions(element: HTMLElement, values: string | string[], options?: UserEventOptions): Promise<void>;
    keyboard(text: string, options?: UserEventOptions): Promise<void>;
    upload(element: HTMLElement, file: File | File[], options?: UserEventOptions): Promise<void>;
    hover(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    unhover(element: HTMLElement, options?: UserEventOptions): Promise<void>;
    tab(options?: { shift?: boolean } & UserEventOptions): Promise<void>;
    paste(element: HTMLElement, text: string, options?: UserEventOptions): Promise<void>;
  };
  
  export default userEvent;
}

declare module '@testing-library/jest-dom' {
  export {};
  
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toBeEmptyDOMElement(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toBeChecked(): R;
      toBeFocused(): R;
      toBePartiallyChecked(): R;
      toHaveAccessibleDescription(expectedAccessibleDescription?: string | RegExp): R;
      toHaveAccessibleName(expectedAccessibleName?: string | RegExp): R;
      toHaveAttribute(attr: string, value?: string | RegExp): R;
      toHaveClass(...classNames: string[]): R;
      toHaveFocus(): R;
      toHaveFormValues(expectedValues: Record<string, any>): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveValue(value: string | string[] | number): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveDescription(text?: string | RegExp): R;
      toHaveErrorMessage(text?: string | RegExp): R;
    }
  }
}