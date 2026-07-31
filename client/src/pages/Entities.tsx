import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function EntitiesPage() {
  const utils = trpc.useUtils();
  const { data: entities = [], isLoading } = trpc.cardManager.getEntities.useQuery();

  const createMutation = trpc.cardManager.createEntity.useMutation({
    onSuccess: () => {
      toast.success("เพิ่ม Entity สำเร็จ");
      utils.cardManager.getEntities.invalidate();
      setIsAddOpen(false);
      setFormData({ type: "page", name: "", loginNote: "", status: "active", notes: "" });
    }
  });

  const deleteMutation = trpc.cardManager.deleteEntity.useMutation({
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      utils.cardManager.getEntities.invalidate();
    }
  });

  const updateMutation = trpc.cardManager.updateEntity.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขสำเร็จ");
      utils.cardManager.getEntities.invalidate();
      setIsEditOpen(false);
      setEditData(null);
    }
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    type: "page", name: "", loginNote: "", status: "active", notes: ""
  });
  const [editData, setEditData] = useState<any>(null);

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ads Entities</h1>
          <p className="text-muted-foreground mt-1">จัดการเพจ, Business Manager, และบัญชีโฆษณา</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> เพิ่มรายการ</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่ม Entity ใหม่</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-4">
              <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                <SelectTrigger><SelectValue placeholder="ประเภท" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="page">Facebook Page</SelectItem>
                  <SelectItem value="business_manager">Business Manager</SelectItem>
                  <SelectItem value="ad_account">Ad Account</SelectItem>
                  <SelectItem value="fb_profile">FB Profile (พรอพซี)</SelectItem>
                  <SelectItem value="subscription">Subscription (บริการอื่นๆ)</SelectItem>
                </SelectContent>
              </Select>
              
              <Input placeholder="ชื่อ Entity" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (ปกติ)</SelectItem>
                  <SelectItem value="paused">Paused (หยุดใช้งาน)</SelectItem>
                  <SelectItem value="banned">Banned (แดง/บิน)</SelectItem>
                  <SelectItem value="unknown">Unknown (ไม่แน่ใจ)</SelectItem>
                </SelectContent>
              </Select>

              {formData.type === "fb_profile" && (
                <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-md mb-2">
                  <div className="flex items-center gap-2 text-orange-600 mb-2 font-medium">
                    <ShieldAlert className="w-4 h-4" /> แนะนำการเก็บข้อมูล Login
                  </div>
                  <p className="text-xs text-slate-600 mb-2">ไม่ควรใส่ Password จริงที่นี่ แนะนำให้อ้างอิงถึง Password Manager ที่ใช้งานอยู่ หรือใส่เป็น hint</p>
                  <Textarea placeholder="Login Notes (ex. Bitwarden - Profile A)" value={formData.loginNote} onChange={e => setFormData({...formData, loginNote: e.target.value})} />
                </div>
              )}
              
              <Textarea placeholder="หมายเหตุเพิ่มเติม" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || !formData.name}>
                บันทึก
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไข Entity</DialogTitle>
            </DialogHeader>
            {editData && (
              <div className="flex flex-col gap-4 mt-4">
                <Select value={editData.type} onValueChange={v => setEditData({...editData, type: v})}>
                  <SelectTrigger><SelectValue placeholder="ประเภท" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">Facebook Page</SelectItem>
                    <SelectItem value="business_manager">Business Manager</SelectItem>
                    <SelectItem value="ad_account">Ad Account</SelectItem>
                    <SelectItem value="fb_profile">FB Profile (พรอพซี)</SelectItem>
                    <SelectItem value="subscription">Subscription (บริการอื่นๆ)</SelectItem>
                  </SelectContent>
                </Select>
                
                <Input placeholder="ชื่อ Entity" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                
                <Select value={editData.status} onValueChange={v => setEditData({...editData, status: v})}>
                  <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (ปกติ)</SelectItem>
                    <SelectItem value="paused">Paused (หยุดใช้งาน)</SelectItem>
                    <SelectItem value="banned">Banned (แดง/บิน)</SelectItem>
                    <SelectItem value="unknown">Unknown (ไม่แน่ใจ)</SelectItem>
                  </SelectContent>
                </Select>

                {editData.type === "fb_profile" && (
                  <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-md mb-2">
                    <div className="flex items-center gap-2 text-orange-600 mb-2 font-medium">
                      <ShieldAlert className="w-4 h-4" /> แนะนำการเก็บข้อมูล Login
                    </div>
                    <Textarea placeholder="Login Notes (ex. Bitwarden - Profile A)" value={editData.loginNote || ""} onChange={e => setEditData({...editData, loginNote: e.target.value})} />
                  </div>
                )}
                
                <Textarea placeholder="หมายเหตุเพิ่มเติม" value={editData.notes || ""} onChange={e => setEditData({...editData, notes: e.target.value})} />
                
                <Button onClick={() => updateMutation.mutate(editData)} disabled={updateMutation.isPending || !editData.name}>
                  บันทึกการแก้ไข
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 border-b">
            <tr>
              <th className="px-6 py-3 font-medium">ประเภท</th>
              <th className="px-6 py-3 font-medium">ชื่อ</th>
              <th className="px-6 py-3 font-medium">สถานะ</th>
              <th className="px-6 py-3 font-medium">หมายเหตุ</th>
              <th className="px-6 py-3 font-medium w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entities.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">ไม่มีข้อมูล</td></tr>
            )}
            {entities.map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 capitalize">{e.type.replace('_', ' ')}</td>
                <td className="px-6 py-3 font-medium">{e.name}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    e.status === 'active' ? 'bg-green-100 text-green-700' :
                    e.status === 'banned' ? 'bg-red-100 text-red-700' :
                    e.status === 'paused' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-500 max-w-[200px] truncate">{e.notes || e.loginNote || "-"}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => {
                      setEditData({ ...e });
                      setIsEditOpen(true);
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                      if (confirm("ยืนยันการลบ? ข้อมูลที่ลิงก์ไว้กับบัตรจะหายไปด้วย")) {
                        deleteMutation.mutate({ id: e.id });
                      }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
