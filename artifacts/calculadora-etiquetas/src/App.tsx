import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getAuthGetCurrentUserQueryKey,
  getAuthListUsersQueryKey,
  useAuthChangePassword,
  useAuthCreateUser,
  useAuthListUsers,
  useAuthLogin,
  useAuthLogout,
  useAuthUpdateUser,
  type AuthChangePasswordInput,
  type AuthCreateUserInput,
  type AuthLoginInput,
  type AuthUserList,
  type AuthUser,
  type AuthUserUpdateInput,
} from '@workspace/api-client-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ArrowRight,
  Ban,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Info,
  Layers3,
  Menu,
  PackageOpen,
  RotateCcw,
  Ruler,
  Scissors,
  Search,
  ShieldCheck,
  Tag,
  Table2,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { useAuthSession } from './lib/auth-session';
import { trackAuthEvent } from './lib/analytics';
import perfectaPrintLogo from './assets/logo-perfecta-print.jpg';
import workbookData from './data/workbook-data.json';

const queryClient = new QueryClient();
const isOfflineBuild = import.meta.env.VITE_OFFLINE_BUILD === 'true';
const basePath = isOfflineBuild ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');

type InputValue = number | '';

type EtiqValues = {
  width: InputValue;
  gap: InputValue;
  height: InputValue;
  careers: InputValue;
  length: InputValue;
  rolls: InputValue;
  price: InputValue;
};

type TagValues = {
  width: InputValue;
  height: InputValue;
  careers: InputValue;
  length: InputValue;
  rolls: InputValue;
  price: InputValue;
};

const initialEtiq: EtiqValues = {
  width: 100,
  gap: 6,
  height: 150,
  careers: 1,
  length: 35,
  rolls: 1,
  price: 12.09,
};

const initialTag: TagValues = {
  width: 150,
  height: 170,
  careers: 1,
  length: 170,
  rolls: 250,
  price: 3.65,
};

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return money.format(Number.isFinite(value) ? value : 0);
}

function formatDecimal(value: number) {
  return decimal.format(Number.isFinite(value) ? value : 0);
}

function formatInteger(value: number) {
  return integer.format(Number.isFinite(value) ? value : 0);
}

function formatCommission(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(2).replace('.', ',')}%`;
}

function numericValue(value: InputValue) {
  return value === '' ? 0 : value;
}

function Field({
  label,
  value,
  onChange,
  suffix,
  helper,
  step = 1,
  min = 0,
  testId,
}: {
  label: string;
  value: InputValue;
  onChange: (value: string) => void;
  suffix?: string;
  helper?: string;
  step?: number;
  min?: number;
  testId: string;
}) {
  return (
    <label className="group block" data-testid={`field-${testId}`}>
      <span className="mb-2 flex items-center justify-between gap-3 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <span>{label}</span>
        {suffix ? <span className="font-display text-[11px] font-semibold normal-case tracking-normal text-primary">{suffix}</span> : null}
      </span>
      <span className="relative block">
        <input
          className="h-12 w-full rounded-lg border border-border bg-background px-4 pr-16 font-display text-[17px] font-semibold text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/60 hover:border-muted-foreground/60 focus:border-primary focus:bg-card"
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid={`input-${testId}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-display text-[11px] font-semibold text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
      {helper ? <span className="mt-1.5 block text-[11px] leading-4 text-muted-foreground">{helper}</span> : null}
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = false,
  testId,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
  testId: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-accent/50 bg-accent/10' : 'border-border bg-background/55'}`} data-testid={`metric-${testId}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-[22px] font-bold tracking-tight ${accent ? 'text-secondary' : 'text-foreground'}`} data-testid={`value-${testId}`}>
        {value}
      </p>
      {detail ? <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-white/20" data-testid="brand-mark">
      <img src={perfectaPrintLogo} alt="Calculadora Perfecta Print — etiquetas e rótulos autoadesivos" className="block h-auto w-full" />
    </div>
  );
}

