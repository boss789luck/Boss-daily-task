import React, { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CreditCard, MonitorPlay, Layers, LayoutPanelLeft, UserSquare2, Link as LinkIcon, Trash2, Unlink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GraphPage() {
  const utils = trpc.useUtils();
  const { data: cards } = trpc.cardManager.getCards.useQuery();
  const { data: entities } = trpc.cardManager.getEntities.useQuery();
  const { data: links } = trpc.cardManager.getLinks.useQuery();

  const createLinkMutation = trpc.cardManager.linkCardToEntity.useMutation({
    onSuccess: () => {
      toast.success("เชื่อมโยงสำเร็จ");
      utils.cardManager.getLinks.invalidate();
      setIsAddOpen(false);
      setFormData({ cardId: "", entityId: "" });
    }
  });

  const createSetupMutation = trpc.cardManager.createLinkSetup.useMutation({
    onSuccess: () => {
      toast.success("สร้างชุดข้อมูลผูกบัตรสำเร็จ!");
      utils.cardManager.getCards.invalidate();
      utils.cardManager.getEntities.invalidate();
      utils.cardManager.getLinks.invalidate();
      setIsSetupOpen(false);
      setSetupData({ card: "", profile: "", page: "", adAccount: "", subscription: "" });
    },
    onError: (err) => {
      toast.error(`เกิดข้อผิดพลาด: ${err.message}`);
    }
  });

  const deleteLinkMutation = trpc.cardManager.unlinkCardFromEntity.useMutation({
    onSuccess: () => {
      toast.success("ยกเลิกเชื่อมโยงสำเร็จ");
      utils.cardManager.getLinks.invalidate();
    }
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [formData, setFormData] = useState({ cardId: "", entityId: "" });
  const [setupData, setSetupData] = useState({ card: "", profile: "", page: "", adAccount: "", subscription: "" });

  // Generate nodes and edges dynamically
  const initialNodes = useMemo(() => {
    const nodes: any[] = [];
    let xCard = 100;
    let yCard = 100;

    if (cards) {
      cards.forEach(c => {
        nodes.push({
          id: `c-${c.id}`,
          type: 'default',
          position: { x: xCard, y: yCard },
          data: { label: `💳 ${c.cardName}` },
          style: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', width: 180, fontWeight: 'bold' }
        });
        yCard += 100;
      });
    }

    let xEntity = 500;
    let yEntity = 100;
    if (entities) {
      entities.forEach(e => {
        const icon = e.type === 'page' ? '📄' : e.type === 'business_manager' ? '💼' : e.type === 'ad_account' ? '📈' : e.type === 'subscription' ? '🔄' : '👤';
        const color = e.status === 'active' ? '#dcfce7' : e.status === 'banned' ? '#fee2e2' : e.status === 'paused' ? '#ffedd5' : '#f1f5f9';
        const border = e.status === 'active' ? '#4ade80' : e.status === 'banned' ? '#f87171' : e.status === 'paused' ? '#fb923c' : '#cbd5e1';
        
        nodes.push({
          id: `e-${e.id}`,
          type: 'default',
          position: { x: xEntity, y: yEntity },
          data: { label: `${icon} ${e.name}` },
          style: { background: color, border: `1px solid ${border}`, borderRadius: '8px', padding: '10px', width: 180 }
        });
        yEntity += 100;
      });
    }

    return nodes;
  }, [cards, entities]);

  const initialEdges = useMemo(() => {
    if (!links) return [];
    return links.map(l => ({
      id: `l-${l.id}`,
      source: `c-${l.cardId}`,
      target: `e-${l.entityId}`,
      label: l.note || undefined,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
      style: { stroke: '#94a3b8', strokeWidth: 2 }
    }));
  }, [links]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Determine Entity Types for Datasets
  const profiles = entities?.filter(e => e.type === "fb_profile") || [];
  const pages = entities?.filter(e => e.type === "page") || [];
  const adAccounts = entities?.filter(e => e.type === "ad_account") || [];
  const subscriptions = entities?.filter(e => e.type === "subscription") || [];

  return (
    <div className="h-full flex flex-col p-8">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Link Graph</h1>
          <p className="text-muted-foreground mt-1">แผนภาพความสัมพันธ์ระหว่างบัตรเครดิต บัญชีโฆษณา และบริการต่างๆ</p>
        </div>
        <div className="flex gap-4">
          <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0">
                <Zap className="w-4 h-4 mr-2" /> Quick Setup (ผูกรวดเดียว)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>⚡ สร้างชุดข้อมูลผูกบัตรใหม่</DialogTitle>
                <p className="text-sm text-muted-foreground">สามารถพิมพ์ชื่อใหม่เพื่อสร้างทันที หรือพิมพ์ชื่อเดิมเพื่อเลือกจากระบบ</p>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                
                <div className="grid gap-2">
                  <Label>💳 บัตรเครดิต (จำเป็นต้องใส่)</Label>
                  <Input 
                    list="cards-list"
                    placeholder="เช่น KBank Boss..." 
                    value={setupData.card} 
                    onChange={e => setSetupData({...setupData, card: e.target.value})} 
                  />
                  <datalist id="cards-list">
                    {cards?.map(c => <option key={c.id} value={c.cardName} />)}
                  </datalist>
                </div>

                <div className="grid gap-2">
                  <Label>👤 ชื่อเฟสบุ๊ค (FB Profile)</Label>
                  <Input 
                    list="profiles-list"
                    placeholder="เช่น เฟสพี่บอส 1" 
                    value={setupData.profile} 
                    onChange={e => setSetupData({...setupData, profile: e.target.value})} 
                  />
                  <datalist id="profiles-list">
                    {profiles.map(e => <option key={e.id} value={e.name} />)}
                  </datalist>
                </div>

                <div className="grid gap-2">
                  <Label>📄 ชื่อเพจ (FB Page)</Label>
                  <Input 
                    list="pages-list"
                    placeholder="เช่น เพจ Boss OS" 
                    value={setupData.page} 
                    onChange={e => setSetupData({...setupData, page: e.target.value})} 
                  />
                  <datalist id="pages-list">
                    {pages.map(e => <option key={e.id} value={e.name} />)}
                  </datalist>
                </div>

                <div className="grid gap-2">
                  <Label>📈 บัญชีโฆษณา (Ad Account)</Label>
                  <Input 
                    list="ads-list"
                    placeholder="เช่น BM1 - Ad 01" 
                    value={setupData.adAccount} 
                    onChange={e => setSetupData({...setupData, adAccount: e.target.value})} 
                  />
                  <datalist id="ads-list">
                    {adAccounts.map(e => <option key={e.id} value={e.name} />)}
                  </datalist>
                </div>

                <div className="grid gap-2">
                  <Label>🔄 บริการอื่นๆ (Subscription)</Label>
                  <Input 
                    list="subs-list"
                    placeholder="เช่น Canva, Netflix, ChatGPT" 
                    value={setupData.subscription} 
                    onChange={e => setSetupData({...setupData, subscription: e.target.value})} 
                  />
                  <datalist id="subs-list">
                    {subscriptions.map(e => <option key={e.id} value={e.name} />)}
                  </datalist>
                </div>

                <Button 
                  className="mt-4"
                  onClick={() => createSetupMutation.mutate(setupData)} 
                  disabled={createSetupMutation.isPending || !setupData.card}
                >
                  บันทึกข้อมูลและสร้างความสัมพันธ์
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><LinkIcon className="w-4 h-4 mr-2" /> ผูกเส้นเดียว</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ผูกบัตรใหม่</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <Select value={formData.cardId} onValueChange={v => setFormData({...formData, cardId: v})}>
                  <SelectTrigger><SelectValue placeholder="เลือกบัตรเครดิต" /></SelectTrigger>
                  <SelectContent>
                    {cards && cards.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.cardName}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                <Select value={formData.entityId} onValueChange={v => setFormData({...formData, entityId: v})}>
                  <SelectTrigger><SelectValue placeholder="เลือกบัญชีปลายทาง" /></SelectTrigger>
                  <SelectContent>
                    {entities && entities.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.type})</SelectItem>)}
                  </SelectContent>
                </Select>

                <Button 
                  onClick={() => createLinkMutation.mutate({ cardId: Number(formData.cardId), entityId: Number(formData.entityId) })} 
                  disabled={createLinkMutation.isPending || !formData.cardId || !formData.entityId}
                >
                  บันทึกการผูก
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 border rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
        {/* React Flow Canvas */}
        <div className="flex-1 min-h-[400px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            attributionPosition="bottom-right"
          >
            <Controls />
            <MiniMap />
            <Background gap={12} size={1} />
          </ReactFlow>
        </div>
      </div>
      
      {/* Table view at bottom */}
      <div className="mt-8 bg-white rounded-lg border shadow-sm overflow-hidden shrink-0">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 border-b">
            <tr>
              <th className="px-6 py-3 font-medium">บัตรเครดิต</th>
              <th className="px-6 py-3 font-medium">เชื่อมไปยัง</th>
              <th className="px-6 py-3 font-medium">หมายเหตุ</th>
              <th className="px-6 py-3 font-medium">วันที่ผูก</th>
              <th className="px-6 py-3 font-medium w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(!links || links.length === 0) && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">ยังไม่มีการผูกบัตร</td></tr>
            )}
            {links && links.map(l => {
              const card = cards?.find(c => c.id === l.cardId);
              const entity = entities?.find(e => e.id === l.entityId);
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{card?.cardName || `Card #${l.cardId}`}</td>
                  <td className="px-6 py-3">{entity?.name || `Entity #${l.entityId}`}</td>
                  <td className="px-6 py-3 text-slate-500">{l.note || "-"}</td>
                  <td className="px-6 py-3 text-slate-500">{new Date(l.createdAt).toLocaleDateString('th-TH')}</td>
                  <td className="px-6 py-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => deleteLinkMutation.mutate({ cardId: l.cardId, entityId: l.entityId })}>
                      <Unlink className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
