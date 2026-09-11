const palette: Record<number, string> = {
  25: "chip-white",
  100: "chip-red",
  500: "chip-purple",
  1000: "chip-black",
  5000: "chip-gold",
};

export function Chip({
  value,
  selected,
  disabled,
  onClick,
}: {
  value: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const tone = palette[value] ?? "chip-white";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`chip ${tone} ${selected ? "is-selected" : ""}`}
      aria-label={`${value} chip`}
    >
      <span>{value >= 1000 ? `${value / 1000}K` : value}</span>
    </button>
  );
}

export function ChipStack({ value, count = 3 }: { value: number; count?: number }) {
  const tone = palette[value] ?? "chip-white";
  return (
    <div className="chip-stack" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`chip mini ${tone}`}
          style={{ transform: `translateY(${-i * 5}px)` }}
        />
      ))}
    </div>
  );
}
