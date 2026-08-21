"use client";

import { useState } from "react";
import { Search, Barcode } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemberSearchProps {
  onMemberSelect: (member: any) => void;
}

export function MemberSearch({ onMemberSelect }: MemberSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would search the database
    console.log("Searching for:", searchQuery);
  };

  const handleScan = () => {
    setIsScanning(true);
    // In production, this would activate the scanner
    setTimeout(() => {
      setIsScanning(false);
      // Simulate a successful scan
      onMemberSelect({
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        photo: null,
        membership_type: "Premium",
        outstanding_balance: 0,
        waiver_valid: true,
        access_token: "12345",
      });
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, or phone..."
            className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/80 min-h-[44px]"
        >
          Search
        </button>
      </form>

      {/* Manual Entry */}
      <div className="flex gap-3">
        <button
          onClick={handleScan}
          disabled={isScanning}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px]",
            isScanning
              ? "bg-status-info text-status-info-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <Barcode className="w-5 h-5" />
          {isScanning ? "Scanning..." : "Scan Barcode"}
        </button>
        <button
          className="flex-1 px-4 py-3 bg-muted border border-border text-foreground rounded-lg font-medium hover:bg-muted/80 min-h-[44px]"
        >
          Manual Entry
        </button>
      </div>
    </div>
  );
}