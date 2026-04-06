import { useState, useRef } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function QuickAddBar({ onAdd, loading, equipmentTypes, origins }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [origin, setOrigin] = useState("");
  const nameRef = useRef(null);

  const canSubmit = name.trim() && type && origin.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    await onAdd({ name: name.trim(), type, origin: origin.trim(), formatted: false, configured: false, status: "ok" });
    setName("");
    setOrigin("");
    setType("");
    nameRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-dashed border-primary/40 rounded-xl p-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Adicionar Rápido
        </div>
        <Input
          ref={nameRef}
          placeholder="Nome do equipamento..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm flex-1 min-w-[140px] max-w-xs"
          autoComplete="off"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 text-sm w-[140px]">
            <SelectValue placeholder="Tipo..." />
          </SelectTrigger>
          <SelectContent>
            {equipmentTypes.map((t) => (
              <SelectItem key={t.id} value={t.name}>
                {t.emoji} {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger className="h-8 text-sm w-[140px]">
            <SelectValue placeholder="Origem..." />
          </SelectTrigger>
          <SelectContent>
            {origins.map((o) => (
              <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" className="h-8 px-4 shrink-0" disabled={!canSubmit || loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adicionar"}
        </Button>
        <p className="text-xs text-muted-foreground hidden lg:block">Enter para adicionar</p>
      </div>
    </form>
  );
}