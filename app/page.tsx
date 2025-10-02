'use client';
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Upload, Plus, Trash2, Pencil, CheckCircle2, XCircle } from "lucide-react";

// ---------------------- Types ----------------------
type CIOAvailability = "Y" | "N" | "TBD";
type Priority = "High" | "Med" | "Low";
type SponsorYN = "Y" | "N";
type Status = "Da contattare" | "Contattato" | "In valutazione" | "Confermato" | "Declinato";
type Roundtable = "Fixed Income" | "Equity" | "Alternativi" | "";

type Row = {
  id: string;
  sgr: string;
  comms: string;
  email: string;
  phone: string;
  cioName: string;
  cioTitle: string;
  cioAvailability: CIOAvailability;
  priority: Priority;
  primaryTheme: string;
  proposedAngle: string;
  backupAngle: string;
  roundtable: Roundtable;
  secondName: string;
  secondRole: string;
  sponsor: SponsorYN;
  conflict: string;
  proposedTitle: string;
  keyTakeaways: string;
  confDeadline: string;
  abstractDeadline: string;
  bioDeadline: string;
  compliance: string;
  logistics: string;
  status: Status;
  nextAction: string;
  owner: string;
};

type AgendaItem = { time: string; session: string; speaker: string; theme: string; notes: string };

type Brief = { [key: string]: string | boolean };

type Filter = { query: string; theme: string; status: string; priority: string };

type TestResult = { name: string; pass: boolean };

type State = { rows: Row[]; agenda: AgendaItem[]; brief: Brief };

// ---------------------- Constants ----------------------
const THEME_CATEGORIES = [
  "Macro, Inflazione, Geopolitica",
  "Azionario (Globale/EU/USA/EM/Cap)",
  "Obbligazionario (Gov/Corp/Global/Local)",
  "Innovazione & Sostenibilità (ESG)",
  "Mercati Emergenti",
  "Private Markets & Alternativi",
  "Society Trends",
  "Cross-Asset Playbook",
];

const ROUNDTABLES: Roundtable[] = ["Fixed Income", "Equity", "Alternativi"];
const STATUS: Status[] = ["Da contattare", "Contattato", "In valutazione", "Confermato", "Declinato"];
const PRIORITY: Priority[] = ["High", "Med", "Low"];
const STORAGE_KEY = "investors_outlook_2026_dashboard";
const ALL = "__ALL__";

const EMPTY_ROW: Row = {
  id: "",
  sgr: "",
  comms: "",
  email: "",
  phone: "",
  cioName: "",
  cioTitle: "",
  cioAvailability: "TBD",
  priority: "Med",
  primaryTheme: "",
  proposedAngle: "",
  backupAngle: "",
  roundtable: "",
  secondName: "",
  secondRole: "",
  sponsor: "N",
  conflict: "",
  proposedTitle: "",
  keyTakeaways: "",
  confDeadline: "",
  abstractDeadline: "",
  bioDeadline: "",
  compliance: "",
  logistics: "",
  status: "Da contattare",
  nextAction: "",
  owner: "",
};

// ---------------------- Utilities ----------------------
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function saveState(state: State): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function loadState(): State | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      rows: Array.isArray(parsed.rows) ? (parsed.rows as Row[]) : [],
      agenda: Array.isArray(parsed.agenda) ? (parsed.agenda as AgendaItem[]) : [],
      brief: (parsed.brief as Brief) || {},
    };
  } catch {
    return null;
  }
}

