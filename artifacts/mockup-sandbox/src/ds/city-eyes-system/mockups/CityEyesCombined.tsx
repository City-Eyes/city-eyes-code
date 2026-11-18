import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowLeft, Check, ChevronRight, ClipboardList, Eye, FileImage, MapPin, Moon, Plus, Sun, X } from "lucide-react";
import { Alert, AlertDescription } from "@workspace/city-eyes-system/components/ui/alert";
import { Badge } from "@workspace/city-eyes-system/components/ui/badge";
import { Button } from "@workspace/city-eyes-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/city-eyes-system/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@workspace/city-eyes-system/components/ui/dialog";
import { Label } from "@workspace/city-eyes-system/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@workspace/city-eyes-system/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@workspace/city-eyes-system/components/ui/tabs";
import { Textarea } from "@workspace/city-eyes-system/components/ui/textarea";

type City = { id: string; name: string; center: string; areas: string[] };
type Category = "pavimento" | "iluminacao" | "drenagem" | "acessibilidade" | "sinalizacao";
type HistoryEvent = { status: string; note: string; date: string };
type Report = {
  id: string; city: string; category: Category; title: string; status: string; area: string;
  x: number; y: number; description: string; created: string; history: HistoryEvent[];
  image?: string; imageSource?: string; confirmations?: number;
};

const CITIES: City[] = [
  { id: "curitiba", name: "Curitiba", center: "Centro cívico ilustrativo", areas: ["Centro", "Água Verde", "Batel", "Juvevê"] },
  { id: "londrina", name: "Londrina", center: "Eixo central ilustrativo", areas: ["Centro", "Gleba Palhano", "Vila Ipiranga", "Jardim Quebec"] },
  { id: "maringa", name: "Maringá", center: "Zona central ilustrativa", areas: ["Zona 01", "Zona 07", "Vila Operária", "Zona 05"] },
  { id: "ponta-grossa", name: "Ponta Grossa", center: "Centro ilustrativo", areas: ["Centro", "Uvaranas", "Nova Rússia", "Oficinas"] },
];
const CATEGORIES: Record<Category, { name: string; icon: string }> = {
  pavimento: { name: "Calçada ou pavimento", icon: "P" },
  iluminacao: { name: "Iluminação pública", icon: "L" },
  drenagem: { name: "Drenagem", icon: "D" },
  acessibilidade: { name: "Acessibilidade", icon: "A" },
  sinalizacao: { name: "Sinalização", icon: "S" },
};
const STATUSES = ["Todos", "Recebido", "Em análise", "Encaminhado", "Concluído"];
const INITIAL_REPORTS: Report[] = CITIES.flatMap((city, cityIndex) => {
  const examples: [Category, string, string, number, number, number][] = [
    ["pavimento", "Desnível na calçada", "Recebido", 1, 21, 65],
    ["iluminacao", "Luminária apagada", "Em análise", 2, 54, 28],
    ["drenagem", "Boca de lobo obstruída", "Encaminhado", 3, 74, 70],
    ["acessibilidade", "Rampa com passagem bloqueada", "Recebido", 0, 36, 45],
  ];
  return examples.map(([category, title, status, areaIndex, x, y], index) => {
    const id = `DEMO-${String(cityIndex * 4 + index + 1).padStart(3, "0")}`;
    const created = `Hoje, 09:4${index}`;
    return {
      id, city: city.id, category, title, status, area: city.areas[areaIndex], x, y, created,
      description: `Registro demonstrativo de ${title.toLowerCase()} próximo a ${city.areas[areaIndex]}. Localização e relato são fictícios e servem apenas para navegar pelo protótipo.`,
      history: [{ status, note: "Registro demonstrativo incluído na fila pública.", date: created }],
    };
  });
});

