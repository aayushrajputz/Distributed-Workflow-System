import { ReactElement, ReactNode } from 'react';
import { RenderOptions, RenderResult } from '@testing-library/react';

export interface WrapperProps {
  children: ReactNode;
}

export function wrapper({ children }: WrapperProps): ReactElement;

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapper?: (props: WrapperProps) => ReactElement;
}

export interface CustomRenderResult extends RenderResult {
  rerender: (ui: ReactElement) => void;
  user: {
    click: (element: Element | null) => Promise<void>;
    type: (element: Element | null, text: string) => Promise<void>;
  };
}

export function render(
  ui: ReactElement,
  options?: CustomRenderOptions
): CustomRenderResult;

export async function waitForLoadingToFinish(): Promise<void>;