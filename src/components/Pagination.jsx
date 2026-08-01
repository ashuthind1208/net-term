import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Pagination({ total, page, perPage = 10, onChange }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-gray-400">{start}–{end} of {total}</p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, i, arr) => {
            if (i > 0 && arr[i - 1] !== p - 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="text-xs text-gray-400 px-1">…</span>
            ) : (
              <Button
                key={p} variant={p === page ? "default" : "outline"} size="sm"
                onClick={() => onChange(p)}
                className={`h-7 w-7 p-0 text-xs ${p === page ? "bg-[#A55B4B] text-white border-[#A55B4B]" : ""}`}
              >
                {p}
              </Button>
            )
          )}
        <Button
          variant="outline" size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}