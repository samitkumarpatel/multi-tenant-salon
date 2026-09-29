import type { AiPolishResponse } from "@salon/ui-shared";
import { useParams } from "react-router";
import type { ReactNode } from "react";
import { AiPolishButton } from "@salon/ui-shared";
import { ADMIN_API, apiFetch, resolveSalonUUID } from "~/lib/api";

export function FixWithAi({ value, onApply, children }: { value: string; onApply: (text: string) => void; children: ReactNode }) {
  const { salonId } = useParams();
  return <AiPolishButton value={value} onApply={onApply} polish={async (text) => {
    const sid = await resolveSalonUUID(salonId!);
    return apiFetch<AiPolishResponse>(`${ADMIN_API}/${sid}/ai/polish`, {
      method: "POST", body: JSON.stringify({ text }),
    });
  }}>{children}</AiPolishButton>;
}
