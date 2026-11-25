import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card p-8 text-center shadow-card sm:p-12" data-testid="card-not-found">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FileQuestion size={26} />
        </span>
        <p className="mt-6 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-primary">folha não encontrada</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.04em]">Este endereço não está na mesa.</h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-6 text-muted-foreground">A página pode ter sido movida ou o caminho foi digitado diferente das áreas disponíveis.</p>
        <Link href="/" className="mx-auto mt-7 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-3 text-[12px] font-bold text-secondary-foreground transition-transform hover:-translate-y-0.5" data-testid="link-not-found-home">
          <ArrowLeft size={15} /> Voltar para a calculadora
        </Link>
      </div>
    </div>
  );
}