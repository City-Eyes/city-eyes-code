import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Eye,
  MapPin,
  Moon,
  Plus,
  Sun,
  UsersRound,
} from 'lucide-react';
import { Badge } from '@workspace/city-eyes-system/components/ui/badge';
import { Button } from '@workspace/city-eyes-system/components/ui/button';
import { Card, CardContent } from '@workspace/city-eyes-system/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/city-eyes-system/components/ui/dialog';
import { Label } from '@workspace/city-eyes-system/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/city-eyes-system/components/ui/select';
import { Switch } from '@workspace/city-eyes-system/components/ui/switch';
import { Textarea } from '@workspace/city-eyes-system/components/ui/textarea';

type View = 'explore' | 'report' | 'queue' | 'detail' | 'receipt';
type Status = 'Recebido' | 'Em análise' | 'Encaminhado' | 'Concluído';
type Category = 'Pavimento' | 'Iluminação' | 'Drenagem' | 'Acessibilidade';
type RecordItem = {
  id: string;
  city: string;
  category: Category;
  title: string;
  status: Status;
  area: string;
  created: string;
  description: string;
  x: number;
  y: number;
  history: { status: Status; note: string; created: string }[];
  confirmations: number;
};

const cities = ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa'];
const statuses: (Status | 'Todos')[] = [
  'Todos',
  'Recebido',
  'Em análise',
  'Encaminhado',
  'Concluído',
];
const categories: Category[] = [
  'Pavimento',
  'Iluminação',
  'Drenagem',
  'Acessibilidade',
];
const initialRecords: RecordItem[] = [
  {
    id: 'DEMO-014',
    city: 'Curitiba',
    category: 'Pavimento',
    title: 'Desnível na calçada',
    status: 'Recebido',
    area: 'Centro',
    created: 'Hoje, 09:41',
    description:
      'Exemplo fictício de desnível próximo à praça. O local e o relato são ilustrativos e existem apenas para navegar pelo protótipo.',
    x: 28,
    y: 38,
    history: [
      {
        status: 'Recebido',
        note: 'Registro demonstrativo incluído na fila pública.',
        created: 'Hoje, 09:41',
      },
    ],
    confirmations: 2,
  },
  {
    id: 'DEMO-013',
    city: 'Curitiba',
    category: 'Iluminação',
    title: 'Luminária apagada',
    status: 'Em análise',
    area: 'Batel',
    created: 'Ontem, 18:20',
    description:
      'Exemplo de manutenção de iluminação pública. A posição e a ocorrência não correspondem a uma solicitação real.',
    x: 70,
    y: 53,
    history: [
      {
        status: 'Em análise',
        note: 'Exemplo de triagem registrado para demonstração.',
        created: 'Ontem, 18:20',
      },
    ],
    confirmations: 1,
  },
  {
    id: 'DEMO-012',
    city: 'Curitiba',
    category: 'Drenagem',
    title: 'Boca de lobo obstruída',
    status: 'Encaminhado',
    area: 'Água Verde',
    created: 'Ontem, 14:05',
    description:
      'Registro de exemplo usado para mostrar como uma atualização pode aparecer publicamente.',
    x: 52,
    y: 76,
    history: [
      {
        status: 'Encaminhado',
        note: 'Exemplo encaminhado para avaliação municipal.',
        created: 'Ontem, 14:05',
      },
      {
        status: 'Recebido',
        note: 'Registro demonstrativo incluído na fila pública.',
        created: 'Ontem, 13:50',
      },
    ],
    confirmations: 0,
  },
  {
    id: 'DEMO-009',
    city: 'Londrina',
    category: 'Acessibilidade',
    title: 'Passagem bloqueada',
    status: 'Concluído',
    area: 'Centro',
    created: '12 nov, 11:10',
    description:
      'Exemplo fictício para demonstrar o estado concluído e o histórico público.',
    x: 42,
    y: 50,
    history: [
      {
        status: 'Concluído',
        note: 'Exemplo de atualização final.',
        created: '12 nov, 11:10',
      },
      {
        status: 'Recebido',
        note: 'Registro demonstrativo incluído na fila pública.',
        created: '12 nov, 09:10',
      },
    ],
    confirmations: 3,
  },
  {
    id: 'DEMO-011',
    city: 'Maringá',
    category: 'Acessibilidade',
    title: 'Rampa com passagem bloqueada',
    status: 'Recebido',
    area: 'Zona 01',
    created: 'Hoje, 08:35',
    description:
      'Exemplo fictício de passagem bloqueada para demonstrar a escolha de cidade e os detalhes públicos.',
    x: 36,
    y: 45,
    history: [
      {
        status: 'Recebido',
        note: 'Registro demonstrativo incluído na fila pública.',
        created: 'Hoje, 08:35',
      },
    ],
    confirmations: 0,
  },
  {
    id: 'DEMO-007',
    city: 'Ponta Grossa',
    category: 'Iluminação',
    title: 'Luminária apagada',
    status: 'Em análise',
    area: 'Centro',
    created: 'Ontem, 16:10',
    description:
      'Exemplo fictício de manutenção para demonstrar filtros, status e histórico público.',
    x: 61,
    y: 43,
    history: [
      {
        status: 'Em análise',
        note: 'Exemplo de triagem registrado para demonstração.',
        created: 'Ontem, 16:10',
      },
    ],
    confirmations: 1,
  },
];

