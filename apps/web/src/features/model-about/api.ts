import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

export function useModelCard() {
  return useQuery({
    queryKey: ["model"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/model", { signal })),
    staleTime: Infinity,
  });
}
