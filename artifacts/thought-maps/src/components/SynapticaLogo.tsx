interface SynapticaLogoProps {
  size?: number;
  className?: string;
}

export function SynapticaLogo({ size = 20, className }: SynapticaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <line x1="10" y1="10" x2="5.5" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7"/>
      <line x1="10" y1="10" x2="14.5" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7"/>
      <line x1="10" y1="10" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7"/>
      <line x1="10" y1="10" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7"/>
      <line x1="10" y1="10" x2="10.5" y2="15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7"/>
      <circle cx="5.5" cy="5.5" r="1.8" fill="currentColor" fillOpacity="0.85"/>
      <circle cx="14.5" cy="6" r="1.4" fill="currentColor" fillOpacity="0.7"/>
      <circle cx="15" cy="12" r="1.5" fill="currentColor" fillOpacity="0.8"/>
      <circle cx="6" cy="14" r="1.4" fill="currentColor" fillOpacity="0.7"/>
      <circle cx="10.5" cy="15.5" r="1.2" fill="currentColor" fillOpacity="0.65"/>
      <circle cx="10" cy="10" r="2.8" fill="currentColor"/>
      <circle cx="10" cy="10" r="1.7" fill="white" fillOpacity="0.9"/>
    </svg>
  );
}
