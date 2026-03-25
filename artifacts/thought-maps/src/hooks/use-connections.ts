import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateConnection as useGeneratedCreateConnection,
  useDeleteConnection as useGeneratedDeleteConnection,
  getGetThoughtMapQueryKey
} from "@workspace/api-client-react";

export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useGeneratedCreateConnection({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetThoughtMapQueryKey(variables.mapId) });
      }
    }
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useGeneratedDeleteConnection({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetThoughtMapQueryKey(variables.mapId) });
      }
    }
  });
}
