import { GraduationCap } from "lucide-react";
export function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark">
        <GraduationCap size={25} strokeWidth={1.8} />
      </span>
      <span>
        <strong>
          campus<span className="brand-dot">.</span>
        </strong>
        <small>GESTIÓN DE COMPETENCIAS</small>
      </span>
    </div>
  );
}
