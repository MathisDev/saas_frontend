import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function Breadcrumb({ items }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-slate-900 transition">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
