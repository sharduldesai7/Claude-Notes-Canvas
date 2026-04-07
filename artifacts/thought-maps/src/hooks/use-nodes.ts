import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateNode as useGeneratedCreateNode,
  useUpdateNode as useGeneratedUpdateNode,
  useDeleteNode as useGeneratedDeleteNode,
  getGetThoughtMapQueryKey
} from "@workspace/api-client-react";

export function useCreateNode() {
  const queryClient = useQueryClient();
  return useGeneratedCreateNode({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.refetchQueries({ queryKey: getGetThoughtMapQueryKey(variables.mapId) });
      }
    }
  });
}

export function useUpdateNode() {
  const queryClient = useQueryClient();
  return useGeneratedUpdateNode({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetThoughtMapQueryKey(variables.mapId) });
      }
    }
  });
}

export function useDeleteNode() {
  const queryClient = useQueryClient();
  return useGeneratedDeleteNode({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetThoughtMapQueryKey(variables.mapId) });
      }
    }
  });
}