const navigation = [
  { href: '/app', label: 'Etiquetas adesivas', description: 'Cálculo por rolo', icon: Calculator },
  { href: '/tag', label: 'Etiquetas TAG', description: 'Cálculo de tags', icon: Tag },
  { href: '/tabela-etiquetas', label: 'Tabela Etiq', description: 'Materiais e preços', icon: Table2 },
  { href: '/consultas', label: 'Consultas', description: 'Outras referências', icon: BookOpen },
  { href: '/acessos', label: 'Usuários', description: 'Contas do sistema', icon: ShieldCheck },
];

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres.')
  .max(40, 'Use no máximo 40 caracteres.')
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}$/, 'Use letras, números, ponto, hífen ou sublinhado.');
const loginFormSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Informe sua senha.').max(256),
});
const createUserFormSchema = z.object({
  username: usernameSchema,
  displayName: z.string().max(80, 'Use no máximo 80 caracteres.'),
  password: z.string().min(12, 'A senha precisa ter pelo menos 12 caracteres.').max(256),
});
const updateUserFormSchema = z.object({
  username: usernameSchema,
  displayName: z.string().max(80, 'Use no máximo 80 caracteres.'),
  password: z.string().max(256).refine((value) => value.length === 0 || value.length >= 12, 'Use 12 caracteres ou deixe em branco.'),
});
const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.').max(256),
    newPassword: z.string().min(12, 'Use pelo menos 12 caracteres.').max(256),
    confirmPassword: z.string().min(12, 'Confirme a nova senha.').max(256),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const data = 'data' in error ? error.data : null;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return fallback;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const { user } = useAuthSession();
  const signOut = useAuthLogout();
  const queryClient = useQueryClient();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const visibleNavigation = navigation.filter((item) => item.href !== '/acessos' || user?.role === 'master');
  const accountName = user?.displayName || user?.username || 'usuário';
  const initials = accountName.slice(0, 2).toUpperCase() || 'PP';

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await signOut.mutateAsync();
      queryClient.removeQueries({ queryKey: getAuthListUsersQueryKey() });
      queryClient.removeQueries({ queryKey: getAuthGetCurrentUserQueryKey() });
      setLocation('/');
    } catch (error) {
      setSignOutError(apiErrorMessage(error, 'Não foi possível encerrar a sessão.'));
    }
  };

  return (
    <div className="paper-noise flex min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-300 md:relative md:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`} data-testid="sidebar">
        <div className="flex items-center justify-between">
          <BrandMark />
          <button className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent md:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" data-testid="button-close-menu">
            <X size={18} />
          </button>
        </div>

        <div className="mt-12">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/40">Área de trabalho</p>
          <nav className="mt-3 space-y-1" aria-label="Navegação principal">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              const active = location === item.href;
              return (
                <Link
                  href={item.href}
                  key={item.href}
                  onClick={() => setMobileMenu(false)}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}
                  data-testid={`link-nav-${item.href === '/' ? 'etiquetas' : item.href.slice(1)}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-sidebar-foreground/8 text-sidebar-foreground/55 group-hover:text-accent'}`}>
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-sidebar-foreground/40">{item.description}</span>
                  </span>
                  {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/55 p-4" data-testid="status-workspace">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent" /></span>
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/65">Ambiente local</span>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-sidebar-foreground/45">Cálculos feitos no dispositivo. Nenhum dado sai desta mesa.</p>
        </div>
      </aside>

      {mobileMenu ? <button className="fixed inset-0 z-40 bg-sidebar/45 md:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar navegação" data-testid="button-overlay-menu" /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur md:px-9" data-testid="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-lg border border-border bg-card p-2.5 text-muted-foreground md:hidden" onClick={() => setMobileMenu(true)} aria-label="Abrir menu" data-testid="button-open-menu">
              <Menu size={18} />
            </button>
            <div className="hidden h-7 w-px bg-border md:block" />
             <p className="min-w-0 truncate text-[12px] font-semibold text-muted-foreground"><span className="text-foreground">Mesa de produção</span><span className="mx-2 text-border">/</span>{location === '/consultas' ? 'consultas' : location === '/tabela-etiquetas' ? 'tabela etiq' : location === '/tag' ? 'etiquetas tag' : location === '/acessos' ? 'acessos' : 'etiquetas adesivas'}</p>
          </div>
          <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 text-[11px] font-semibold text-muted-foreground sm:flex" data-testid="status-ready"><Check size={14} className="text-secondary" /> {accountName}</span>
             <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-display text-[11px] font-bold text-secondary-foreground" data-testid="avatar-user">{initials}</span>
              <button type="button" onClick={() => void handleSignOut()} disabled={signOut.isPending} className="rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50" data-testid="button-sign-out">{signOut.isPending ? 'Saindo…' : 'Sair'}</button>
          </div>
        </header>
        {signOutError ? <p className="px-5 pt-3 text-right text-[11px] font-semibold text-destructive" role="alert" data-testid="status-sign-out-error">{signOutError}</p> : null}
        <main className="app-grid min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="animate-rise-in">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {eyebrow}
        </div>
        <h1 className="font-display text-[30px] font-bold leading-[1.06] tracking-[-0.045em] text-foreground sm:text-[38px]" data-testid="heading-page">{title}</h1>
        <p className="mt-3 max-w-[600px] text-[13px] leading-6 text-muted-foreground" data-testid="text-page-description">{description}</p>
      </div>
      {action ? <div className="animate-rise-in" style={{ animationDelay: '80ms' }}>{action}</div> : null}
    </div>
  );
}

function CalculatorPage({ kind }: { kind: 'etiq' | 'tag' }) {
  const isEtiq = kind === 'etiq';
  const [etiq, setEtiq] = useState<EtiqValues>(initialEtiq);
  const [tag, setTag] = useState<TagValues>(initialTag);
  const values = isEtiq ? etiq : tag;

  const calculation = useMemo(() => {
    if (isEtiq) {
      const width = numericValue(etiq.width);
      const gap = numericValue(etiq.gap);
      const height = numericValue(etiq.height);
      const length = numericValue(etiq.length);
      const rolls = numericValue(etiq.rolls);
      const price = numericValue(etiq.price);
      const careers = Math.max(1, numericValue(etiq.careers));
      const totalM2 = (((width + gap) * careers * length) / 1000) * rolls;
      const bobina = rolls * length;
      const vendaMil = ((width + gap / careers) / 1000) * (height + 3) * price;
      const labels = (length / ((height + 3) / 1000)) * careers;
      const rollsValue = (labels * vendaMil) / 1000;
      return { totalM2, bobina, vendaMil, labels, rollsValue, unit: 'm²' };
    }
    const width = numericValue(tag.width);
    const height = numericValue(tag.height);
    const length = numericValue(tag.length);
    const rolls = numericValue(tag.rolls);
    const price = numericValue(tag.price);
    const careers = Math.max(1, numericValue(tag.careers));
    const totalM2 = (((width * careers + 10) * length) / 1000) * rolls;
    const vendaMil = ((width + 10 / careers) / 1000) * height * price;
    const labels = (length / (height / 1000)) * careers;
    const rollsValue = (labels * vendaMil) / 1000;
    return { totalM2, bobina: 0, vendaMil, labels, rollsValue, unit: 'm²' };
  }, [etiq, isEtiq, tag]);

  const updateEtiq = (field: keyof EtiqValues, value: string) => {
    setEtiq((current) => ({ ...current, [field]: value === '' ? '' : Number(value) }));
  };
  const updateTag = (field: keyof TagValues, value: string) => {
    setTag((current) => ({ ...current, [field]: value === '' ? '' : Number(value) }));
  };
  const reset = () => (isEtiq ? setEtiq(initialEtiq) : setTag(initialTag));

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-11">
      <PageIntro
        eyebrow={isEtiq ? 'Cálculo de adesivas' : 'Cálculo de tags'}
        title={isEtiq ? 'Etiquetas adesivas' : 'Etiquetas TAG'}
        description={isEtiq ? 'Configure o aproveitamento do rolo e veja o preço de venda em poucos campos.' : 'Uma leitura direta para tags: área, rendimento por mil e valor de rolo em tempo real.'}
        action={
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-[12px] font-bold text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary" onClick={reset} data-testid={`button-reset-${kind}`}>
            <RotateCcw size={14} /> Restaurar referência
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="animate-rise-in rounded-2xl border border-card-border bg-card p-5 shadow-card sm:p-7" style={{ animationDelay: '100ms' }} data-testid={`card-inputs-${kind}`}>
          <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10 text-secondary"><Ruler size={16} /></span>
                <h2 className="font-display text-[16px] font-bold">Parâmetros de produção</h2>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">Medidas em milímetros, salvo indicação contrária.</p>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">editável</span>
          </div>

          <div className="mt-7 grid gap-x-5 gap-y-6 sm:grid-cols-2">
            <Field label="Largura" value={values.width} onChange={(v) => isEtiq ? updateEtiq('width', v) : updateTag('width', v)} suffix="mm" helper={isEtiq ? 'Largura de cada etiqueta' : 'Largura final da tag'} testId={`${kind}-width`} />
            {isEtiq ? <Field label="Espessura / entre etiquetas" value={etiq.gap} onChange={(v) => updateEtiq('gap', v)} suffix="mm" helper="Respiro entre etiquetas na faca" testId="etiq-gap" step={0.1} /> : <Field label="Altura" value={tag.height} onChange={(v) => updateTag('height', v)} suffix="mm" helper="Altura final da tag" testId="tag-height" />}
            {isEtiq ? <Field label="Altura" value={etiq.height} onChange={(v) => updateEtiq('height', v)} suffix="mm" helper="Altura final da etiqueta" testId="etiq-height" /> : <Field label="Carreiras" value={tag.careers} onChange={(v) => updateTag('careers', v)} suffix="un." helper="Etiquetas lado a lado" testId="tag-careers" min={1} />}
            {isEtiq ? <Field label="Carreiras" value={etiq.careers} onChange={(v) => updateEtiq('careers', v)} suffix="un." helper="Etiquetas lado a lado" testId="etiq-careers" min={1} /> : <Field label="Comprimento do rolo" value={tag.length} onChange={(v) => updateTag('length', v)} suffix="m" helper="Comprimento útil do material" testId="tag-length" />}
            {isEtiq ? <Field label="Comprimento do rolo" value={etiq.length} onChange={(v) => updateEtiq('length', v)} suffix="m" helper="Comprimento útil do material" testId="etiq-length" /> : <Field label="Quantidade de rolos" value={tag.rolls} onChange={(v) => updateTag('rolls', v)} suffix="un." helper="Rolos no pedido" testId="tag-rolls" min={1} />}
            {isEtiq ? <Field label="Quantidade de rolos" value={etiq.rolls} onChange={(v) => updateEtiq('rolls', v)} suffix="un." helper="Rolos no pedido" testId="etiq-rolls" min={1} /> : <Field label="Preço do m²" value={tag.price} onChange={(v) => updateTag('price', v)} suffix="R$/m²" helper="Base de venda aplicada" testId="tag-price" step={0.01} />}
            {isEtiq ? <Field label="Preço do m²" value={etiq.price} onChange={(v) => updateEtiq('price', v)} suffix="R$/m²" helper="Base de venda aplicada" testId="etiq-price" step={0.01} /> : null}
          </div>

          <div className="mt-8 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-4">
            <Info size={16} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-[11px] leading-5 text-muted-foreground"><strong className="font-bold text-foreground">Leitura rápida:</strong> qualquer ajuste atualiza os resultados ao lado. Os acréscimos técnicos de 3 mm da adesiva e 10 mm da tag já estão incorporados na fórmula.</p>
          </div>
        </section>

        <section className="animate-rise-in overflow-hidden rounded-2xl border border-secondary/25 bg-secondary text-secondary-foreground shadow-card" style={{ animationDelay: '160ms' }} data-testid={`card-results-${kind}`}>
          <div className="relative overflow-hidden p-6 sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full border-[18px] border-secondary-foreground/5" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-40 w-40 rounded-full border-[16px] border-accent/10" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-foreground/60"><CircleDollarSign size={15} className="text-accent" /> orçamento instantâneo</span>
                <span className="rounded-full border border-secondary-foreground/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-secondary-foreground/55">{isEtiq ? 'adesiva' : 'tag'}</span>
              </div>
              <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-foreground/55">Valor estimado dos rolos</p>
              <p className="mt-1 font-display text-[42px] font-bold leading-none tracking-[-0.06em] text-accent sm:text-[50px]" data-testid={`value-rolls-${kind}`}>{formatMoney(calculation.rollsValue)}</p>
              <p className="mt-3 text-[12px] text-secondary-foreground/60">a partir dos parâmetros informados</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-secondary-foreground/10 bg-secondary-foreground/10">
            <div className="bg-secondary p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-foreground/50">Venda por mil</p><p className="mt-2 font-display text-[21px] font-bold" data-testid={`value-sale-thousand-${kind}`}>{formatMoney(calculation.vendaMil)}</p></div>
            <div className="bg-secondary p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-foreground/50">Quantidade</p><p className="mt-2 font-display text-[21px] font-bold" data-testid={`value-labels-${kind}`}>{formatInteger(calculation.labels)} <span className="text-[11px] font-semibold text-secondary-foreground/50">un.</span></p></div>
          </div>
          <div className="space-y-3 p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4 text-[12px]"><span className="text-secondary-foreground/55">Área total</span><strong className="font-display" data-testid={`value-area-${kind}`}>{formatDecimal(calculation.totalM2)} m²</strong></div>
            {isEtiq ? <div className="flex items-center justify-between gap-4 text-[12px]"><span className="text-secondary-foreground/55">Bobina total</span><strong className="font-display" data-testid="value-bobina-etiq">{formatInteger(calculation.bobina)} m</strong></div> : null}
            <div className="h-px bg-secondary-foreground/10" />
            <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-secondary-foreground/40">Memória de cálculo</p>
            <p className="font-display text-[10px] leading-5 text-secondary-foreground/55" data-testid={`text-calc-formula-${kind}`}>
              {isEtiq ? '(((largura + espaço) × carreiras) × comprimento ÷ 1000) × rolos' : '(((largura × carreiras + 10) × comprimento ÷ 1000) × rolos)'}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/75 p-4" data-testid={`note-material-${kind}`}><div className="flex items-center gap-2 text-secondary"><Layers3 size={16} /><span className="text-[11px] font-bold uppercase tracking-[0.1em]">aproveitamento</span></div><p className="mt-2 text-[12px] leading-5 text-muted-foreground">A área considera o espaçamento técnico para não subestimar o consumo.</p></div>
        <div className="rounded-xl border border-border bg-card/75 p-4" data-testid={`note-output-${kind}`}><div className="flex items-center gap-2 text-secondary"><PackageOpen size={16} /><span className="text-[11px] font-bold uppercase tracking-[0.1em]">saída</span></div><p className="mt-2 text-[12px] leading-5 text-muted-foreground">O valor dos rolos acompanha a quantidade calculada por mil.</p></div>
        <div className="rounded-xl border border-border bg-card/75 p-4" data-testid={`note-reference-${kind}`}><div className="flex items-center gap-2 text-secondary"><ClipboardList size={16} /><span className="text-[11px] font-bold uppercase tracking-[0.1em]">referência</span></div><p className="mt-2 text-[12px] leading-5 text-muted-foreground">Use restaurar referência para voltar aos números da planilha.</p></div>
      </div>
    </div>
  );
}

type EtiqRow = { material: string; supplier: string; finish: string; prices: number[] };

function normalizeMaterialName(value: string) {
  return value
    .replace(/\bSOF[AÁ]\b/gi, 'COUCHÊ')
    .replace(/\bCOUCHE\b/gi, 'COUCHÊ')
    .replace(/\s+/g, ' ')
    .trim();
}

const etiqRows: EtiqRow[] = workbookData.etiq.map((row) => ({
  material: normalizeMaterialName(row.material),
  supplier: row.supplier.trim(),
  finish: 'tabela 2026',
  prices: row.prices.map((value) => Number(value ?? 0)),
}));

const commissionLabels = workbookData.quantityLabels.map((value) => {
  const commission = Number(value.replace(',', '.')) * 100;
  return `${commission.toFixed(2).replace('.', ',')}%`;
});

const bases = [
  { value: 1, multiplier: 1 },
  { value: 2, multiplier: 1.25 },
  { value: 3, multiplier: 1.35 },
  { value: 4, multiplier: 1.45 },
  { value: 5, multiplier: 1.55 },
  { value: 6, multiplier: 1.65 },
];

function EtiqTablePage() {
  const [base, setBase] = useState(1);
  const [search, setSearch] = useState('');
  const selectedBase = bases.find((item) => item.value === base) ?? bases[0];
  const selectedMultiplier = selectedBase.multiplier;
  const filteredRows = useMemo(() => etiqRows.filter((row) => `${row.material} ${row.finish}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const adjustedRows = useMemo(
    () => filteredRows.map((row) => ({ ...row, prices: row.prices.map((price) => price * selectedMultiplier) })),
    [filteredRows, selectedMultiplier],
  );

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-11">
      <PageIntro eyebrow="Consulta de insumos" title="Tabela Etiq" description="Preços de materiais adesivos organizados por faixa de quantidade. Selecione a base de cores para recalcular os valores derivados." action={<Link href="/" className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-3 text-[12px] font-bold text-secondary-foreground shadow-sm transition-transform hover:-translate-y-0.5" data-testid="link-go-calculator"><Calculator size={15} /> Abrir calculadora <ArrowRight size={14} /></Link>} />
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card sm:p-7" data-testid="card-etiq-table">
        <div className="flex flex-col justify-between gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Table2 size={16} /></span><h2 className="font-display text-[17px] font-bold">Preço por material e quantidade</h2></div>
            <p className="mt-2 text-[12px] text-muted-foreground">Base aplicada: <strong className="text-foreground" data-testid="text-selected-base">{base} {base === 1 ? 'cor' : 'cores'}</strong> <span className="mx-1 text-border">·</span> multiplicador <span className="font-display text-foreground" data-testid="text-selected-multiplier">{selectedMultiplier.toFixed(2).replace('.', ',')}×</span></p>
          </div>
           <label className="relative block w-full lg:w-[260px]"><Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Buscar material" className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-[12px] outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary" data-testid="input-search-etiq" /></label>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Base de cores">
            {bases.map((item) => (
              <button key={item.value} onClick={() => setBase(item.value)} className={`flex min-w-[54px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-[12px] font-bold transition-colors ${base === item.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary'}`} data-testid={`button-base-${item.value}`}>
                {item.value} <span className="text-[10px] font-semibold opacity-70">{item.value === 1 ? 'cor' : 'cores'}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"><Info size={13} className="text-primary" /> A base de cores aplica o multiplicador da planilha sobre cada faixa de preço.</div>
        </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[3600px] border-collapse text-left" data-testid="table-etiq">
            <thead><tr className="border-b border-border bg-muted/55 text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground"><th className="sticky left-0 z-10 w-[260px] min-w-[260px] bg-muted px-4 py-3.5">Material</th><th className="w-[120px] min-w-[120px] px-4 py-3.5">Referência</th>{commissionLabels.map((label) => <th className="w-[90px] min-w-[90px] px-4 py-3.5 text-right" key={label}>Comissão<br />{label}</th>)}</tr></thead>
            <tbody>
              {adjustedRows.map((row, index) => <tr key={`${base}-${row.material}-${index}`} className="border-b border-border/70 last:border-0 hover:bg-primary/[0.025]" data-testid={`row-etiq-${index}`}><td className="sticky left-0 z-10 bg-card px-4 py-4 text-[12px] font-bold text-foreground">{row.material}</td><td className="px-4 py-4"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{row.finish}</span></td>{row.prices.map((price, priceIndex) => <td key={priceIndex} className="px-4 py-4 text-right font-display text-[13px] font-semibold text-secondary" data-testid={`price-${index}-${priceIndex}`}>{formatMoney(price)}<span className="ml-1 text-[10px] font-sans font-medium text-muted-foreground">/m²</span></td>)}</tr>)}
              {adjustedRows.length === 0 ? <tr><td colSpan={2 + commissionLabels.length} className="px-4 py-14 text-center"><Search size={22} className="mx-auto text-muted-foreground/50" /><p className="mt-3 text-[13px] font-bold">Nenhum material encontrado</p><p className="mt-1 text-[12px] text-muted-foreground">Tente outra palavra ou limpe a busca.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span data-testid="text-etiq-row-count">{filteredRows.length} materiais exibidos</span><span className="flex items-center gap-1.5"><ChevronDown size={13} /> role para ver todas as faixas</span></div>
      </section>
    </div>
  );
}

type ConsultationKey = 'base' | 'ribb' | 'flexo' | 'batida';
type RibbonFilter = 'all' | 'Cera' | 'Misto' | 'Resina';
type RibbonCommissionFilter = 'all' | number;

const ribbonFilterOptions: { value: RibbonFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'Cera', label: 'Cera' },
  { value: 'Misto', label: 'Misto' },
  { value: 'Resina', label: 'Resina' },
];

const ribbonCommissionValues = Array.from(new Set(workbookData.ribb.map((row) => row.commission)))
  .filter((value): value is number => value !== null && value !== undefined)
  .sort((first, second) => first - second);

const ribbonCommissionOptions: { value: RibbonCommissionFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  ...ribbonCommissionValues.map((value) => ({ value, label: formatCommission(value) })),
];

const ribbonTypeOrder: Record<string, number> = {
  'Ribbon Cera': 0,
  'Ribbon Misto': 1,
  'Ribbon Resina': 2,
};

function ribbonMeasureParts(measure: string) {
  const match = measure.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as const;
  return [Number(match[1].replace(',', '.')), Number(match[2].replace(',', '.'))] as const;
}

const sortedRibbonRows = [...workbookData.ribb].sort((first, second) => {
  const [firstWidth, firstHeight] = ribbonMeasureParts(first.measure);
  const [secondWidth, secondHeight] = ribbonMeasureParts(second.measure);
  return (
    firstWidth - secondWidth ||
    firstHeight - secondHeight ||
    (ribbonTypeOrder[first.ribbon] ?? 99) - (ribbonTypeOrder[second.ribbon] ?? 99) ||
    (first.commission ?? Number.POSITIVE_INFINITY) - (second.commission ?? Number.POSITIVE_INFINITY)
  );
});

const consultations: Record<ConsultationKey, { label: string; icon: typeof FileText; columns: string[]; rows: string[][] }> = {
  base: {
    label: 'Tabela Base Preço',
    icon: FileText,
    columns: ['Categoria', 'Material', 'Fornecedor', 'Preço inicial'],
    rows: workbookData.base.slice(0, 36).map((row) => ['Adesivo', row.material, row.supplier, formatMoney(row.price)]),
  },
  ribb: {
    label: 'Tabela Ribbon',
    icon: ClipboardList,
    columns: ['Tipo', 'Medida', 'Faixa de preço', 'Comissão'],
    rows: sortedRibbonRows.map((row) => [
      row.ribbon,
      row.measure || '—',
      row.price || '—',
      formatCommission(row.commission),
    ]),
  },
  flexo: {
    label: 'Facas Flexo',
    icon: Scissors,
    columns: ['Nº', 'Medida', 'Z', 'Juntas / separada'],
    rows: workbookData.flexo.slice(0, 120).map((row) => [
      row.number ? String(row.number) : '—',
      row.measure || '—',
      row.z ? `Z ${row.z}` : '—',
      [row.note, row.observation].filter(Boolean).join(' · ') || '—',
    ]),
  },
  batida: {
    label: 'Facas Batida',
    icon: Ruler,
    columns: ['Nº', 'Medida', 'Observação', 'Fonte'],
    rows: workbookData.batida.slice(0, 120).map((row) => [
      row.number ? String(row.number) : '—',
      row.measure || '—',
      row.note || '—',
      'Facas batida 2026',
    ]),
  },
};

function ConsultasPage() {
  const [selected, setSelected] = useState<ConsultationKey>('base');
  const [search, setSearch] = useState('');
  const [ribbonFilter, setRibbonFilter] = useState<RibbonFilter>('all');
  const [ribbonCommissionFilter, setRibbonCommissionFilter] = useState<RibbonCommissionFilter>('all');
  const data = consultations[selected];
  const rows = useMemo(
    () =>
      data.rows.filter((row) => {
        const matchesRibbon = selected !== 'ribb' || ribbonFilter === 'all' || row[0] === `Ribbon ${ribbonFilter}`;
        const matchesCommission = selected !== 'ribb' || ribbonCommissionFilter === 'all' || row[3] === formatCommission(ribbonCommissionFilter);
        const matchesSearch = row.join(' ').toLowerCase().includes(search.toLowerCase());
        return matchesRibbon && matchesCommission && matchesSearch;
      }),
    [data.rows, ribbonCommissionFilter, ribbonFilter, search, selected],
  );
  const Icon = data.icon;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-11">
      <PageIntro eyebrow="Catálogo interno" title="Consultas" description="Referências rápidas para materiais, ribbon e facas. Esta área é somente leitura e serve como apoio ao orçamento." />
      <div className="grid gap-6 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-card-border bg-card p-3 shadow-card" data-testid="card-consultation-nav">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Tabelas disponíveis</p>
          <div className="mt-2 space-y-1">
            {(Object.entries(consultations) as [ConsultationKey, typeof consultations[ConsultationKey]][]).map(([key, item]) => {
              const ItemIcon = item.icon;
              return <button key={key} onClick={() => { setSelected(key); setSearch(''); setRibbonFilter('all'); setRibbonCommissionFilter('all'); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${selected === key ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} data-testid={`button-consult-${key}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected === key ? 'bg-secondary-foreground/10' : 'bg-muted'}`}><ItemIcon size={15} /></span><span className="text-[12px] font-bold">{item.label}</span>{selected === key ? <Check className="ml-auto" size={14} /> : null}</button>;
            })}
          </div>
          <div className="mt-5 border-t border-border p-3 pt-5"><div className="flex items-center gap-2 text-secondary"><BookOpen size={15} /><span className="text-[11px] font-bold">Consulta somente leitura</span></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Para alterar uma referência, alinhe a nova base com a equipe de produção.</p></div>
        </aside>
        <section className="min-w-0 rounded-2xl border border-card-border bg-card p-5 shadow-card sm:p-7" data-testid={`card-consultation-${selected}`}>
          <div className="flex flex-col justify-between gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end">
            <div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10 text-secondary"><Icon size={16} /></span><h2 className="font-display text-[17px] font-bold" data-testid="heading-consultation">{data.label}</h2></div><p className="mt-2 text-[12px] text-muted-foreground">{data.rows.length} referências no snapshot da produção</p></div>
            <label className="relative block w-full sm:w-[245px]"><Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Buscar nesta tabela" className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-[12px] outline-none focus:border-primary" data-testid="input-search-consultas" /></label>
          </div>
           {selected === 'ribb' ? <div className="mt-5 space-y-3 border-t border-border/70 pt-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="text-[11px] font-bold text-muted-foreground">Filtrar por tipo:</span><div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar tabela Ribbon por tipo">{ribbonFilterOptions.map((option) => <button key={option.value} onClick={() => setRibbonFilter(option.value)} className={`rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors ${ribbonFilter === option.value ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border bg-background text-muted-foreground hover:border-secondary/50 hover:text-secondary'}`} data-testid={`button-filter-ribbon-${option.value}`}>{option.label}</button>)}</div></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="text-[11px] font-bold text-muted-foreground">Filtrar por comissão:</span><div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar tabela Ribbon por comissão">{ribbonCommissionOptions.map((option, index) => <button key={option.value === 'all' ? 'all' : option.value} onClick={() => setRibbonCommissionFilter(option.value)} className={`rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors ${ribbonCommissionFilter === option.value ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border bg-background text-muted-foreground hover:border-secondary/50 hover:text-secondary'}`} data-testid={`button-filter-ribbon-commission-${index}`}>{option.label}</button>)}</div></div></div> : null}
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[590px] border-collapse text-left" data-testid="table-consultas">
              <thead><tr className="border-b border-border bg-muted/55 text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">{data.columns.map((column) => <th className="px-4 py-3.5" key={column}>{column}</th>)}</tr></thead>
              <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border/70 last:border-0 hover:bg-primary/[0.025]" data-testid={`row-consult-${selected}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-4 py-4 text-[12px] ${cellIndex === 0 ? 'font-bold text-foreground' : 'text-muted-foreground'}`} data-testid={`cell-consult-${selected}-${rowIndex}-${cellIndex}`}>{cellIndex === row.length - 1 && (cell === 'Disponível' || cell === 'Em manutenção' || cell === 'Sob consulta') ? <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${cell === 'Disponível' ? 'bg-secondary/10 text-secondary' : 'bg-accent/20 text-foreground'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{cell}</span> : cell}</td>)}</tr>)}{rows.length === 0 ? <tr><td colSpan={data.columns.length} className="px-4 py-14 text-center text-[13px] font-bold">Nenhum registro encontrado.</td></tr> : null}</tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground"><span data-testid="text-consult-row-count">{rows.length} registros exibidos</span><span className="flex items-center gap-1.5"><Info size={13} /> valores de referência</span></div>
        </section>
      </div>
    </div>
  );
}

function AuthLoadingPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="rounded-2xl border border-card-border bg-card px-6 py-5 text-[13px] font-semibold text-muted-foreground shadow-card">Carregando acesso…</div></div>;
}

function PublicLandingPage() {
  return (
    <div className="app-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[560px] rounded-3xl border border-card-border bg-card p-7 text-center shadow-card sm:p-10">
        <div className="mx-auto w-[210px] max-w-full"><BrandMark /></div>
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Área restrita</p>
        <h1 className="mt-3 font-display text-[30px] font-bold tracking-[-0.04em] text-foreground sm:text-[38px]">Calculadora Perfecta Print</h1>
        <p className="mx-auto mt-4 max-w-[420px] text-[13px] leading-6 text-muted-foreground">Entre para acessar as calculadoras, tabelas de preços e consultas da Perfecta Print.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/sign-in" className="rounded-lg bg-secondary px-5 py-3 text-[12px] font-bold text-secondary-foreground shadow-sm transition-transform hover:-translate-y-0.5" data-testid="link-sign-in">Entrar</Link>
        </div>
        <p className="mt-7 text-[11px] leading-5 text-muted-foreground">As contas são criadas e administradas pelo painel master.</p>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuthSession();
  if (loading) return <AuthLoadingPage />;
  if (user) return <Redirect to="/app" />;
  return <PublicLandingPage />;
}

function ProtectedRoute({ children, masterOnly = false }: { children: ReactNode; masterOnly?: boolean }) {
  const { user, loading } = useAuthSession();
  if (loading) return <AuthLoadingPage />;
  if (!user) return <Redirect to="/sign-in" />;
  if (masterOnly && user.role !== 'master') return <Redirect to="/app" />;
  return <Shell>{children}</Shell>;
}

function AccessAdminPage() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();
  const usersQuery = useAuthListUsers({
    query: {
      enabled: user?.role === 'master',
      queryKey: getAuthListUsersQueryKey(),
      retry: false,
    },
  });
  const createUser = useAuthCreateUser();
  const updateUser = useAuthUpdateUser();
  const changePassword = useAuthChangePassword();
  const createForm = useForm<z.infer<typeof createUserFormSchema>>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { username: '', displayName: '', password: '' },
  });
  const passwordForm = useForm<z.infer<typeof changePasswordFormSchema>>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const users = usersQuery.data?.users ?? [];

  const handleCreateUser = async (values: z.infer<typeof createUserFormSchema>) => {
    setPageError(null);
    setNotice(null);
    try {
      const created = await createUser.mutateAsync({
        data: values satisfies AuthCreateUserInput,
      });
      trackAuthEvent('master_account_created');
      queryClient.setQueryData<AuthUserList>(getAuthListUsersQueryKey(), (current) => ({
        users: [created, ...(current?.users ?? []).filter((item) => item.id !== created.id)],
      }));
      await queryClient.invalidateQueries({ queryKey: getAuthListUsersQueryKey() });
      createForm.reset();
      setNotice(`A conta “${created.username}” foi criada e já pode entrar.`);
    } catch (error) {
      setPageError(apiErrorMessage(error, 'Não foi possível criar a conta.'));
    }
  };

  const handleUpdateUser = async (id: number, data: AuthUserUpdateInput): Promise<AuthUser> => {
    const updated = await updateUser.mutateAsync({ id, data });
    queryClient.setQueryData<AuthUserList>(getAuthListUsersQueryKey(), (current) =>
      current ? { users: current.users.map((item) => item.id === updated.id ? updated : item) } : current,
    );
    await queryClient.invalidateQueries({ queryKey: getAuthListUsersQueryKey() });
    return updated;
  };

  const handleChangePassword = async (values: z.infer<typeof changePasswordFormSchema>) => {
    setPageError(null);
    setNotice(null);
    try {
      const data: AuthChangePasswordInput = {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      };
      await changePassword.mutateAsync({ data });
      passwordForm.reset();
      setNotice('Sua senha master foi alterada.');
    } catch (error) {
      setPageError(apiErrorMessage(error, 'Não foi possível alterar a senha.'));
    }
  };

  if (user?.role !== 'master') {
    return <div className="mx-auto max-w-[700px] px-5 py-12 text-center text-[13px] font-semibold text-muted-foreground" data-testid="status-master-only">Esta área é exclusiva do painel master.</div>;
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-11">
      <PageIntro eyebrow="Painel master" title="Gestão de usuários" description="Crie contas, altere dados de acesso, redefina senhas e bloqueie ou reative usuários. Esta lista é visível apenas para o master." />

      {pageError ? <p className="mb-5 rounded-lg bg-destructive/10 px-4 py-3 text-[12px] font-semibold text-destructive" role="alert" data-testid="status-user-admin-error">{pageError}</p> : null}
      {notice ? <p className="mb-5 rounded-lg bg-secondary/10 px-4 py-3 text-[12px] font-semibold text-secondary" role="status" data-testid="status-user-admin-success">{notice}</p> : null}

      <section className="mb-6 rounded-2xl border border-card-border bg-card p-5 shadow-card sm:p-7" data-testid="card-master-password">
        <div className="mb-5 border-b border-border/70 pb-4">
          <h2 className="font-display text-[17px] font-bold">Minha senha master</h2>
          <p className="mt-2 text-[12px] text-muted-foreground">Atualize a senha da conta principal. A nova senha deve ter ao menos 12 caracteres.</p>
        </div>
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="grid gap-4 md:grid-cols-3" data-testid="form-change-master-password">
            <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
              <FormItem><FormLabel>Senha atual</FormLabel><FormControl><Input type="password" autoComplete="current-password" data-testid="input-master-current-password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
              <FormItem><FormLabel>Nova senha</FormLabel><FormControl><Input type="password" autoComplete="new-password" data-testid="input-master-new-password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
              <FormItem><FormLabel>Confirme a nova senha</FormLabel><FormControl><Input type="password" autoComplete="new-password" data-testid="input-master-confirm-password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="md:col-span-3">
              <Button type="submit" disabled={changePassword.isPending} data-testid="button-save-master-password">
                {changePassword.isPending ? 'Salvando…' : 'Alterar senha'}
              </Button>
            </div>
          </form>
        </Form>
      </section>

      <section className="mb-6 rounded-2xl border border-card-border bg-card p-5 shadow-card sm:p-7" data-testid="card-create-user">
        <div className="mb-5 border-b border-border/70 pb-4">
          <h2 className="font-display text-[17px] font-bold">Criar usuário</h2>
          <p className="mt-2 text-[12px] text-muted-foreground">A conta fica ativa assim que for criada. Compartilhe os dados de entrada diretamente com a pessoa.</p>
        </div>
        <Form {...createForm}>
          <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="form-create-user">
            <FormField control={createForm.control} name="username" render={({ field }) => (
              <FormItem><FormLabel>Nome de usuário</FormLabel><FormControl><Input autoComplete="off" placeholder="ex.: maria.silva" data-testid="input-new-username" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={createForm.control} name="displayName" render={({ field }) => (
              <FormItem><FormLabel>Nome para exibição</FormLabel><FormControl><Input autoComplete="off" placeholder="Nome da pessoa" data-testid="input-new-display-name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={createForm.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Senha inicial</FormLabel><FormControl><Input type="password" autoComplete="new-password" data-testid="input-new-user-password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex items-end">
              <Button type="submit" disabled={createUser.isPending} className="w-full" data-testid="button-create-user">
                {createUser.isPending ? 'Criando…' : 'Criar conta'}
              </Button>
            </div>
          </form>
        </Form>
      </section>

      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-card sm:p-7" data-testid="card-user-list">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div>
            <h2 className="font-display text-[17px] font-bold">Contas do sistema</h2>
            <p className="mt-2 text-[12px] text-muted-foreground" data-testid="text-user-count">{users.length} contas cadastradas</p>
          </div>
          <ShieldCheck className="text-secondary" size={22} />
        </div>
        {usersQuery.isLoading ? <p className="px-2 py-10 text-center text-[13px] text-muted-foreground" data-testid="status-users-loading">Carregando usuários…</p> : null}
        {usersQuery.isError ? <p className="px-2 py-10 text-center text-[13px] font-semibold text-destructive" role="alert" data-testid="status-users-load-error">{apiErrorMessage(usersQuery.error, 'Não foi possível carregar as contas.')}</p> : null}
        {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 ? <p className="px-2 py-10 text-center text-[13px] text-muted-foreground" data-testid="status-users-empty">Nenhuma conta cadastrada ainda.</p> : null}
        <div className="mt-5 space-y-3">
          {users.map((managedUser) => (
            <ManagedUserCard
              key={managedUser.id}
              user={managedUser}
              onSave={handleUpdateUser}
              onStatusChange={(status) => handleUpdateUser(managedUser.id, { status })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ManagedUserCard({
  user,
  onSave,
  onStatusChange,
}: {
  user: AuthUser;
  onSave: (id: number, data: AuthUserUpdateInput) => Promise<AuthUser>;
  onStatusChange: (status: 'active' | 'blocked') => Promise<AuthUser>;
}) {
  const form = useForm<z.infer<typeof updateUserFormSchema>>({
    resolver: zodResolver(updateUserFormSchema),
    defaultValues: { username: user.username, displayName: user.displayName, password: '' },
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const resetForm = form.reset;

  useEffect(() => {
    resetForm({ username: user.username, displayName: user.displayName, password: '' });
  }, [resetForm, user.username, user.displayName]);

  const saveDetails = async (values: z.infer<typeof updateUserFormSchema>) => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const update: AuthUserUpdateInput = {
        username: values.username,
        displayName: values.displayName,
        ...(values.password ? { password: values.password } : {}),
      };
      const updated = await onSave(user.id, update);
      form.reset({ username: updated.username, displayName: updated.displayName, password: '' });
      setSaved(true);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível salvar as alterações.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    setError(null);
    setSaved(false);
    setChangingStatus(true);
    try {
      await onStatusChange(user.status === 'active' ? 'blocked' : 'active');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível atualizar o acesso.'));
    } finally {
      setChangingStatus(false);
    }
  };

  const createdAt = new Date(user.createdAt);
  const createdLabel = Number.isNaN(createdAt.getTime()) ? '—' : createdAt.toLocaleDateString('pt-BR');

  return (
    <article className="rounded-xl border border-border bg-background/55 p-4 sm:p-5" data-testid={`row-managed-user-${user.id}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-bold text-foreground" data-testid={`text-managed-user-${user.id}`}>{user.displayName || user.username}</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.status === 'active' ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`} data-testid={`status-managed-user-${user.id}`}>
              {user.role === 'master' ? 'Master' : user.status === 'active' ? 'Ativo' : 'Bloqueado'}
            </span>
          </div>
          <p className="mt-1 truncate text-[12px] text-muted-foreground">@{user.username} · criado em {createdLabel}</p>
        </div>
        {user.role === 'master' ? (
          <span className="px-3 py-2 text-[11px] font-semibold text-muted-foreground">Conta principal</span>
        ) : (
          <Button
            type="button"
            variant={user.status === 'active' ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => void toggleStatus()}
            disabled={changingStatus}
            data-testid={`button-toggle-user-${user.id}`}
          >
            {changingStatus ? 'Salvando…' : user.status === 'active' ? 'Bloquear acesso' : 'Reativar acesso'}
          </Button>
        )}
      </div>
      {user.role === 'user' ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(saveDetails)} className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2 xl:grid-cols-4" data-testid={`form-edit-user-${user.id}`}>
            <FormField control={form.control} name="username" render={({ field }) => (
              <FormItem><FormLabel>Nome de usuário</FormLabel><FormControl><Input autoComplete="off" data-testid={`input-edit-username-${user.id}`} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="displayName" render={({ field }) => (
              <FormItem><FormLabel>Nome para exibição</FormLabel><FormControl><Input autoComplete="off" data-testid={`input-edit-display-name-${user.id}`} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Nova senha (opcional)</FormLabel><FormControl><Input type="password" autoComplete="new-password" data-testid={`input-reset-password-${user.id}`} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex flex-col justify-end gap-2">
              <Button type="submit" size="sm" disabled={saving} className="w-full" data-testid={`button-save-user-${user.id}`}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              {saved ? <span className="text-center text-[10px] font-semibold text-secondary" role="status" data-testid={`status-user-saved-${user.id}`}>Alterações salvas</span> : null}
            </div>
          </form>
        </Form>
      ) : null}
      {error ? <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] font-semibold text-destructive" role="alert" data-testid={`status-user-error-${user.id}`}>{error}</p> : null}
    </article>
  );
}

function OfflineShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const offlineNavigation = navigation.filter((item) => item.href !== '/acessos');
  return (
    <div className="paper-noise min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-sidebar-border bg-sidebar px-4 py-4 text-sidebar-foreground sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-[170px] max-w-full items-center"><BrandMark /></div>
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Navegação da calculadora">
            {offlineNavigation.map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-bold transition-colors ${location === item.href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}><Icon size={14} />{item.label}</Link>;
            })}
          </nav>
          <span className="hidden rounded-full bg-sidebar-accent px-3 py-2 text-[10px] font-bold text-sidebar-foreground/85 xl:inline-flex">Modo offline</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-2 py-4 sm:px-4 sm:py-6">{children}</main>
      <footer className="mx-auto max-w-[1440px] px-5 pb-7 text-center text-[10px] font-medium text-muted-foreground">Arquivo local da Calculadora Perfecta Print · Os dados e cálculos ficam neste computador.</footer>
    </div>
  );
}

function OfflineRouter() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={() => <Redirect to="/app" />} />
        <Route path="/app" component={() => <OfflineShell><CalculatorPage kind="etiq" /></OfflineShell>} />
        <Route path="/tag" component={() => <OfflineShell><CalculatorPage kind="tag" /></OfflineShell>} />
        <Route path="/tabela-etiquetas" component={() => <OfflineShell><EtiqTablePage /></OfflineShell>} />
        <Route path="/consultas" component={() => <OfflineShell><ConsultasPage /></OfflineShell>} />
        <Route component={() => <OfflineShell><NotFound /></OfflineShell>} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function SignInPage() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuthSession();
  const queryClient = useQueryClient();
  const login = useAuthLogin();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AuthLoginInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { username: '', password: '' },
  });

  const handleLogin = async (values: AuthLoginInput) => {
    setError(null);
    try {
      const response = await login.mutateAsync({ data: values });
      trackAuthEvent('login_succeeded');
      queryClient.removeQueries({ queryKey: getAuthListUsersQueryKey() });
      queryClient.setQueryData(getAuthGetCurrentUserQueryKey(), response);
      setLocation('/app');
    } catch (loginError) {
      setError(apiErrorMessage(loginError, 'Não foi possível entrar. Verifique seus dados e tente novamente.'));
    }
  };

  if (loading) return <AuthLoadingPage />;
  if (user) return <Redirect to="/app" />;

  return (
    <div className="app-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[460px] rounded-3xl border border-card-border bg-card p-7 shadow-card sm:p-10">
        <div className="mx-auto w-[190px] max-w-full"><BrandMark /></div>
        <p className="mt-8 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Área restrita</p>
        <h1 className="mt-2 text-center font-display text-[28px] font-bold tracking-[-0.04em] text-foreground">Entrar na mesa de produção</h1>
        <p className="mt-3 text-center text-[13px] leading-6 text-muted-foreground">Use o nome de usuário e a senha fornecidos pelo painel master.</p>
        {error ? <p className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-[12px] font-semibold text-destructive" role="alert" data-testid="status-login-error">{error}</p> : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleLogin)} className="mt-6 space-y-4" data-testid="form-login">
            <FormField control={form.control} name="username" render={({ field }) => (
              <FormItem><FormLabel>Nome de usuário</FormLabel><FormControl><Input autoComplete="username" autoCapitalize="none" data-testid="input-login-username" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" autoComplete="current-password" data-testid="input-login-password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={login.isPending} data-testid="button-login">
              {login.isPending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-[11px] leading-5 text-muted-foreground" data-testid="text-login-admin-note">Contas novas são criadas somente pelo master.</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/app" component={() => <ProtectedRoute><CalculatorPage kind="etiq" /></ProtectedRoute>} />
        <Route path="/tag" component={() => <ProtectedRoute><CalculatorPage kind="tag" /></ProtectedRoute>} />
        <Route path="/tabela-etiquetas" component={() => <ProtectedRoute><EtiqTablePage /></ProtectedRoute>} />
        <Route path="/consultas" component={() => <ProtectedRoute><ConsultasPage /></ProtectedRoute>} />
        <Route path="/acessos" component={() => <ProtectedRoute masterOnly><AccessAdminPage /></ProtectedRoute>} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  if (isOfflineBuild) {
    return (
      <WouterRouter base={basePath} hook={useHashLocation}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <OfflineRouter />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </WouterRouter>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <AppProviders />
      <Toaster />
    </WouterRouter>
  );
}

export default App;