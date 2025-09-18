declare module '@testing-library/react' {
  export interface RenderOptions {
    wrapper?: React.ComponentType;
    container?: HTMLElement;
  }

  export interface RenderResult {
    container: HTMLElement;
    baseElement: HTMLElement;
    debug: (baseElement?: HTMLElement | DocumentFragment) => void;
    rerender: (ui: React.ReactElement) => void;
    unmount: () => void;
  }

  export const render: (
    ui: React.ReactElement,
    options?: RenderOptions
  ) => RenderResult;

  export const screen: {
    getByText: (text: RegExp | string) => HTMLElement;
    getByRole: (role: string, options?: { name?: RegExp | string }) => HTMLElement;
    getByLabelText: (label: RegExp | string) => HTMLElement;
    getByTestId: (testId: string) => HTMLElement;
    getByDisplayValue: (value: RegExp | string) => HTMLElement;
    queryByText: (text: RegExp | string) => HTMLElement | null;
    queryByTestId: (testId: string) => HTMLElement | null;
    findByText: (text: RegExp | string) => Promise<HTMLElement>;
    findByTestId: (testId: string) => Promise<HTMLElement>;
  };

  export const waitFor: <T>(
    callback: () => T | Promise<T>,
    options?: { timeout?: number }
  ) => Promise<T>;

  export const waitForElementToBeRemoved: (
    callback: () => HTMLElement | null,
    options?: { timeout?: number }
  ) => Promise<void>;

  export const fireEvent: {
    click: (element: HTMLElement) => void;
    change: (element: HTMLElement, props: { target: { value: string } }) => void;
  };
}

declare module '@testing-library/user-event' {
  export interface UserEvent {
    setup(): void;
    click(element: HTMLElement): Promise<void>;
    type(element: HTMLElement, text: string): Promise<void>;
    keyboard(text: string): Promise<void>;
    clear(element: HTMLElement): Promise<void>;
    selectOptions(element: HTMLElement, values: string[]): Promise<void>;
  }

  const userEvent: {
    setup(): UserEvent;
  };
  export default userEvent;
}

declare module '@testing-library/jest-dom' {
  export {};
}