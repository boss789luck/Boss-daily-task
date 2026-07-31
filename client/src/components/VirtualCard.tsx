import React, { useState, useEffect } from "react";
import { CreditCard, Eye, EyeOff, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

export function VirtualCard({ card, onEdit, onDelete }: { card: any, onEdit: (card: any) => void, onDelete: (id: number) => void }) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && isRevealed) {
      setIsRevealed(false);
    }
  }, [timeLeft, isRevealed]);

  const toggleReveal = () => {
    if (!isRevealed) {
      setIsRevealed(true);
      setTimeLeft(60);
    } else {
      setIsRevealed(false);
      setTimeLeft(0);
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("คัดลอกสำเร็จ (จะลบออกอัตโนมัติใน 30 วิ)");
    setTimeout(() => navigator.clipboard.writeText(""), 30000);
  };

  return (
    <div className="relative w-80 h-48 rounded-xl bg-gradient-to-br from-[#0A1428] to-slate-800 text-white p-6 shadow-xl flex flex-col justify-between overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-white opacity-5 blur-2xl"></div>
      
      <div className="flex justify-between items-start z-10">
        <div>
          <h3 className="font-semibold text-lg">{card.cardName}</h3>
          <p className="text-xs text-slate-300 opacity-80">{card.bankName}</p>
        </div>
        <CreditCard className="text-orange-500 opacity-80" />
      </div>

      <div className="z-10 mt-4">
        <div className="font-mono text-xl tracking-widest flex items-center gap-2">
          {isRevealed && card.cardNumberFull ? card.cardNumberFull.match(/.{1,4}/g)?.join(" ") : `**** **** **** ${card.cardNumberLast4}`}
          {isRevealed && card.cardNumberFull && (
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 text-slate-400 hover:text-white" onClick={() => handleCopy(card.cardNumberFull)}>
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end z-10 text-sm">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-slate-400">Card Holder</span>
          <span className="font-medium">{isRevealed ? (card.cardholderRaw || card.cardholderNameEncrypted || "N/A") : "********"}</span>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-400">Expires</span>
            <span className="font-mono">{isRevealed ? (card.expiryRaw || card.expiryEncrypted || "N/A") : "**/**"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-400">CVV</span>
            <span className="font-mono">{isRevealed ? (card.cvvRaw || card.cvvEncrypted || "N/A") : "***"}</span>
          </div>
        </div>
      </div>

      {isRevealed && (
        <div className="absolute top-2 right-2 flex items-center gap-2 z-20">
          <span className="text-xs font-mono text-orange-400 animate-pulse">{timeLeft}s</span>
        </div>
      )}

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity z-20">
        <Button variant="secondary" className="gap-2 w-36" onClick={toggleReveal}>
          {isRevealed ? <><EyeOff className="h-4 w-4" /> ซ่อนข้อมูล</> : <><Eye className="h-4 w-4" /> ดูข้อมูลบัตร</>}
        </Button>
        <div className="flex gap-2 w-36">
          <Button variant="outline" size="sm" className="flex-1 bg-white/10 border-white/20 hover:bg-white/20 text-white" onClick={() => onEdit(card)}>
             แก้ไข
          </Button>
          <Button variant="destructive" size="sm" className="flex-1 bg-red-500/80 hover:bg-red-600" onClick={() => onDelete(card.id)}>
             ลบ
          </Button>
        </div>
      </div>
    </div>
  );
}
