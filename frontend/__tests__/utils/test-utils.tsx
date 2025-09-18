import { render as rtlRender } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, type ComponentType } from 'react';
import { type RenderOptions, type RenderResult } from '@testing-library/react';

// Re-export everything
export * from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client with specific test configuration
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const Providers = ({ children }: { children: React.ReactNode }) => {
  const testQueryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

type ExtendedRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  wrapper?: ComponentType;
};

function render(
  ui: ReactElement,
  options: ExtendedRenderOptions = {}
) {
  const rendered = rtlRender(ui, {
    wrapper: Providers as ComponentType,
    ...options,
  });

  return {
    ...rendered,
    user: userEvent.setup(),
  };
}

export { render };