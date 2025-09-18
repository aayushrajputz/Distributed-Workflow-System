declare module '@tanstack/react-query' {
  export interface QueryClient {
    new(config?: {
      defaultOptions?: {
        queries?: {
          retry?: boolean | number | ((failureCount: number, error: any) => boolean);
          gcTime?: number; // Updated from cacheTime to gcTime for React Query v5
          staleTime?: number;
          refetchOnWindowFocus?: boolean;
          refetchOnMount?: boolean;
          refetchOnReconnect?: boolean;
          enabled?: boolean;
        };
        mutations?: {
          retry?: boolean | number | ((failureCount: number, error: any) => boolean);
          gcTime?: number;
        };
      };
    }): QueryClient;
    
    // QueryClient methods
    invalidateQueries: (filters?: any) => Promise<void>;
    setQueryData: (queryKey: any, data: any) => void;
    getQueryData: (queryKey: any) => any;
    removeQueries: (filters?: any) => void;
    clear: () => void;
    mount: () => void;
    unmount: () => void;
  }

  export interface QueryClientProviderProps {
    client: QueryClient;
    children: React.ReactNode;
  }

  export interface UseQueryResult<TData = unknown, TError = unknown> {
    data: TData | undefined;
    error: TError | null;
    isError: boolean;
    isLoading: boolean;
    isSuccess: boolean;
    isFetching: boolean;
    isPending: boolean;
    status: 'pending' | 'error' | 'success';
    fetchStatus: 'fetching' | 'paused' | 'idle';
    refetch: () => Promise<any>;
  }

  export interface UseMutationResult<TData = unknown, TError = unknown, TVariables = void> {
    data: TData | undefined;
    error: TError | null;
    isError: boolean;
    isIdle: boolean;
    isPending: boolean;
    isSuccess: boolean;
    status: 'idle' | 'pending' | 'error' | 'success';
    mutate: (variables: TVariables) => void;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    reset: () => void;
  }

  export interface UseQueryOptions<TData = unknown, TError = unknown> {
    queryKey: any[];
    queryFn: () => Promise<TData>;
    enabled?: boolean;
    retry?: boolean | number;
    gcTime?: number;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
    refetchOnMount?: boolean;
    refetchOnReconnect?: boolean;
    select?: (data: any) => TData;
  }

  export interface UseMutationOptions<TData = unknown, TError = unknown, TVariables = void> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: TError, variables: TVariables) => void;
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void;
    retry?: boolean | number;
    gcTime?: number;
  }

  export const QueryClient: new (config?: any) => QueryClient;
  export const QueryClientProvider: React.ComponentType<QueryClientProviderProps>;
  
  export function useQuery<TData = unknown, TError = unknown>(
    options: UseQueryOptions<TData, TError>
  ): UseQueryResult<TData, TError>;
  
  export function useMutation<TData = unknown, TError = unknown, TVariables = void>(
    options: UseMutationOptions<TData, TError, TVariables>
  ): UseMutationResult<TData, TError, TVariables>;
  
  export function useQueryClient(): QueryClient;
  
  export function useInfiniteQuery<TData = unknown, TError = unknown>(
    options: any
  ): UseQueryResult<TData, TError> & {
    fetchNextPage: () => Promise<any>;
    fetchPreviousPage: () => Promise<any>;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    isFetchingNextPage: boolean;
    isFetchingPreviousPage: boolean;
  };
}