export function CityEyesCombined() {
  const [cityId, setCityId] = useState("curitiba");
  const [page, setPage] = useState<"explore" | "report" | "queue" | "detail">("explore");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [layout, setLayout] = useState("mapa");
  const [filter, setFilter] = useState("Todos");
  const [queueFilter, setQueueFilter] = useState("Todos");
  const [records, setRecords] = useState(INITIAL_REPORTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"confirm" | "publish">("confirm");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("pavimento");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [imageSource, setImageSource] = useState("");
  const [point, setPoint] = useState({ x: 50, y: 50 });
  const [operatorStatus, setOperatorStatus] = useState("Recebido");
  const [operatorNote, setOperatorNote] = useState("");
  const [notice, setNotice] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const city = CITIES.find((item) => item.id === cityId) ?? CITIES[0];
  const selected = records.find((item) => item.id === selectedId);
  const cityRecords = useMemo(() => records.filter((record) => record.city === cityId), [records, cityId]);
  const exploreRecords = cityRecords.filter((record) => filter === "Todos" || record.status === filter);
  const queueRecords = cityRecords.filter((record) => queueFilter === "Todos" || record.status === queueFilter);

  const openRecord = (record: Report, inQueue = false) => {
    setSelectedId(record.id);
    if (inQueue) {
      setOperatorStatus(record.status);
      setOperatorNote("");
      setOperatorOpen(true);
    } else setPage("detail");
  };
  const goPage = (next: "explore" | "report" | "queue") => {
    setPage(next);
    if (next !== "report") setReceipt(null);
  };
  const chooseImage = (file: File | undefined, source: string) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Selecione um arquivo de imagem.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(typeof reader.result === "string" ? reader.result : undefined);
      setImageSource(source);
    };
    reader.readAsDataURL(file);
  };
  const setPinFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPoint({
      x: Math.max(5, Math.min(95, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(8, Math.min(90, ((event.clientY - bounds.top) / bounds.height) * 100)),
    });
  };
  const movePin = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 8 : 3;
    const next = { ...point };
    if (event.key === "ArrowUp") next.y = Math.max(8, point.y - step);
    else if (event.key === "ArrowDown") next.y = Math.min(90, point.y + step);
    else if (event.key === "ArrowLeft") next.x = Math.max(5, point.x - step);
    else if (event.key === "ArrowRight") next.x = Math.min(95, point.x + step);
    else return;
    event.preventDefault();
    setPoint(next);
  };
  const saveNewReport = () => {
    if (!description.trim()) {
      setNotice("Escreva uma descrição breve antes de continuar.");
      return;
    }
    setPendingAction("publish");
    setGateOpen(true);
  };
  const continueDemo = () => {
    setGateOpen(false);
    if (pendingAction === "confirm") {
      if (!selected || selected.status === "Concluído") return;
      setRecords((current) => current.map((record) => record.id === selected.id ? {
        ...record, confirmations: (record.confirmations ?? 0) + 1,
        history: [...record.history, { status: record.status, note: `${(record.confirmations ?? 0) + 1} confirmação(ões) de continuidade nesta sessão demonstrativa.`, date: "Agora" }],
      } : record));
      setNotice("Confirmação registrada somente nesta demonstração.");
      return;
    }
    const number = records.reduce((max, record) => Math.max(max, Number(record.id.slice(-3))), 0) + 1;
    const id = `DEMO-${String(number).padStart(3, "0")}`;
    const area = city.areas[Math.min(city.areas.length - 1, Math.floor((point.y / 100) * city.areas.length))];
    const title = description.trim().split(/[.!?]/)[0].slice(0, 48) || CATEGORIES[category].name;
    const created: Report = {
      id, city: cityId, category, title, status: "Recebido", area, x: point.x, y: point.y, description: description.trim(),
      created: "Agora · demonstração", image, imageSource,
      history: [{ status: "Recebido", note: "Relato de exemplo recebido. Revisão da imagem aguarda triagem demonstrativa.", date: "Agora" }],
    };
    setRecords((current) => [created, ...current]);
    setSelectedId(id);
    setReceipt(id);
    setDescription("");
    setImage(undefined);
    setImageSource("");
  };
  const saveOperatorUpdate = () => {
    if (!operatorNote.trim()) {
      setNotice("Inclua uma nota pública para registrar a mudança.");
      return;
    }
    if (!selected) return;
    setRecords((current) => current.map((record) => record.id === selected.id ? {
      ...record, status: operatorStatus,
      history: [...record.history, { status: operatorStatus, note: operatorNote.trim(), date: "Agora · operação demonstrativa" }],
    } : record));
    setOperatorOpen(false);
    setNotice("Fila e histórico público atualizados nesta sessão.");
  };

  const citySelect = (
    <Select value={cityId} onValueChange={(value) => { setCityId(value); setSelectedId(null); }}>
      <SelectTrigger aria-label="Selecionar cidade" className="min-w-0"><SelectValue /></SelectTrigger>
      <SelectContent>{CITIES.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
    </Select>
  );
  const statusBadge = (status: string) => (
    <Badge variant={status === "Concluído" ? "secondary" : status === "Em análise" || status === "Em triagem" ? "outline" : "default"}>{status}</Badge>
  );
  const reportRow = (record: Report, inQueue = false) => (
    <Button key={record.id} type="button" variant="outline" onClick={() => openRecord(record, inQueue)}
      className="h-auto w-full items-start justify-start gap-3 p-3 text-left">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary font-bold text-secondary-foreground">{CATEGORIES[record.category].icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug">{record.title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{record.area} · {record.created}</span>
        <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{record.id}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">{statusBadge(record.status)}<ChevronRight className="size-4 text-muted-foreground" /></span>
    </Button>
  );
  const mapSurface = (selectable = false) => (
    <div ref={selectable ? mapRef : undefined}
      onPointerDown={selectable ? setPinFromPointer : undefined}
      onKeyDown={selectable ? movePin : undefined}
      role={selectable ? "application" : "group"}
      aria-label={selectable ? "Mapa esquemático ilustrativo. Use as setas para mover o ponto manual." : "Mapa esquemático demonstrativo; pontos não são endereços reais."}
      tabIndex={selectable ? 0 : undefined}
      className={`relative isolate h-56 overflow-hidden rounded-2xl border border-border bg-secondary/70 ${selectable ? "cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}>
      <svg aria-hidden="true" viewBox="0 0 400 230" preserveAspectRatio="none" className="absolute inset-0 size-full text-muted-foreground/30">
        <path d="M-20 45 C80 80 130 20 210 65 S320 100 430 48 M-20 170 C70 145 140 210 230 160 S340 120 430 175 M85 -20 C120 60 80 120 130 260 M290 -20 C260 55 330 100 280 260" fill="none" stroke="currentColor" strokeWidth="12" />
        <path d="M-10 108 C80 115 155 88 225 113 S340 145 420 105" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="4 5" />
        <circle cx="88" cy="73" r="30" fill="currentColor" opacity=".18" /><circle cx="324" cy="168" r="42" fill="currentColor" opacity=".16" />
      </svg>
      <span className="absolute left-3 top-3 rounded-md bg-card/95 px-2 py-1 text-[10px] font-semibold text-muted-foreground">{city.center}</span>
      {!selectable && cityRecords.map((record) => (
        <Button key={record.id} type="button" variant="secondary" size="icon" onClick={() => openRecord(record)} aria-label={`Abrir relato demonstrativo: ${record.title}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${record.x}%`, top: `${record.y}%` }}>{CATEGORIES[record.category].icon}</Button>
      ))}
      {selectable && <span aria-hidden="true" className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-card bg-accent text-accent-foreground shadow-md" style={{ left: `${point.x}%`, top: `${point.y}%` }}><MapPin className="size-4" /></span>}
      <span className="absolute bottom-2 right-2 rounded bg-card/90 px-2 py-1 font-mono text-[9px] text-muted-foreground">MAPA ESQUEMÁTICO · SEM ESCALA</span>
    </div>
  );
  const filterTabs = (value: string, onChange: (next: string) => void, id: string) => (
    <Tabs value={value} onValueChange={onChange} aria-label="Filtrar relatos por status">
      <TabsList className="w-full justify-start overflow-x-auto">
        {STATUSES.map((status) => <TabsTrigger key={`${id}-${status}`} value={status} className="shrink-0">{status}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  );

  return (
    <div className={`${theme === "dark" ? "dark" : ""} min-h-screen bg-background font-sans text-foreground`}>
      <div className="mx-auto min-h-screen w-full max-w-lg bg-background pb-24">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-black tracking-tight text-primary-foreground">CE</span>
            <div><p className="text-sm font-extrabold tracking-[0.12em]">CITY EYES</p><p className="text-[10px] text-muted-foreground">cidade em foco · demonstração</p></div>
          </div>
          <Button variant="outline" size="icon" aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </header>

        {page === "explore" && (
          <main className="space-y-4 px-4 py-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Olhos abertos para a cidade</p><h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">O que precisa de atenção?</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Acompanhe relatos demonstrativos e veja como uma fila pública pode organizar prioridades urbanas.</p></div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3"><span className="text-[10px] font-bold tracking-wider text-muted-foreground">CIDADE</span>{citySelect}</div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">Dados de demonstração</Badge>
              <Tabs value={layout} onValueChange={setLayout} aria-label="Forma de visualizar relatos"><TabsList><TabsTrigger value="mapa">Mapa</TabsTrigger><TabsTrigger value="lista">Lista</TabsTrigger></TabsList></Tabs>
            </div>
            {layout === "mapa" && mapSurface()}
            <div className="flex items-baseline justify-between"><h2 className="text-base font-bold">Relatos nesta cidade</h2><span className="text-xs text-muted-foreground">{exploreRecords.length} exemplos</span></div>
            {filterTabs(filter, setFilter, "explore")}
            {exploreRecords.length ? <div className="grid gap-2">{exploreRecords.map((record) => reportRow(record))}</div> : (
              <Card><CardContent className="flex flex-col items-center px-5 py-8 text-center"><MapPin className="size-6 text-muted-foreground" /><p className="mt-2 font-bold">Nenhum relato nesta seleção</p><p className="mt-1 text-sm text-muted-foreground">Experimente outro filtro ou escolha uma cidade diferente.</p></CardContent></Card>
            )}
          </main>
        )}

        {page === "detail" && (
          <main className="space-y-4 px-4 py-5">
            <Button variant="ghost" className="-ml-2" onClick={() => setPage("explore")}><ArrowLeft /> Explorar relatos</Button>
            {selected ? <>
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Relato público · demonstração</p>
                <Card className="mt-3"><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">{city.name} · {selected.area}</p><h1 className="mt-2 text-xl font-extrabold">{selected.title}</h1><p className="mt-2 font-mono text-xs text-muted-foreground">{selected.id} · {selected.created}</p></CardContent></Card></div>
              <div className="flex items-center justify-between">{statusBadge(selected.status)}<span className="text-xs text-muted-foreground">{CATEGORIES[selected.category].name}</span></div>
              <Card><CardHeader className="pb-2"><CardTitle>Sobre este exemplo</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p><p className="mt-3 text-xs text-muted-foreground">Ponto e ocorrência fictícios · {city.name}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between">Histórico público <span className="text-xs font-normal text-muted-foreground">{selected.history.length} atualizações</span></CardTitle></CardHeader><CardContent>
                <ol className="ml-1 grid gap-4 border-l border-border pl-4">{[...selected.history].reverse().map((event, index) => <li key={`${event.date}-${index}`} className="relative"><span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary" /><p className="text-sm font-bold">{event.status}</p><p className="mt-1 text-sm text-muted-foreground">{event.note}</p><p className="mt-1 text-[10px] text-muted-foreground">{event.date} · ação demonstrativa</p></li>)}</ol>
              </CardContent></Card>
              <Button className="w-full" disabled={selected.status === "Concluído"} onClick={() => { setPendingAction("confirm"); setGateOpen(true); }}><Check /> Confirmar que continua ativo</Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">Confirmação simulada; não será enviada a um município.</p>
            </> : <Card><CardContent className="p-6 text-center"><p className="font-bold">Relato não encontrado</p><Button variant="link" onClick={() => setPage("explore")}>Voltar aos relatos</Button></CardContent></Card>}
          </main>
        )}

        {page === "report" && (
          <main className="space-y-4 px-4 py-5">
            {receipt ? <>
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Relato enviado · simulação</p><h1 className="mt-1 text-2xl font-extrabold">Obrigado por olhar de perto.</h1></div>
              <Card><CardContent className="p-4"><p className="font-bold uppercase tracking-wider text-muted-foreground">Protocolo demonstrativo</p><p className="mt-2 font-mono text-xl font-bold">{receipt}</p><p className="mt-2 text-sm text-muted-foreground">Seu exemplo foi adicionado à fila desta sessão.</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle>Revisão da imagem</CardTitle></CardHeader><CardContent><Badge variant="outline">Aguardando revisão demonstrativa</Badge><p className="mt-3 text-sm leading-relaxed text-muted-foreground">A etiqueta de origem e qualquer sugestão de IA não comprovam autenticidade. A IA aqui é uma sugestão simulada de triagem, não um veredito. Nenhuma imagem é rejeitada automaticamente, inclusive imagens geradas por IA.</p></CardContent></Card>
              <Button className="w-full" onClick={() => setPage("detail")}>Ver relato</Button>
              <Button variant="link" className="w-full" onClick={() => { setReceipt(null); setCategory("pavimento"); setDescription(""); setImage(undefined); setImageSource(""); setPoint({ x: 50, y: 50 }); }}>Criar outro exemplo</Button>
            </> : <>
              <Button variant="ghost" className="-ml-2" onClick={() => setPage("explore")}><ArrowLeft /> Cancelar e voltar</Button>
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contribuição cidadã · demonstração</p><h1 className="mt-1 text-2xl font-extrabold">Conte o que você percebeu.</h1><p className="mt-2 text-sm text-muted-foreground">Um relato curto ajuda a organizar uma conversa pública sobre prioridades.</p></div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-3"><span className="text-[10px] font-bold tracking-wider text-muted-foreground">CIDADE</span>{citySelect}</div>
              <div className="space-y-2"><Label htmlFor="report-category">Categoria</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as Category)}><SelectTrigger id="report-category"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORIES).map(([id, item]) => <SelectItem key={id} value={id}>{item.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label htmlFor="report-description">O que está acontecendo?</Label><Textarea id="report-description" value={description} maxLength={220} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva o ponto e o impacto observado. Evite incluir dados pessoais." aria-describedby="description-count" className="min-h-24" /><p id="description-count" className="text-right text-xs text-muted-foreground">{description.length}/220</p></div>
              <div className="space-y-2"><Label>Imagem (opcional)</Label><div className="grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-3 text-sm font-bold focus-within:ring-2 focus-within:ring-ring"><span className="flex items-center gap-2"><FileImage className="size-4" /> Usar câmera</span><span className="text-xs font-normal text-muted-foreground">Captura, se disponível</span><input className="sr-only" type="file" accept="image/*" capture="environment" aria-label="Selecionar imagem pela câmera" onChange={(event) => chooseImage(event.target.files?.[0], "Câmera")} /></label>
                <label className="flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-3 text-sm font-bold focus-within:ring-2 focus-within:ring-ring"><span className="flex items-center gap-2"><FileImage className="size-4" /> Galeria</span><span className="text-xs font-normal text-muted-foreground">Escolher uma imagem</span><input className="sr-only" type="file" accept="image/*" aria-label="Escolher imagem da galeria" onChange={(event) => chooseImage(event.target.files?.[0], "Galeria")} /></label>
              </div>
              {image && <div className="space-y-2"><img src={image} alt="Prévia da imagem selecionada" className="max-h-44 w-full rounded-xl object-cover" /><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Origem declarada: {imageSource} · não verificada</span><Button variant="ghost" size="sm" onClick={() => { setImage(undefined); setImageSource(""); }} aria-label="Remover imagem selecionada"><X /></Button></div></div>}
              <p className="text-xs leading-relaxed text-muted-foreground">A origem câmera/galeria não comprova autenticidade. Sugestões de IA não são vereditos e imagens não são rejeitadas automaticamente.</p></div>
              <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label>Marque um ponto aproximado</Label><span className="text-[10px] font-bold text-muted-foreground">LOCAL ILUSTRATIVO</span></div><p className="text-sm text-muted-foreground">Toque no mapa ou use as setas para posicionar. Não pedimos acesso à sua localização.</p>{mapSurface(true)}<p className="flex justify-between text-xs font-semibold"><span>Ponto manual selecionado</span><span className="font-mono text-muted-foreground">{Math.round(point.x)}%, {Math.round(point.y)}%</span></p></div>
              <Alert><AlertDescription>Protótipo sem envio real. Relatos, pontos, imagens e análise são demonstrações. Não compartilhe informações pessoais.</AlertDescription></Alert>
              <Button className="w-full" onClick={saveNewReport}>Revisar e publicar exemplo</Button>
            </>}
          </main>
        )}

        {page === "queue" && (
          <main className="space-y-4 px-4 py-5">
            <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Espaço de operação · demonstração</p><h1 className="mt-1 text-2xl font-extrabold">Fila municipal</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Acesso de operador simulado. Registros de exemplo, sem autenticação ou conexão com uma prefeitura.</p></div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3"><span className="text-[10px] font-bold tracking-wider text-muted-foreground">CIDADE</span>{citySelect}</div>
            <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle>Fila de {city.name}</CardTitle><Badge variant="secondary">Modo demo</Badge></CardHeader><CardContent><p className="text-sm text-muted-foreground">Triagem transparente: abra um relato, atualize o status e deixe uma nota pública.</p></CardContent></Card>
            {filterTabs(queueFilter, setQueueFilter, "queue")}
            {queueRecords.length ? <div className="grid gap-2">{queueRecords.map((record) => reportRow(record, true))}</div> : <Card><CardContent className="p-6 text-center"><ClipboardList className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 font-bold">Fila sem relatos nesse status</p><p className="mt-1 text-sm text-muted-foreground">Escolha outro filtro para ver os exemplos disponíveis.</p></CardContent></Card>}
          </main>
        )}

        <nav aria-label="Navegação principal" className="fixed bottom-0 left-1/2 z-20 flex h-16 w-full max-w-lg -translate-x-1/2 items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur">
          <Button variant={page === "explore" || page === "detail" ? "secondary" : "ghost"} className="h-12 flex-col gap-1 px-3" onClick={() => goPage("explore")}><Eye className="size-4" />Explorar</Button>
          <Button variant={page === "report" ? "secondary" : "ghost"} className="h-12 flex-col gap-1 px-3" onClick={() => { setReceipt(null); setPage("report"); }}><Plus className="size-4" />Relatar</Button>
          <Button variant={page === "queue" ? "secondary" : "ghost"} className="h-12 flex-col gap-1 px-3" onClick={() => goPage("queue")}><ClipboardList className="size-4" />Fila municipal</Button>
        </nav>
      </div>

      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="w-[calc(100%-2rem)]">
          <DialogHeader><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Etapa de demonstração</p><DialogTitle>Entrar para {pendingAction === "confirm" ? "confirmar o relato" : "publicar o exemplo"}?</DialogTitle>
            <DialogDescription>A navegação e os detalhes são públicos. Para experimentar esta ação, use a entrada simulada abaixo. Nenhuma conta será criada.</DialogDescription></DialogHeader>
          <Alert><AlertDescription>SIMULAÇÃO — este protótipo não autentica nem envia dados a serviços externos.</AlertDescription></Alert>
          <DialogFooter className="gap-2 sm:flex-col"><Button className="w-full" onClick={continueDemo}>Continuar como pessoa demonstradora</Button><Button variant="secondary" className="w-full" onClick={() => setGateOpen(false)}>Agora não</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={operatorOpen} onOpenChange={setOperatorOpen}>
        <DialogContent className="w-[calc(100%-2rem)]">
          <DialogHeader><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registro demonstrativo · {selected?.id}</p><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{selected?.description}</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="operator-status">Novo status</Label><Select value={operatorStatus} onValueChange={setOperatorStatus}><SelectTrigger id="operator-status"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.slice(1).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="operator-note">Nota pública breve</Label><Textarea id="operator-note" value={operatorNote} maxLength={160} onChange={(event) => setOperatorNote(event.target.value)} placeholder="Explique a atualização de forma clara." /><p className="text-right text-xs text-muted-foreground">{operatorNote.length}/160</p></div>
          <p className="text-xs text-muted-foreground">A nota será exibida no histórico público deste exemplo.</p>
          <DialogFooter className="gap-2 sm:flex-col"><Button className="w-full" onClick={saveOperatorUpdate}>Atualizar status demonstrativo</Button><Button variant="secondary" className="w-full" onClick={() => setOperatorOpen(false)}>Cancelar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(notice)} onOpenChange={(open) => { if (!open) setNotice(""); }}>
        <DialogContent className="w-[calc(100%-2rem)]"><DialogHeader><DialogTitle>Aviso da demonstração</DialogTitle><DialogDescription>{notice}</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setNotice("")}>Entendi</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
