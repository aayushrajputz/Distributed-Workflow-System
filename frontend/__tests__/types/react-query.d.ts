declare module '@tanstack/react-query' {
  export interface QueryClient {
    new(config?: {
      defaultOptions?: {
        queries?: {
          retry?: boolean | number;
          cacheTime?: number;
          staleTime?: number;
          refetchOnWindowFocus?: boolean;
        };
        mutations?: {
          retry?: boolean | number;
        };
      };
    }): QueryClient;
  }

  export interface QueryClientProviderProps {
    client: QueryClient;
    children: React.ReactNode;
  }

  export const QueryClient: QueryClient;
  export const QueryClientProvider: React.ComponentType<QueryClientProviderProps>;
}