function statusVariant(status: Status) {
  if (status === 'Concluído') return 'secondary' as const;
  if (status === 'Em análise') return 'outline' as const;
  return 'secondary' as const;
}

function categoryInitial(category: Category) {
  return category === 'Iluminação'
    ? 'I'
    : category === 'Acessibilidade'
      ? 'A'
      : category[0];
}

function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-border shadow-none">
      <CardContent className="flex items-start gap-3 p-3">
        <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

function ReportRow({
  report,
  onClick,
}: {
  report: RecordItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-card-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${report.title}, ${report.area}, ${report.status}, abrir detalhes demonstrativos`}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-bold text-secondary-foreground"
        aria-hidden="true"
      >
        {categoryInitial(report.category)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{report.title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {report.area} · {report.created}
        </span>
        <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
          {report.id} · exemplo
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
    </button>
  );
}

export function CityEyesCommunitySystem() {
  const [view, setView] = useState<View>('explore');
  const [city, setCity] = useState('Curitiba');
  const [themeDark, setThemeDark] = useState(false);
  const [mapMode, setMapMode] = useState<'map' | 'list'>('map');
  const [filter, setFilter] = useState<Status | 'Todos'>('Todos');
  const [records, setRecords] = useState(initialRecords);
  const [selectedId, setSelectedId] = useState('DEMO-014');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Pavimento');
  const [imageName, setImageName] = useState('');
  const [imageSource, setImageSource] = useState('');
  const [point, setPoint] = useState({ x: 50, y: 50 });
  const [modal, setModal] = useState<'publish' | 'confirm' | null>(null);
  const [receiptId, setReceiptId] = useState('');
  const [toast, setToast] = useState('');
  const [newStatus, setNewStatus] = useState<Status>('Recebido');
  const [operatorNote, setOperatorNote] = useState('');
  const [operatorMode, setOperatorMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeDark);
    return () => document.documentElement.classList.remove('dark');
  }, [themeDark]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const cityRecords = useMemo(
    () => records.filter((record) => record.city === city),
    [city, records],
  );
  const visibleRecords = useMemo(
    () =>
      cityRecords.filter((record) => filter === 'Todos' || record.status === filter),
    [cityRecords, filter],
  );
  const selectedRecord = records.find((record) => record.id === selectedId);

  function openRecord(record: RecordItem) {
    setSelectedId(record.id);
    setNewStatus(record.status);
    setOperatorNote('');
    setView('detail');
  }

  function changeCity(nextCity: string) {
    setCity(nextCity);
    setFilter('Todos');
    const firstRecord = records.find((record) => record.city === nextCity);
    if (firstRecord) setSelectedId(firstRecord.id);
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>, source: string) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setToast('Escolha um arquivo de imagem.');
      event.currentTarget.value = '';
      return;
    }
    setImageName(file.name);
    setImageSource(source);
  }

  function setMapPoint(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPoint({
      x: Math.max(6, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(9, Math.min(91, ((event.clientY - bounds.top) / bounds.height) * 100)),
    });
  }

  function moveMapPoint(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 8 : 3;
    const movement: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    setPoint((current) => ({
      x: Math.max(6, Math.min(94, current.x + delta.x)),
      y: Math.max(9, Math.min(91, current.y + delta.y)),
    }));
  }

  function startReport() {
    setOperatorMode(false);
    setDescription('');
    setCategory('Pavimento');
    setImageName('');
    setImageSource('');
    setPoint({ x: 50, y: 50 });
    setReceiptId('');
    setView('report');
  }

  function requestPublish() {
    if (!description.trim()) {
      setToast('Escreva uma descrição antes de continuar.');
      document.getElementById('report-description')?.focus();
      return;
    }
    setModal('publish');
  }

  function createDemoReport() {
    const nextNumber =
      records.reduce(
        (highest, record) => Math.max(highest, Number(record.id.slice(5)) || 0),
        0,
      ) + 1;
    const id = `DEMO-${String(nextNumber).padStart(3, '0')}`;
    const item: RecordItem = {
      id,
      city,
      category,
      title:
        description.trim().split(/[.!?]/)[0].slice(0, 54) || 'Relato comunitário',
      status: 'Recebido',
      area: 'Ponto aproximado',
      created: 'Agora · sessão demonstrativa',
      description: description.trim(),
      x: point.x,
      y: point.y,
      history: [
        {
          status: 'Recebido',
          note: 'Relato demonstrativo criado nesta sessão.',
          created: 'Agora',
        },
      ],
      confirmations: 0,
    };
    setRecords((current) => [item, ...current]);
    setSelectedId(id);
    setReceiptId(id);
    setModal(null);
    setView('receipt');
  }

  function saveOperatorUpdate() {
    if (!selectedRecord) return;
    setRecords((current) =>
      current.map((record) =>
        record.id === selectedRecord.id
          ? {
              ...record,
              status: newStatus,
              history: [
                {
                  status: newStatus,
                  note: operatorNote.trim() || 'Atualização demonstrativa registrada.',
                  created: 'Agora · demonstração',
                },
                ...record.history,
              ],
            }
          : record,
      ),
    );
    setOperatorMode(false);
    setToast('Atualização demonstrativa salva nesta sessão.');
  }

  function confirmActive() {
    if (!selectedRecord) return;
    setRecords((current) =>
      current.map((record) =>
        record.id === selectedRecord.id
          ? { ...record, confirmations: record.confirmations + 1 }
          : record,
      ),
    );
    setModal(null);
    setToast('Confirmação de exemplo registrada nesta sessão.');
  }

  const isDetail = view === 'detail';
  const showBottomNav = view === 'explore' || view === 'report' || view === 'queue';

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="relative mx-auto min-h-screen max-w-[520px] overflow-hidden bg-background pb-[calc(78px+env(safe-area-inset-bottom))]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-card px-4">
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setView('explore')}
            aria-label="CITY EYES, voltar para explorar"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-extrabold tracking-tight text-primary-foreground">
              CE
            </span>
            <span>
              <span className="block text-sm font-extrabold tracking-[0.1em]">CITY EYES</span>
              <span className="block text-[10px] text-muted-foreground">
                cidade em foco · demonstração
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <Sun className="size-4 text-muted-foreground" aria-hidden="true" />
            <Switch
              checked={themeDark}
              onCheckedChange={setThemeDark}
              aria-label={themeDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            />
            <Moon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </header>

        <main className="space-y-4 px-4 pb-6 pt-5" aria-live="polite">
          {view === 'explore' && (
            <>
              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Olhos abertos para a cidade
                </p>
                <h1 className="mt-1 text-[25px] font-extrabold leading-tight tracking-tight">
                  O que precisa de atenção?
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Acompanhe exemplos de relatos e veja como uma fila pública pode organizar prioridades.
                </p>
              </section>

              <div className="space-y-1.5">
                <Label htmlFor="explore-city">Cidade</Label>
                <Select value={city} onValueChange={changeCity}>
                  <SelectTrigger id="explore-city" className="h-11 rounded-xl bg-card font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">DADOS DE DEMONSTRAÇÃO</Badge>
                <div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Forma de visualizar relatos">
                  <Button
                    type="button"
                    size="sm"
                    variant={mapMode === 'map' ? 'default' : 'ghost'}
                    aria-pressed={mapMode === 'map'}
                    onClick={() => setMapMode('map')}
                  >
                    <MapPin aria-hidden="true" /> Mapa
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mapMode === 'list' ? 'default' : 'ghost'}
                    aria-pressed={mapMode === 'list'}
                    onClick={() => setMapMode('list')}
                  >
                    Lista
                  </Button>
                </div>
              </div>

              {mapMode === 'map' && (
                <div
                  className="relative h-[190px] overflow-hidden rounded-2xl border border-border bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  role="img"
                  aria-label={`Mapa esquemático de ${city}, sem escala; os pontos ilustram relatos demonstrativos.`}
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(27deg, transparent 0 34px, hsl(var(--background)) 35px 42px, transparent 43px 68px), repeating-linear-gradient(118deg, transparent 0 52px, hsl(var(--background)) 53px 60px, transparent 61px 86px)',
                  }}
                >
                  <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                    {city} · área ilustrativa
                  </span>
                  {cityRecords.slice(0, 3).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-card bg-primary text-xs font-bold text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ left: `${record.x}%`, top: `${record.y}%` }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openRecord(record);
                      }}
                      aria-label={`Abrir exemplo: ${record.title}`}
                    >
                      {categoryInitial(record.category)}
                    </button>
                  ))}
                  <span className="absolute bottom-2 left-2 rounded bg-card/90 px-2 py-1 font-mono text-[9px] text-muted-foreground">
                    MAPA ESQUEMÁTICO · SEM ESCALA
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold">Relatos nesta cidade</h2>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {visibleRecords.length} exemplos
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar relatos por status">
                {statuses.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={filter === item ? 'secondary' : 'outline'}
                    size="sm"
                    aria-pressed={filter === item}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              {visibleRecords.length ? (
                <div className="grid gap-2">
                  {visibleRecords.map((record) => (
                    <ReportRow key={record.id} report={record} onClick={() => openRecord(record)} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-5 text-center">
                    <p className="font-bold">Nenhum relato nesta seleção</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Escolha outro status para ver os exemplos disponíveis.
                    </p>
                  </CardContent>
                </Card>
              )}
              <DemoNotice>
                Os relatos, locais e pontos no mapa são fictícios. O mapa é aproximado e não representa endereços reais.
              </DemoNotice>
            </>
          )}

          {view === 'report' && (
            <>
              <Button type="button" variant="ghost" onClick={() => setView('explore')}>
                <ArrowLeft aria-hidden="true" /> Voltar aos relatos
              </Button>
              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Contribuição cidadã · demonstração
                </p>
                <h1 className="mt-1 text-2xl font-extrabold">Conte o que você percebeu.</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Descreva o ponto e o impacto observado. Evite incluir dados pessoais.
                </p>
              </section>
              <div className="space-y-1.5">
                <Label htmlFor="report-city">Cidade</Label>
                <Select value={city} onValueChange={changeCity}>
                  <SelectTrigger id="report-city" className="h-11 rounded-xl bg-card font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-category">Categoria</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
                  <SelectTrigger id="report-category" className="h-11 rounded-xl bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-description">
                O que está acontecendo?
                </Label>
                <Textarea
                  id="report-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, 220))}
                  maxLength={220}
                  rows={4}
                  placeholder="Descreva o ponto e o impacto observado."
                  className="min-h-[100px] resize-y rounded-xl bg-card"
                />
                <span className="block text-right font-mono text-xs text-muted-foreground">
                  {description.length}/220
                </span>
              </div>

              <section className="space-y-2">
                <h2 className="text-sm font-extrabold">Imagem (opcional)</h2>
                <p className="text-xs text-muted-foreground">
                  Escolha uma imagem apenas para experimentar a interface.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card px-2 text-center text-xs font-bold focus-within:ring-2 focus-within:ring-ring">
                    <Eye className="size-4" aria-hidden="true" />
                    Usar câmera
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => chooseImage(event, 'câmera')}
                      aria-label="Selecionar imagem pela câmera"
                    />
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card px-2 text-center text-xs font-bold focus-within:ring-2 focus-within:ring-ring">
                    <ClipboardList className="size-4" aria-hidden="true" />
                    Da galeria
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={(event) => chooseImage(event, 'galeria')}
                      aria-label="Selecionar imagem da galeria"
                    />
                  </label>
                </div>
                {imageName && (
                  <Card>
                    <CardContent className="space-y-1 p-3">
                      <p className="truncate text-xs font-bold">{imageName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Origem declarada: {imageSource} · não verificada
                      </p>
                    </CardContent>
                  </Card>
                )}
                <DemoNotice>
                  Foto, câmera e origem informada não comprovam autenticidade. Nenhuma análise de imagem é feita neste protótipo.
                </DemoNotice>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold">Marque um ponto aproximado</h2>
                  <Badge variant="outline">LOCAL ILUSTRATIVO</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Toque no mapa ou use as setas do teclado para posicionar. Não pedimos acesso à sua localização.
                </p>
                <div
                  className="relative h-[150px] rounded-2xl border border-border bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  role="application"
                  aria-label="Mapa esquemático para escolher ponto aproximado. Use as setas do teclado para mover o ponto."
                  tabIndex={0}
                  onClick={setMapPoint}
                  onKeyDown={moveMapPoint}
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(27deg, transparent 0 34px, hsl(var(--background)) 35px 42px, transparent 43px 68px), repeating-linear-gradient(118deg, transparent 0 52px, hsl(var(--background)) 53px 60px, transparent 61px 86px)',
                  }}
                >
                  <span
                    className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-card bg-accent font-bold text-accent-foreground shadow-sm"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground" aria-live="polite">
                  Ponto manual: {Math.round(point.x)}%, {Math.round(point.y)}%
                </p>
              </section>
              <DemoNotice>
                Protótipo sem envio real. Relato, ponto, imagem e qualquer resultado são demonstrações; não compartilhe informações pessoais.
              </DemoNotice>
              <Button type="button" className="min-h-11 w-full" onClick={requestPublish}>
                Revisar exemplo <ArrowRight aria-hidden="true" />
              </Button>
            </>
          )}

          {view === 'queue' && (
            <>
              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Espaço de operação · demonstração
                </p>
                <h1 className="mt-1 text-2xl font-extrabold">Fila municipal</h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Área de operador simulada; não há autenticação nem conexão com uma prefeitura.
                </p>
              </section>
              <div className="space-y-1.5">
                <Label htmlFor="queue-city">Cidade</Label>
                <Select value={city} onValueChange={changeCity}>
                  <SelectTrigger id="queue-city" className="h-11 rounded-xl bg-card font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DemoNotice>
                MODO DEMO — registros fictícios. Abra um exemplo para experimentar uma atualização de status e nota pública.
              </DemoNotice>
              <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar fila por status">
                {statuses.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={filter === item ? 'secondary' : 'outline'}
                    size="sm"
                    aria-pressed={filter === item}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              {visibleRecords.length ? (
                <div className="grid gap-2">
                  {visibleRecords.map((record) => (
                    <ReportRow key={record.id} report={record} onClick={() => openRecord(record)} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                  Fila sem exemplos neste status.
                </p>
              )}
            </>
          )}

          {isDetail && (
            <>
              <Button type="button" variant="ghost" onClick={() => setView(operatorMode ? 'queue' : 'explore')}>
                <ArrowLeft aria-hidden="true" /> Voltar
              </Button>
              {selectedRecord ? (
                <>
                  <section>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {city} · {selectedRecord.area} · relato público demonstrativo
                    </p>
                    <h1 className="mt-1 text-2xl font-extrabold">{selectedRecord.title}</h1>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {selectedRecord.id} · {selectedRecord.created}
                    </p>
                    <div className="mt-3">
                      <Badge variant={statusVariant(selectedRecord.status)}>{selectedRecord.status}</Badge>
                    </div>
                  </section>
                  <Card>
                    <CardContent className="space-y-2 p-4">
                      <h2 className="text-sm font-extrabold">Sobre este exemplo</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {selectedRecord.description}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Categoria: {selectedRecord.category} · localização fictícia
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-extrabold">Histórico público</h2>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {selectedRecord.history.length} atualizações
                        </span>
                      </div>
                      <ol className="space-y-3 border-l border-border pl-4">
                        {selectedRecord.history.map((event, index) => (
                          <li key={`${event.created}-${index}`} className="relative">
                            <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" aria-hidden="true" />
                            <p className="text-xs font-bold">{event.status}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{event.note}</p>
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                              {event.created} · ação demonstrativa
                            </p>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                  {operatorMode ? (
                    <Card>
                      <CardContent className="space-y-3 p-4">
                        <h2 className="text-sm font-extrabold">Atualizar como operador demonstrador</h2>
                        <div className="space-y-1.5">
                          <Label htmlFor="operator-status">Novo status</Label>
                          <Select value={newStatus} onValueChange={(value) => setNewStatus(value as Status)}>
                            <SelectTrigger id="operator-status" className="h-11 rounded-xl bg-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            {statuses.filter((item): item is Status => item !== 'Todos').map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="operator-note">Nota pública breve</Label>
                          <Textarea
                            id="operator-note"
                            maxLength={160}
                            rows={3}
                            value={operatorNote}
                            onChange={(event) => setOperatorNote(event.target.value)}
                            placeholder="Explique a atualização de forma clara."
                            className="min-h-[80px] rounded-xl bg-card"
                          />
                        </div>
                        <Button type="button" className="w-full" onClick={saveOperatorUpdate}>
                          Salvar atualização demonstrativa
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Button type="button" className="w-full" onClick={() => setModal('confirm')}>
                        <UsersRound aria-hidden="true" /> Confirmar que continua ativo
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        {selectedRecord.confirmations} confirmações de exemplo · ação simulada.
                      </p>
                    </>
                  )}
                  <DemoNotice>
                    Este registro e seu histórico são exemplos. Confirmações e atualizações não são enviadas a um município.
                  </DemoNotice>
                </>
              ) : (
                <DemoNotice>Este relato demonstrativo não está disponível.</DemoNotice>
              )}
            </>
          )}

          {view === 'receipt' && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Relato enviado · simulação
              </p>
              <h1 className="text-2xl font-extrabold">Obrigado por olhar de perto.</h1>
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="font-mono text-[10px] text-muted-foreground">PROTOCOLO DEMONSTRATIVO</p>
                  <p className="text-xl font-extrabold text-primary">{receiptId}</p>
                  <p className="text-sm text-muted-foreground">
                    Seu exemplo foi adicionado apenas à fila desta sessão.
                  </p>
                </CardContent>
              </Card>
              <DemoNotice>
                Imagem, origem e qualquer sugestão automatizada não comprovam autenticidade. A análise é apenas uma simulação de triagem, nunca um veredito.
              </DemoNotice>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setOperatorMode(false);
                  setView('detail');
                }}
              >
                Ver relato <ArrowRight aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={startReport}>
                Criar outro exemplo
              </Button>
            </>
          )}
        </main>

        {showBottomNav && (
          <nav
            className="fixed bottom-0 left-1/2 z-20 flex h-[calc(70px+env(safe-area-inset-bottom))] w-full max-w-[520px] -translate-x-1/2 items-start justify-around border-t border-border bg-card px-2 pt-2"
            aria-label="Navegação principal"
          >
            <button
              type="button"
              className={`flex min-h-12 min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === 'explore' ? 'text-primary' : 'text-muted-foreground'}`}
              aria-current={view === 'explore' ? 'page' : undefined}
              onClick={() => {
                setOperatorMode(false);
                setView('explore');
              }}
            >
              <MapPin className="size-5" aria-hidden="true" />
              Explorar
            </button>
            <button
              type="button"
              className={`flex min-h-12 min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === 'report' ? 'text-primary' : 'text-muted-foreground'}`}
              aria-current={view === 'report' ? 'page' : undefined}
              onClick={startReport}
            >
              <Plus className="size-5" aria-hidden="true" />
              Relatar
            </button>
            <button
              type="button"
              className={`flex min-h-12 min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === 'queue' ? 'text-primary' : 'text-muted-foreground'}`}
              aria-current={view === 'queue' ? 'page' : undefined}
              onClick={() => {
                setOperatorMode(true);
                setView('queue');
                setFilter('Todos');
              }}
            >
              <ClipboardList className="size-5" aria-hidden="true" />
              Fila demo
            </button>
          </nav>
        )}

        {toast && (
          <div
            role="status"
            className="fixed bottom-20 left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground shadow-lg"
          >
            {toast}
          </div>
        )}

        <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
          <DialogContent className="max-w-[420px] rounded-2xl bg-card p-5 text-card-foreground">
            <DialogHeader className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Etapa demonstrativa
              </p>
              <DialogTitle className="text-lg font-extrabold">
                {modal === 'publish' ? 'Continuar com exemplo?' : 'Confirmar este exemplo?'}
              </DialogTitle>
              <DialogDescription className="leading-relaxed">
                {modal === 'publish'
                  ? 'Esta ação simula a entrada de uma pessoa demonstradora. Nenhuma conta será criada e nada será enviado a serviços externos.'
                  : 'A confirmação será exibida apenas nesta sessão de demonstração.'}
              </DialogDescription>
            </DialogHeader>
            <DemoNotice>
              SIMULAÇÃO — este protótipo não autentica, não envia relatos e não atualiza dados municipais.
            </DemoNotice>
            <DialogFooter className="grid gap-2 sm:grid-cols-1 sm:space-x-0">
              <Button
                type="button"
                className="w-full"
                onClick={modal === 'publish' ? createDemoReport : confirmActive}
              >
                <Check aria-hidden="true" />
                {modal === 'publish' ? 'Continuar como pessoa demonstradora' : 'Confirmar exemplo'}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setModal(null)}>
                Agora não
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
