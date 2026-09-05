import { brandConfig } from '../../app/config/brand';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3" aria-label={brandConfig.productName}>
      <img className="size-10 object-contain" src={brandConfig.logo} alt="" aria-hidden />
      {!compact && (
        <span className="font-display text-xl font-semibold tracking-tight">
          {brandConfig.productName}
        </span>
      )}
    </span>
  );
}
