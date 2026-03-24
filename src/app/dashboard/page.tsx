'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import { LayoutDashboard, ArrowLeft, Bot, PanelRightOpen, History, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useSchemaStore } from '@/stores/schema-store';
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar';
import { ERDiagram } from '@/components/dashboard/er-diagram';
import { TableDetails } from '@/components/dashboard/table-details';
import { AIChat } from '@/components/chat/ai-chat';
import { VersionTimeline } from '@/components/dashboard/version-timeline';
import { ExplainPlanPanel } from '@/components/dashboard/explain-plan-panel';
import { cn } from '@/lib/utils';

const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 700;
const DEFAULT_PANEL_WIDTH = 380;

export default function DashboardPage() {
  const router = useRouter();
  const currentSchema = useSchemaStore((s) => s.currentSchema);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagram' | 'explain' | 'versions'>('diagram');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX - e.clientX;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  // No schema loaded — show empty state
  if (!currentSchema) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <LayoutDashboard className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-muted-foreground max-w-md">
          No schema loaded. Import a schema first to see the ER diagram.
        </p>
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Import
        </Button>
      </div>
    );
  }

  const selected = selectedTable
    ? currentSchema.tables.find((t) => t.name === selectedTable) ?? null
    : null;

  return (
    <div className="flex flex-col h-screen -mx-4 -mb-4 -mt-14 md:-m-6">
      {/* Toolbar */}
      <DashboardToolbar />

      {/* Main content: ER diagram + AI chat */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Tabs (ER Diagram / Versions) */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Tab bar */}
          <div className="flex items-center border-b bg-muted/20 px-2">
            <button
              onClick={() => setActiveTab('diagram')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px',
                activeTab === 'diagram'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutDashboard className="h-3 w-3" />
              ER Diagram
            </button>
            <button
              onClick={() => setActiveTab('explain')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px',
                activeTab === 'explain'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Zap className="h-3 w-3" />
              Explain Plan
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px',
                activeTab === 'versions'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <History className="h-3 w-3" />
              Versions
            </button>

            <div className="flex-1" />

            {/* Toggle button when chat is closed */}
            {!chatOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChatOpen(true)}
                className="h-7 text-xs"
              >
                <Bot className="h-3.5 w-3.5 mr-1" />
                Chat
                <PanelRightOpen className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>

          {/* Tab content */}
          {activeTab === 'diagram' && (
            <>
              <div className="flex-1 min-h-0 relative">
                <ReactFlowProvider>
                  <ERDiagram
                    schema={currentSchema}
                    selectedTable={selectedTable}
                    onSelectTable={setSelectedTable}
                  />
                </ReactFlowProvider>
              </div>

              {/* Bottom panel — table details */}
              {selected && (
                <TableDetails table={selected} rawSQL={currentSchema.rawSQL} />
              )}
            </>
          )}
          {activeTab === 'explain' && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ExplainPlanPanel />
            </div>
          )}
          {activeTab === 'versions' && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <VersionTimeline />
            </div>
          )}
        </div>

        {/* Right: AI Chat (resizable + collapsible) — desktop only */}
        {chatOpen && (
          <div
            className="shrink-0 hidden lg:flex relative"
            style={{ width: panelWidth }}
          >
            {/* Drag handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-primary/30 active:bg-primary/50 transition-colors"
              onMouseDown={handleMouseDown}
            />
            <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
              <AIChat onClose={() => setChatOpen(false)} />
            </div>
          </div>
        )}
      </div>

      {/* Mobile chat — floating button + Sheet drawer */}
      <div className="lg:hidden">
        <Sheet open={mobileChatOpen} onOpenChange={setMobileChatOpen}>
          <SheetTrigger
            render={
              <Button
                size="icon"
                className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
              />
            }
          >
            <Bot className="h-5 w-5" />
            <span className="sr-only">Open Chat</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[75vh] p-0" showCloseButton={false}>
            <AIChat onClose={() => setMobileChatOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
