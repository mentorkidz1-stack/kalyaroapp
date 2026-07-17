export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  return <div className={`brand-mark ${size === "sm" ? "scale-75 origin-left" : ""}`} />;
}