function download(filename: string, text: string, mime: string = "application/json"): void {
  const element = document.createElement("a");
  const file = new Blob([text], { type: mime });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function exportCSV(rows: Row[]): string {
  const headers = Object.keys(EMPTY_ROW).filter((k) => k !== "id");
  const escapeCell = (v: unknown) => `"${String(v ?? "").replace(/\"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCell((r as Record<string, unknown>)[h])).join(","));
  }
  return lines.join("\n");
}

function parseCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/(^\"|\"$)/g, ""));
  const out: Row[] = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const obj: Row = { ...EMPTY_ROW, id: uid() };
    headers.forEach((h, idx) => {
      (obj as unknown as Record<string, string>)[h] = (cols[idx] || "").replace(/(^\"|\"$)/g, "");
    });
    out.push(obj);
  }
  return out;
}

// ---------------------- Components ----------------------
function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "green" | "yellow" | "red" | "blue" }) {
  const cls = {
    default: "bg-gray-100 text-gray-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  }[variant] || "bg-gray-100 text-gray-800";
  return <span className={`px-2 py-1 rounded-full text-xs ${cls}`}>{children}</span>;
}

function RowEditor({ initial, onSave, onCancel }: { initial: Row; onSave: (row: Row) => void; onCancel: () => void }) {
  const [row, setRow] = useState<Row>(initial);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label>SGR</Label>
        <Input value={row.sgr} onChange={(e) => setRow({ ...row, sgr: e.target.value })} />
      </div>
      <div>
        <Label>Comms Contact</Label>
        <Input value={row.comms} onChange={(e) => setRow({ ...row, comms: e.target.value })} />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" value={row.email} onChange={(e) => setRow({ ...row, email: e.target.value })} />
      </div>
      <div>
        <Label>Phone</Label>
        <Input value={row.phone} onChange={(e) => setRow({ ...row, phone: e.target.value })} />
      </div>
      <div>
        <Label>CIO (Nome)</Label>
        <Input value={row.cioName} onChange={(e) => setRow({ ...row, cioName: e.target.value })} />
      </div>
      <div>
        <Label>CIO Title</Label>
        <Input value={row.cioTitle} onChange={(e) => setRow({ ...row, cioTitle: e.target.value })} />
      </div>
      <div>
        <Label>Disponibilità CIO</Label>
        <Select value={row.cioAvailability} onValueChange={(v) => setRow({ ...row, cioAvailability: v as CIOAvailability })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona" />
          </SelectTrigger>
          <SelectContent>
            {["Y", "N", "TBD"].map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Priorità</Label>
        <Select value={row.priority} onValueChange={(v) => setRow({ ...row, priority: v as Priority })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Categoria Tema</Label>
        <Select value={row.primaryTheme} onValueChange={(v) => setRow({ ...row, primaryTheme: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona" />
          </SelectTrigger>
          <SelectContent>
            {THEME_CATEGORIES.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Proposed Angle (1-line thesis)</Label>
        <Input value={row.proposedAngle} onChange={(e) => setRow({ ...row, proposedAngle: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Label>Backup Angle</Label>
        <Input value={row.backupAngle} onChange={(e) => setRow({ ...row, backupAngle: e.target.value })} />
      </div>
      <div>
        <Label>Roundtable</Label>
        <Select value={row.roundtable} onValueChange={(v) => setRow({ ...row, roundtable: v as Roundtable })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona" />
          </SelectTrigger>
          <SelectContent>
            {ROUNDTABLES.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Second Speaker</Label>
        <Input value={row.secondName} onChange={(e) => setRow({ ...row, secondName: e.target.value })} />
      </div>
      <div>
        <Label>Second Role</Label>
        <Input value={row.secondRole} onChange={(e) => setRow({ ...row, secondRole: e.target.value })} />
      </div>
      <div>
        <Label>Sponsor? (Y/N)</Label>
        <Select value={row.sponsor} onValueChange={(v) => setRow({ ...row, sponsor: v as SponsorYN })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona" />
          </SelectTrigger>
          <SelectContent>
            {["Y", "N"].map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Conflict Status</Label>
        <Input value={row.conflict} onChange={(e) => setRow({ ...row, conflict: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Label>Titolo 15&apos;</Label>
        <Input value={row.proposedTitle} onChange={(e) => setRow({ ...row, proposedTitle: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Label>3 Key Takeaways</Label>
        <Textarea value={row.keyTakeaways} onChange={(e) => setRow({ ...row, keyTakeaways: e.target.value })} />
      </div>
      <div>
        <Label>Deadline Conferma</Label>
        <Input type="date" value={row.confDeadline} onChange={(e) => setRow({ ...row, confDeadline: e.target.value })} />
      </div>
      <div>
        <Label>Deadline Abstract</Label>
        <Input type="date" value={row.abstractDeadline} onChange={(e) => setRow({ ...row, abstractDeadline: e.target.value })} />
      </div>
      <div>
        <Label>Deadline Bio/Headshot</Label>
        <Input type="date" value={row.bioDeadline} onChange={(e) => setRow({ ...row, bioDeadline: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Label>Compliance Notes</Label>
        <Textarea value={row.compliance} onChange={(e) => setRow({ ...row, compliance: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Label>Logistics Notes</Label>
        <Textarea value={row.logistics} onChange={(e) => setRow({ ...row, logistics: e.target.value })} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={row.status} onValueChange={(v) => setRow({ ...row, status: v as Status })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleziona" />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Next Action</Label>
        <Input value={row.nextAction} onChange={(e) => setRow({ ...row, nextAction: e.target.value })} />
      </div>
      <div>
        <Label>Owner</Label>
        <Input value={row.owner} onChange={(e) => setRow({ ...row, owner: e.target.value })} />
      </div>
      <div className="md:col-span-2 flex gap-2 justify-end mt-2">
        <Button onClick={() => onSave(row)}>Salva</Button>
        <Button variant="secondary" onClick={onCancel}>Annulla</Button>
      </div>
    </div>
  );
}

function PitchTable({ rows, onEdit, onDelete, filter, setFilter }: { rows: Row[]; onEdit: (r: Row) => void; onDelete: (id: string) => void; filter: Filter; setFilter: (f: Filter) => void }) {
  const filtered = useMemo(() => {
    return rows.filter((r) =>
      (!filter.query || [r.sgr, r.cioName, r.proposedTitle, r.proposedAngle].join(" ").toLowerCase().includes(filter.query.toLowerCase())) &&
      (!filter.theme || r.primaryTheme === filter.theme) &&
      (!filter.status || r.status === filter.status) &&
      (!filter.priority || r.priority === filter.priority)
    );
  }, [rows, filter]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div className="md:col-span-2">
          <Input
            placeholder="Cerca SGR / CIO / Titolo"
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
        </div>
        <Select value={filter.theme === "" ? ALL : filter.theme} onValueChange={(v) => setFilter({ ...filter, theme: v === ALL ? "" : v })}>
          <SelectTrigger>
            <SelectValue placeholder="Tema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutti</SelectItem>
            {THEME_CATEGORIES.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.status === "" ? ALL : filter.status} onValueChange={(v) => setFilter({ ...filter, status: v === ALL ? "" : v })}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutti</SelectItem>
            {STATUS.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.priority === "" ? ALL : filter.priority} onValueChange={(v) => setFilter({ ...filter, priority: v === ALL ? "" : v })}>
          <SelectTrigger>
            <SelectValue placeholder="Priorità" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tutte</SelectItem>
            {PRIORITY.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">SGR</th>
              <th className="p-3">CIO</th>
              <th className="p-3">Tema</th>
              <th className="p-3">Titolo 15&apos;</th>
              <th className="p-3">Roundtable</th>
              <th className="p-3">Priorità</th>
              <th className="p-3">Status</th>
              <th className="p-3">Scadenze</th>
              <th className="p-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const deadlines = [r.confDeadline, r.abstractDeadline, r.bioDeadline].filter(Boolean).join(" • ");
              const conflict = (r.conflict || "").toLowerCase().includes("overlap") || (r.conflict || "").toLowerCase().includes("conflict");
              const cioWarn = !r.cioName || r.cioAvailability !== "Y";
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{r.sgr || "—"}</div>
                    <div className="text-xs text-gray-500">{r.comms}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{r.cioName || "—"}</span>
                      {cioWarn && <Badge variant="red">CIO mancante</Badge>}
                    </div>
                    <div className="text-xs text-gray-500">{r.cioTitle}</div>
                  </td>
                  <td className="p-3">
                    <div>{r.primaryTheme || "—"}</div>
                    {conflict && (
                      <div className="mt-1">
                        <Badge variant="red">Conflict</Badge>
                      </div>
                    )}
                  </td>
                  <td className="p-3">{r.proposedTitle || r.proposedAngle || "—"}</td>
                  <td className="p-3">{r.roundtable || "—"}</td>
                  <td className="p-3">
                    <Badge variant={r.priority === "High" ? "red" : r.priority === "Med" ? "yellow" : "default"}>{r.priority}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={r.status === "Confermato" ? "green" : r.status === "In valutazione" ? "yellow" : "blue"}>{r.status}</Badge>
                  </td>
                  <td className="p-3 text-xs">{deadlines || "—"}</td>
                  <td className="p-3 flex gap-2">
                    <Button size="icon" variant="secondary" onClick={() => onEdit(r)}>
                      <Pencil className="h-4" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="p-8 text-center text-gray-500" colSpan={9}>Nessun risultato</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopicMenu() {
  const rows = [
    { cat: THEME_CATEGORIES[0], subs: "Tassi, inflazione, fiscal stance, energia, supply chain, rischi di coda" },
    { cat: THEME_CATEGORIES[1], subs: "Quality vs Value, small/mid cap, AI & infra, dividendi/buybacks" },
    { cat: THEME_CATEGORIES[2], subs: "Duration, curve, IG/HY, loans, subordinati, EM hard/local, inflation-linked" },
    { cat: THEME_CATEGORIES[3], subs: "ESG 2.0, transition finance, Scope 3, tassonomie, engagement" },
    { cat: THEME_CATEGORIES[4], subs: "India vs Cina, LatAm/nearshoring, CEE, Africa, FX locale" },
    { cat: THEME_CATEGORIES[5], subs: "Private credit, secondaries, real assets, hedge macro/CTA" },
    { cat: THEME_CATEGORIES[6], subs: "Ageing/healthcare, sicurezza/difesa, reshoring/automazione, consumi premium" },
    { cat: THEME_CATEGORIES[7], subs: "Playbook cross-asset: barbell, liquidità, gestione volatilità" },
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {rows.map((r, i) => (
        <Card key={i} className="rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="font-semibold mb-1">{r.cat}</div>
            <div className="text-sm text-gray-600">{r.subs}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AgendaGrid({ agenda, setAgenda }: { agenda: AgendaItem[]; setAgenda: (a: AgendaItem[]) => void }) {
  const update = (idx: number, key: keyof AgendaItem, val: string) => {
    const next = [...agenda];
    next[idx] = { ...next[idx], [key]: val } as AgendaItem;
    setAgenda(next);
  };
  const addRow = () => setAgenda([...agenda, { time: "", session: "", speaker: "", theme: "", notes: "" }]);
  const delRow = (idx: number) => setAgenda(agenda.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <div className="font-semibold">Agenda</div>
        <Button onClick={addRow}>
          <Plus className="h-4 mr-1" />Aggiungi riga
        </Button>
      </div>
      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">Session</th>
              <th className="p-3">Speaker/Società</th>
              <th className="p-3">Tema/Angolo</th>
              <th className="p-3">Note</th>
              <th className="p-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {agenda.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">
                  <Input value={r.time} onChange={(e) => update(i, "time", e.target.value)} />
                </td>
                <td className="p-2">
                  <Input value={r.session} onChange={(e) => update(i, "session", e.target.value)} />
                </td>
                <td className="p-2">
                  <Input value={r.speaker} onChange={(e) => update(i, "speaker", e.target.value)} />
                </td>
                <td className="p-2">
                  <Input value={r.theme} onChange={(e) => update(i, "theme", e.target.value)} />
                </td>
                <td className="p-2">
                  <Input value={r.notes} onChange={(e) => update(i, "notes", e.target.value)} />
                </td>
                <td className="p-2">
                  <Button size="icon" variant="destructive" onClick={() => delRow(i)}>
                    <Trash2 className="h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpeakerBrief({ brief, setBrief }: { brief: Brief; setBrief: (b: Brief) => void }) {
  const update = (k: string, v: string | boolean) => setBrief({ ...brief, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        ["company", "Società"],
        ["speaker", "Speaker"],
        ["title", "Titolo talk (≤90 caratteri)"],
        ["role", "Ruolo"],
      ].map(([k, lbl]) => (
        <div key={k}>
          <Label>{lbl}</Label>
          <Input value={(brief[k as string] as string) || ""} onChange={(e) => update(k as string, e.target.value)} />
        </div>
      ))}
      <div className="md:col-span-2">
        <Label>1-line thesis</Label>
        <Input value={(brief.thesis as string) || ""} onChange={(e) => update("thesis", e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Label>3 key takeaways</Label>
        <Textarea value={(brief.takeaways as string) || ""} onChange={(e) => update("takeaways", e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Label>Evidenze a supporto (dati/grafici/case)</Label>
        <Textarea value={(brief.evidence as string) || ""} onChange={(e) => update("evidence", e.target.value)} />
      </div>
      <div>
        <Label>Necessità AV</Label>
        <Input value={(brief.av as string) || ""} onChange={(e) => update("av", e.target.value)} />
      </div>
      <div>
        <Label>Conferma no product pitch</Label>
        <div className="flex items-center gap-2 mt-2">
          <Checkbox checked={!!brief.noPitch} onCheckedChange={(v) => update("noPitch", !!v)} />
          <span className="text-sm text-gray-700">Accetto</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------- Demo/Test helpers ----------------------
function seedDemo(setRows: React.Dispatch<React.SetStateAction<Row[]>>): void {
  const demo: Row[] = [
    {
      ...EMPTY_ROW,
      id: uid(),
      sgr: "SGR Alfa",
      comms: "Maria Rossi",
      email: "comms@alfa.it",
      cioName: "Luca Bianchi",
      cioTitle: "Chief Investment Officer",
      cioAvailability: "Y",
      priority: "High",
      primaryTheme: THEME_CATEGORIES[0],
      proposedTitle: "Disinflazione accidentata: come ripensare duration e rischio coda",
      roundtable: "Fixed Income",
      status: "In valutazione",
      confDeadline: "2025-10-18",
    },
    {
      ...EMPTY_ROW,
      id: uid(),
      sgr: "SGR Beta",
      comms: "Giulia Verdi",
      email: "press@beta.eu",
      cioName: "—",
      cioTitle: "",
      cioAvailability: "TBD",
      priority: "Med",
      primaryTheme: THEME_CATEGORIES[1],
      proposedAngle: "AI & infrastrutture: i veri beneficiari",
      roundtable: "Equity",
      status: "Contattato",
      abstractDeadline: "2025-10-28",
    },
  ];
  setRows((prev) => [...demo, ...prev]);
}

function runTests(): TestResult[] {
  const results: TestResult[] = [];
  const ids = new Set(Array.from({ length: 100 }, () => uid()));
  results.push({ name: "uid uniqueness", pass: ids.size === 100 });
  const sample: Row[] = [
    { ...EMPTY_ROW, id: "a", sgr: "A", comms: "X", email: "a@x", proposedTitle: "t1" },
    { ...EMPTY_ROW, id: "b", sgr: "B", comms: "Y", email: "b@y", proposedTitle: "t2, with comma" },
  ];
  const csv = exportCSV(sample);
  const round = parseCSV(csv);
  results.push({ name: "csv roundtrip count", pass: round.length === 2 });
  results.push({ name: "csv field", pass: round[1].proposedTitle.indexOf("comma") > -1 });
  const rows: Row[] = [
    { ...EMPTY_ROW, id: "1", sgr: "SGR Uno", cioName: "", proposedTitle: "Alpha", primaryTheme: THEME_CATEGORIES[0] },
    { ...EMPTY_ROW, id: "2", sgr: "SGR Due", cioName: "CIO", proposedTitle: "Beta", primaryTheme: THEME_CATEGORIES[1] },
  ];
  const f1: Filter = { query: "alpha", theme: "", status: "", priority: "" };
  const filtered1 = rows.filter((r) => (!f1.query || [r.sgr, r.cioName, r.proposedTitle, r.proposedAngle].join(" ").toLowerCase().includes(f1.query.toLowerCase())));
  results.push({ name: "filter query", pass: filtered1.length === 1 });
  const f2: Filter = { query: "", theme: "", status: "", priority: "" };
  const filtered2 = rows.filter((r) => (!f2.theme || r.primaryTheme === f2.theme));
  results.push({ name: "filter all sentinel", pass: filtered2.length === 2 });
  return results;
}

// ---------------------- Main App ----------------------
export default function App() {
  const loaded = loadState();
  const [rows, setRows] = useState<Row[]>(loaded ? loaded.rows : []);
  const [agenda, setAgenda] = useState<AgendaItem[]>(loaded ? loaded.agenda : [
    { time: "09:30", session: "Welcome Coffee", speaker: "", theme: "", notes: "" },
    { time: "09:55", session: "Introduzione FundsPeople", speaker: "", theme: "", notes: "" },
    { time: "10:00", session: "Outlook Tematico 1 (CIO)", speaker: "", theme: "", notes: "" },
    { time: "10:15", session: "Outlook Tematico 2 (CIO)", speaker: "", theme: "", notes: "" },
    { time: "10:30", session: "Outlook Tematico 3 (CIO)", speaker: "", theme: "", notes: "" },
    { time: "10:45", session: "Outlook Tematico 4 (CIO)", speaker: "", theme: "", notes: "" },
    { time: "11:00", session: "Outlook Tematico 5 (CIO)", speaker: "", theme: "", notes: "" },
    { time: "11:15", session: "Outlook Tematico 6 (CIO)", speaker: "", theme: "", notes: "" },
    { time: "11:30", session: "Roundtable Fixed Income", speaker: "", theme: "", notes: "" },
    { time: "12:00", session: "Roundtable Azionario", speaker: "", theme: "", notes: "" },
    { time: "12:30", session: "Roundtable Alternativi", speaker: "", theme: "", notes: "" },
    { time: "13:00", session: "Buffet Lunch", speaker: "", theme: "", notes: "" },
  ]);
  const [brief, setBrief] = useState<Brief>(loaded ? loaded.brief : {});
  const [filter, setFilter] = useState<Filter>({ query: "", theme: "", status: "", priority: "" });
  const [editing, setEditing] = useState<Row | null>(null);
  const [tests, setTests] = useState<TestResult[]>([]);

  useEffect(() => {
    saveState({ rows, agenda, brief });
  }, [rows, agenda, brief]);

  const addRow = () => setEditing({ ...EMPTY_ROW, id: uid() });
  const onSaveRow = (row: Row) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = row;
        return next;
      }
      return [row, ...prev];
    });
    setEditing(null);
  };
  const onDelete = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const exportJSON = () => download("investors_outlook_2026.json", JSON.stringify({ rows, agenda, brief }, null, 2));
  const exportCsv = () => download("pitch_tracker.csv", exportCSV(rows), "text/csv");

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Partial<State>;
        setRows((data.rows as Row[]) || []);
        setAgenda((data.agenda as AgendaItem[]) || []);
        setBrief((data.brief as Brief) || {});
      } catch {
        alert("File JSON non valido");
      }
    };
    reader.readAsText(file);
  };
  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result));
        setRows((prev) => [...parsed, ...prev]);
      } catch {
        alert("CSV non valido");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Investors Outlook 2026 – Dashboard</h1>
          <p className="text-gray-600">Gestione inviti, temi, agenda e brief speaker. Dati salvati in locale (browser).</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={addRow}>
            <Plus className="h-4 mr-1" />Nuova SGR
          </Button>
          <Button variant="secondary" onClick={() => seedDemo(setRows)}>Dati demo</Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Upload className="h-4 mr-1" />Importa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importa dati</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>JSON (dashboard completa)</Label>
                  <Input type="file" accept="application/json" onChange={(e) => e.target.files && e.target.files[0] && importJSON(e.target.files[0])} />
                </div>
                <div>
                  <Label>CSV (solo Pitch Tracker)</Label>
                  <Input type="file" accept="text/csv" onChange={(e) => e.target.files && e.target.files[0] && importCSV(e.target.files[0])} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 mr-1" />Esporta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Esporta dati</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2">
                <Button onClick={exportJSON}>JSON (tutto)</Button>
                <Button variant="secondary" onClick={exportCsv}>CSV (Pitch Tracker)</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="pitch">
        <TabsList className="grid grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="pitch">Pitch Tracker</TabsTrigger>
          <TabsTrigger value="topics">Menu Temi</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="brief">Speaker Brief</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="pitch">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-4">
              <PitchTable rows={rows} onEdit={setEditing as unknown as (r: Row) => void} onDelete={onDelete} filter={filter} setFilter={setFilter} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics">
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <TopicMenu />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agenda">
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <AgendaGrid agenda={agenda} setAgenda={setAgenda} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brief">
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <SpeakerBrief brief={brief} setBrief={setBrief} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Button onClick={() => setTests(runTests())}>Esegui test</Button>
                {tests.length > 0 && <span className="text-sm text-gray-600">{tests.filter(t=>t.pass).length}/{tests.length} passati</span>}
              </div>
              <div className="space-y-2">
                {tests.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {t.pass ? <CheckCircle2 className="h-4" /> : <XCircle className="h-4" />}
                    <span>{t.name}</span>
                  </div>
                ))}
                {tests.length === 0 && <div className="text-sm text-gray-500">Nessun test eseguito</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing && editing.sgr ? `Modifica: ${editing.sgr}` : "Nuova SGR"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <RowEditor initial={editing} onSave={onSaveRow} onCancel={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <div className="text-xs text-gray-500">
        Suggerimenti: usa i filtri per evitare sovrapposizioni; evidenzia &quot;Conflict&quot; nel campo conflitti; priorità CIO sempre &gt; PM/Head.
      </div>
    </div>
  );
}
