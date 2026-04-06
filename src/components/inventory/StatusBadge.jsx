import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatusBadge({ status, size = "default" }) {
  const isOk = status === "ok";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide border",
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
      isOk
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-red-50 text-red-700 border-red-200"
    )}>
      {isOk
        ? <CheckCircle2 className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
        : <AlertTriangle className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
      {isOk ? "OK" : "Problema"}
    </span>
  );
}