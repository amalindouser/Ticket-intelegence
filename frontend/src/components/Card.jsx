export default function Card({ title, subtitle, children, accent, className = "", style }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-hidden card-lift ${className}`}
      style={{
        ...(accent ? { borderLeft: `4px solid ${accent}` } : {}),
        ...style,
      }}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-navy">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}