import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Form changes only after a Grand Prix: a few minutes is fresh enough. */
const FORM = { staleTime: 5 * 60_000 } as const;

/** The driver's last five Grands Prix with the pace gap to the teammate. */
export function useDriverForm(ref: string) {
  return useQuery({
    queryKey: ["driver", ref, "form"],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/drivers/{ref}/form", { params: { path: { ref } }, signal })),
    ...FORM,
  });
}
