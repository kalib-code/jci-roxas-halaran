import { formatPesos } from "@/lib/format.js";

export default function ProgressBar({ raisedCentavos, goalCentavos, label }) {
  const pct = goalCentavos > 0 ? Math.min(100, Math.round((raisedCentavos / goalCentavos) * 100)) : 0;
  const text = `${formatPesos(raisedCentavos)} raised of ${formatPesos(goalCentavos)}`;
  return (
    <div className="progress-wrap">
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${text}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="progress__text">{text}</p>
    </div>
  );
}
