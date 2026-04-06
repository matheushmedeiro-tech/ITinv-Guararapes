import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const BLANK = { name: "", type: "", origin: "", formatted: false, configured: false, status: "ok", problem_description: "" };

export default function EquipmentModal({ open, item, onClose, onSave, loading, equipmentTypes, problemTypes, origins }) {
  const [form, setForm] = useState(BLANK);
  const nameRef = useRef(null);

  useEffect(() => {
    setForm(item ? { ...BLANK, ...item, problem_description: item.problem_description || "" } : BLANK);
    if (open) setTimeout(() => nameRef.current?.focus(), 80);
  }, [item, open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.type || !form.origin.trim()) return;
    if (form.status === "problem" && !(form.problem_description || "").trim()) return;
    onSave(form);
  };

  const isEdit = !!item?.id;
  const invalid = !form.name.trim() || !form.type || !form.origin.trim() ||
    (form.status === "problem" && !(form.problem_description || "").trim());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEdit ? `Editar: ${item.name}` : "Novo Equipamento"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input ref={nameRef} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Dell OptiPlex 7050" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {equipmentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.emoji} {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Origem *</Label>
              <Select value={form.origin} onValueChange={(v) => set("origin", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {origins.map((o) => (
                    <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="fmt" checked={!!form.formatted} onCheckedChange={(v) => set("formatted", v)} />
              <Label htmlFor="fmt" className="text-sm cursor-pointer">Formatado</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="cfg" checked={!!form.configured} onCheckedChange={(v) => set("configured", v)} />
              <Label htmlFor="cfg" className="text-sm cursor-pointer">Configurado</Label>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Status *</Label>
            <div className="flex gap-2">
              {[["ok", "✓ OK"], ["problem", "⚠ Problema"]].map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { set("status", s); if (s === "ok") set("problem_description", ""); }}
                  className={`flex-1 h-8 rounded-md border text-sm font-medium transition-all
                    ${form.status === s
                      ? s === "ok" ? "bg-emerald-500 text-white border-emerald-500" : "bg-red-500 text-white border-red-500"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/30"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.status === "problem" && (
            <div className="space-y-2">
              <Label className="text-xs">Descrição do Problema *</Label>
              {problemTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {problemTypes.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => set("problem_description", pt.name)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all
                        ${form.problem_description === pt.name
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-card border-border hover:border-red-300 hover:text-red-600"}`}
                    >
                      {pt.name}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                value={form.problem_description}
                onChange={(e) => set("problem_description", e.target.value)}
                placeholder="Descreva o problema ou selecione acima..."
                className="text-sm resize-none h-20"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={invalid || loading} className="min-w-[80px]">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}