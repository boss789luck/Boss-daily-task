import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { VirtualCard } from "@/components/VirtualCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function CardsPage() {
  const utils = trpc.useUtils();
  
  const { data: cards = [], isLoading } = trpc.cardManager.getCards.useQuery(undefined, { enabled: true });

  const createCardMutation = trpc.cardManager.createCard.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มบัตรสำเร็จ");
      utils.cardManager.getCards.invalidate();
      setIsAddOpen(false);
      setFormData({ cardName: "", bankName: "", linkedBankAccount: "", cardNumber: "", expiry: "", cvv: "", cardholderName: "" });
    },
    onError: (err) => {
      toast.error(`เพิ่มบัตรไม่สำเร็จ: ${err.message}`);
    }
  });

  const updateCardMutation = trpc.cardManager.updateCard.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขข้อมูลบัตรสำเร็จ");
      utils.cardManager.getCards.invalidate();
      setIsEditOpen(false);
      setEditingCardId(null);
    },
    onError: (err) => toast.error(`แก้ไขไม่สำเร็จ: ${err.message}`)
  });

  const deleteCardMutation = trpc.cardManager.deleteCard.useMutation({
    onSuccess: () => {
      toast.success("ลบบัตรสำเร็จ");
      utils.cardManager.getCards.invalidate();
    },
    onError: (err) => toast.error(`ลบไม่สำเร็จ: ${err.message}`)
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  
  // New Card Form State
  const [formData, setFormData] = useState({
    cardName: "", bankName: "", linkedBankAccount: "", cardNumber: "", expiry: "", cvv: "", cardholderName: ""
  });

  // Edit Card Form State
  const [editFormData, setEditFormData] = useState({
    cardName: "", bankName: "", linkedBankAccount: "", cardNumber: "", expiry: "", cvv: "", cardholderName: ""
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  const handleAddCard = () => {
    createCardMutation.mutate(formData);
  };

  const handleEditClick = (card: any) => {
    setEditingCardId(card.id);
    setEditFormData({
      cardName: card.cardName || "",
      bankName: card.bankName || "",
      linkedBankAccount: card.linkedBankAccount || "",
      cardNumber: card.cardNumberFull || card.cardNumberEncrypted || "",
      expiry: card.expiryRaw || card.expiryEncrypted || "",
      cvv: card.cvvRaw || card.cvvEncrypted || "",
      cardholderName: card.cardholderRaw || card.cardholderNameEncrypted || ""
    });
    setIsEditOpen(true);
  };

  const handleUpdateCard = () => {
    if (editingCardId) {
      updateCardMutation.mutate({ id: editingCardId, ...editFormData });
    }
  };

  const handleDeleteClick = (id: number) => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบบัตรใบนี้?")) {
      deleteCardMutation.mutate({ id });
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Card Vault</h1>
          <p className="text-muted-foreground mt-1">จัดการบัตรเครดิตที่ใช้ผูกบัญชีโฆษณา</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> เพิ่มบัตรใหม่</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มบัตรเครดิต</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-4">
              <Input placeholder="ชื่อเรียกบัตร (เช่น KBank Boss)" value={formData.cardName} onChange={e => setFormData({...formData, cardName: e.target.value})} />
              <Input placeholder="ธนาคาร" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
              <Input placeholder="เลขบัญชีธนาคาร (ที่ผูกกับบัตร)" value={formData.linkedBankAccount} onChange={e => setFormData({...formData, linkedBankAccount: e.target.value})} />
              <Input placeholder="เลขบัตร 16 หลัก" value={formData.cardNumber} onChange={e => setFormData({...formData, cardNumber: e.target.value})} />
              <div className="flex gap-4">
                <Input placeholder="MM/YY" value={formData.expiry} onChange={e => setFormData({...formData, expiry: e.target.value})} />
                <Input placeholder="CVV" value={formData.cvv} onChange={e => setFormData({...formData, cvv: e.target.value})} />
              </div>
              <Input placeholder="ชื่อหน้าบัตร" value={formData.cardholderName} onChange={e => setFormData({...formData, cardholderName: e.target.value})} />
              
              <Button onClick={handleAddCard} disabled={createCardMutation.isPending}>
                บันทึกข้อมูลบัตร
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog (hidden trigger) */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขข้อมูลบัตรเครดิต</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-4">
              <Input placeholder="ชื่อเรียกบัตร (เช่น KBank Boss)" value={editFormData.cardName} onChange={e => setEditFormData({...editFormData, cardName: e.target.value})} />
              <Input placeholder="ธนาคาร" value={editFormData.bankName} onChange={e => setEditFormData({...editFormData, bankName: e.target.value})} />
              <Input placeholder="เลขบัญชีธนาคาร (ที่ผูกกับบัตร)" value={editFormData.linkedBankAccount} onChange={e => setEditFormData({...editFormData, linkedBankAccount: e.target.value})} />
              <Input placeholder="เลขบัตร 16 หลัก" value={editFormData.cardNumber} onChange={e => setEditFormData({...editFormData, cardNumber: e.target.value})} />
              <div className="flex gap-4">
                <Input placeholder="MM/YY" value={editFormData.expiry} onChange={e => setEditFormData({...editFormData, expiry: e.target.value})} />
                <Input placeholder="CVV" value={editFormData.cvv} onChange={e => setEditFormData({...editFormData, cvv: e.target.value})} />
              </div>
              <Input placeholder="ชื่อหน้าบัตร" value={editFormData.cardholderName} onChange={e => setEditFormData({...editFormData, cardholderName: e.target.value})} />
              
              <Button onClick={handleUpdateCard} disabled={updateCardMutation.isPending}>
                อัปเดตข้อมูลบัตร
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-8">
        {cards.length === 0 && <p className="text-muted-foreground">ยังไม่มีบัตรในระบบ</p>}
        {cards.map(card => (
          <VirtualCard key={card.id} card={card} onEdit={handleEditClick} onDelete={handleDeleteClick} />
        ))}
      </div>
    </div>
  );
}
