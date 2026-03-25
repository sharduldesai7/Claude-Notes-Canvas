import { useQueryClient } from "@tanstack/react-query";
import { 
  useListThoughtMaps as useGeneratedListMap,
  useCreateThoughtMap as useGeneratedCreateMap,
  useGetThoughtMap as useGeneratedGetMap,
  useUpdateThoughtMap as useGeneratedUpdateMap,
  useDeleteThoughtMap as useGeneratedDeleteMap,
  getListThoughtMapsQueryKey,
  getGetThoughtMapQueryKey
} from "@workspace/api-client-react";

export function useThoughtMaps() {
  return useGeneratedListMap();
}

export function useThoughtMap(id: number | null) {
  return useGeneratedGetMap(id as number, { query: { enabled: !!id } });
}

export function useCreateThoughtMap() {
  const queryClient = useQueryClient();
  return useGeneratedCreateMap({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListThoughtMapsQueryKey() });
      }
    }
  });
}

export function useUpdateThoughtMap() {
  const queryClient = useQueryClient();
  return useGeneratedUpdateMap({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListThoughtMapsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetThoughtMapQueryKey(data.id) });
      }
    }
  });
}

export function useDeleteThoughtMap() {
  const queryClient = useQueryClient();
  return useGeneratedDeleteMap({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListThoughtMapsQueryKey() });
      }
    }
  });
}
