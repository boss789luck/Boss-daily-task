import React, { useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Entity = any;
type Card = any;
type Link = any;

interface LinkListViewProps {
  cards: Card[];
  entities: Entity[];
  links: Link[];
}

interface RowData {
  id: string;
  card: Card;
  page: Entity | null;
  adAccount: Entity | null;
  fbProfile: Entity | null;
}

export function LinkListView({ cards, entities, links }: LinkListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const rows = useMemo(() => {
    if (!cards || !entities || !links) return [];

    const rowData: RowData[] = [];

    cards.forEach(card => {
      // Get all links for this card
      const cardLinks = links.filter(l => l.cardId === card.id);
      const linkedEntities = cardLinks.map(l => entities.find(e => e.id === l.entityId)).filter(Boolean);

      const pages = linkedEntities.filter(e => e.type === "page");
      const adAccounts = linkedEntities.filter(e => e.type === "ad_account");
      const fbProfiles = linkedEntities.filter(e => e.type === "fb_profile");

      const maxRows = Math.max(pages.length, adAccounts.length, fbProfiles.length, 1);

      for (let i = 0; i < maxRows; i++) {
        const page = pages[i] || pages[0] || null;
        const adAccount = adAccounts[i] || adAccounts[0] || null;
        const fbProfile = fbProfiles[i] || fbProfiles[0] || null;

        // Skip empty rows if card has no linked entities at all (unless you want to show the card anyway)
        // We'll show the card anyway so they know it exists
        rowData.push({
          id: `${card.id}-${i}`,
          card,
          page,
          adAccount,
          fbProfile
        });
      }
    });

    return rowData;
  }, [cards, entities, links]);

  // Filtering
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      // Status Filter
      if (statusFilter !== "all") {
        const pageStatus = row.page?.status || "unknown";
        const adStatus = row.adAccount?.status || "unknown";
        // If filter is active, check if either page or ad account is active
        if (statusFilter === "active" && pageStatus !== "active" && adStatus !== "active") return false;
        if (statusFilter === "inactive" && pageStatus === "active" && adStatus === "active") return false; // Rough logic
      }

      // Search Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchCard = row.card.cardName.toLowerCase().includes(term);
        const matchPage = row.page?.name.toLowerCase().includes(term);
        const matchAd = row.adAccount?.name.toLowerCase().includes(term);
        const matchProfile = row.fbProfile?.name.toLowerCase().includes(term);
        if (!matchCard && !matchPage && !matchAd && !matchProfile) return false;
      }

      return true;
    });
  }, [rows, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!entities) return { activePages: 0, inactivePages: 0, activeAds: 0, inactiveAds: 0 };
    
    const pages = entities.filter(e => e.type === "page");
    const ads = entities.filter(e => e.type === "ad_account");

    return {
      activePages: pages.filter(p => p.status === "active").length,
      inactivePages: pages.filter(p => p.status !== "active").length,
      activeAds: ads.filter(a => a.status === "active").length,
      inactiveAds: ads.filter(a => a.status !== "active").length,
      totalCards: cards?.length || 0
    };
  }, [entities, cards]);

  const StatusIndicator = ({ status }: { status: string }) => {
    if (status === "active") {
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-green-600">Active</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
        <span className="text-sm font-medium text-red-600">{status === "banned" ? "Banned" : status === "paused" ? "Paused" : "Inactive"}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Top Bar: Stats & Filters */}
      <div className="p-4 border-b bg-gray-50 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <span className="font-bold text-lg">{stats.totalCards}</span>
            </div>
            <div className="text-sm text-gray-600 leading-tight">
              Total<br/>Cards
            </div>
          </div>
          
          <div className="h-8 w-px bg-gray-200"></div>

          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 mb-1">Pages</span>
              <div className="flex gap-3 text-sm">
                <span className="text-green-600 font-medium">{stats.activePages} Active</span>
                <span className="text-red-600 font-medium">{stats.inactivePages} Inactive</span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-gray-200"></div>

            <div className="flex flex-col">
              <span className="text-xs text-gray-500 mb-1">Ad Accounts</span>
              <div className="flex gap-3 text-sm">
                <span className="text-green-600 font-medium">{stats.activeAds} Active</span>
                <span className="text-red-600 font-medium">{stats.inactiveAds} Inactive</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="ค้นหาชื่อเพจ, บัญชีโฆษณา, บัตร..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="สถานะทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สถานะทั้งหมด</SelectItem>
              <SelectItem value="active">Active เท่านั้น</SelectItem>
              <SelectItem value="inactive">Inactive / Banned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100/50 sticky top-0 z-10 shadow-sm text-sm text-gray-600">
              <th className="p-4 font-semibold border-b w-[25%]">เพจ (Page)</th>
              <th className="p-4 font-semibold border-b w-[25%]">บัญชีโฆษณา (Ad Account)</th>
              <th className="p-4 font-semibold border-b w-[25%]">เฟสบุ๊ค (FB Profile)</th>
              <th className="p-4 font-semibold border-b w-[25%]">บัตรเครดิต (Credit Card)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  ไม่พบข้อมูลที่ตรงกับเงื่อนไข
                </td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* Page Column */}
                  <td className="p-4 align-top">
                    {row.page ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium text-gray-900">{row.page.name}</span>
                        <StatusIndicator status={row.page.status} />
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                  
                  {/* Ad Account Column */}
                  <td className="p-4 align-top">
                    {row.adAccount ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium text-gray-900">{row.adAccount.name}</span>
                        <StatusIndicator status={row.adAccount.status} />
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>

                  {/* FB Profile Column */}
                  <td className="p-4 align-top">
                    {row.fbProfile ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium text-gray-900">{row.fbProfile.name}</span>
                        <span className="text-xs text-gray-500">{row.fbProfile.status}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>

                  {/* Card Column */}
                  <td className="p-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-gray-900">{row.card.cardName}</span>
                      <span className="text-xs font-mono text-gray-500">**** **** **** {row.card.cardNumberLast4}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
