import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function Breadcrumb({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-500 mb-2 min-w-0">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-slate-900 transition truncate max-w-[40vw] md:max-w-none">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900 font-medium truncate max-w-[60vw] md:max-w-none">{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
