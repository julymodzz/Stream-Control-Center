import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Palette, Play, Save, Trash2 } from 'lucide-react';
import {
  fetchDesignerTemplates,
  saveDesignerLayout,
  applyDesignerLayout,
} from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { DesignerTemplate, DesignerElement, DesignerLayout, DesignerComponentType } from '../types';

interface CanvasElement extends DesignerElement {
  selected?: boolean;
}

export function StreamingDesigner() {
  const canControl = useAuthStore((s) => s.hasPermission('obs.control'));
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<DesignerTemplate[]>([]);
  const [currentLayout, setCurrentLayout] = useState<DesignerLayout>({
    id: 'new-' + Date.now(),
    name: 'Untitled Pro Layout',
    sceneName: 'Main',
    elements: [],
    updatedAt: new Date().toISOString(),
  });
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [message, setMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Aspect ratio / Screen width support (full screen, vertical, ultrawide etc.)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '21:9'>('16:9');
  const aspectConfig = {
    '16:9': { width: 'min(900px, 92vw)', ratio: '16 / 9', label: 'Standard 16:9 (Full HD)' },
    '9:16': { width: 'min(400px, 60vw)', ratio: '9 / 16', label: 'Vertical 9:16 (Shorts/TikTok)' },
    '21:9': { width: 'min(1100px, 95vw)', ratio: '21 / 9', label: 'Ultrawide 21:9' },
  };

  // Camera preview streams (direct in designer)
  const [cameraStreams, setCameraStreams] = useState<Record<string, MediaStream>>({});
  const [cameraConsentGiven, setCameraConsentGiven] = useState(false);

  // Ready-made animated designs - pre-configured with professional animations (Move Transition style, CSS powered)
  const animatedDesignPresets = [
    { name: 'Smooth Camera Pop-In', animation: 'pop', desc: 'Kamera kommt mit sanfter Pop-Animation (Move-Plugin ready)' },
    { name: 'Slide Werbung', animation: 'slide', desc: 'Werbe-Banner slide von rechts (professionell für Sponsoren)' },
    { name: 'Pulse Alert', animation: 'pulse', desc: 'Ankündigung pulsiert für Aufmerksamkeit' },
    { name: 'Fade Fullscreen', animation: 'fade', desc: 'Elegantes Fade für Screen-breite Übergänge' },
  ];

  // Embedded rich high-class templates (used as robust fallback + reference)
  // Embedded templates are defined below as getEmbeddedTemplates (hoisted) for fallback

  // Load professional templates from backend (high-class, component-based with rich Vorlagen)
  useEffect(() => {
    fetchDesignerTemplates()
      .then((data) => setTemplates(data || []))
      .catch(() => {
        // Fallback to embedded high-class templates if API not ready (ensures full functionality)
        const embedded = getEmbeddedTemplates();
        setTemplates(embedded as any);
      });
  }, []);

  // Sync canvas elements with layout
  useEffect(() => {
    setCanvasElements(
      currentLayout.elements.map((el) => ({
        ...el,
        selected: el.id === selectedId,
      }))
    );
  }, [currentLayout.elements, selectedId]);

  const selectedElement = canvasElements.find((e) => e.id === selectedId);

  // Add template instance to canvas - fully functional drag-ready element
  const addTemplate = (template: DesignerTemplate) => {
    if (template.category === 'camera' && !cameraConsentGiven) {
      const confirmed = window.confirm(
        'KAMERA-BESTÄTIGUNG ERFORDERLICH\n\n' +
        'Sie fügen eine Kamera-Komponente hinzu. Bitte bestätigen Sie, dass Sie die Erlaubnis haben, diese Kamera (Webcam / Capture) in Ihrem Stream zu verwenden und alle rechtlichen Vorgaben (Persönlichkeitsrechte, Urheberrecht) einzuhalten.\n\n' +
        'Die Vorschau im Designer verwendet Ihren Browser (lokal). Im tatsächlichen OBS-Stream verwenden Sie Ihre konfigurierte Kamera-Quelle.\n\n' +
        'Bestätigen Sie mit OK, um fortzufahren.'
      );
      if (!confirmed) return;
      setCameraConsentGiven(true);
    }

    const newEl: CanvasElement = {
      id: 'el-' + Date.now(),
      type: template.category as DesignerComponentType,
      templateId: template.id,
      x: 25 + (canvasElements.length % 3) * 8,
      y: 20 + Math.floor(canvasElements.length / 3) * 12,
      width: template.category === 'camera' ? 28 : 22,
      height: template.category === 'camera' ? 22 : 14,
      zIndex: canvasElements.length + 1,
      visible: true,
      custom: { ...template.defaultCustom },
      selected: false,
    };

    const updatedElements = [...currentLayout.elements, newEl];
    setCurrentLayout({
      ...currentLayout,
      elements: updatedElements,
      updatedAt: new Date().toISOString(),
    });
    setSelectedId(newEl.id);
    setMessage(`Added ${template.name} template`);

    if (template.category === 'camera') {
      // Auto-offer direct preview
      setTimeout(() => activateCameraPreview(newEl.id), 300);
    }
  };

  // New: Inline text editing for design and announcements
  const startTextEdit = (elementId: string) => {
    const el = canvasElements.find(e => e.id === elementId);
    if (!el) return;

    const currentText = el.custom.text || el.custom.sponsorName || el.custom.name || '';
    setEditingTextId(elementId);
    setEditingTextValue(String(currentText));
  };

  const saveTextEdit = () => {
    if (!editingTextId) return;

    const updatedElements = currentLayout.elements.map(el =>
      el.id === editingTextId
        ? {
            ...el,
            custom: {
              ...el.custom,
              text: editingTextValue,
              // Also update common fields for announcements/sponsors
              sponsorName: el.custom.sponsorName !== undefined ? editingTextValue : el.custom.sponsorName,
              name: el.custom.name !== undefined ? editingTextValue : el.custom.name,
            }
          }
        : el
    );

    setCurrentLayout({
      ...currentLayout,
      elements: updatedElements,
      updatedAt: new Date().toISOString(),
    });

    setEditingTextId(null);
    setEditingTextValue('');
    setMessage('Text aktualisiert – sichtbar im Preview und wird zu OBS übertragen');
  };

  const cancelTextEdit = () => {
    setEditingTextId(null);
    setEditingTextValue('');
  };

  // Direct camera preview in designer - requires explicit confirmation that user may use the camera
  const activateCameraPreview = async (elementId: string) => {
    const el = canvasElements.find(e => e.id === elementId);
    if (!el || el.type !== 'camera') return;

    if (!cameraConsentGiven) {
      const confirmed = window.confirm(
        'KAMERA-BESTÄTIGUNG\n\n' +
        'Durch Klicken auf OK bestätigen Sie, dass Sie die rechtliche Erlaubnis haben, diese Kamera in Ihrem Stream zu verwenden (z.B. eigene Webcam, keine urheberrechtlich geschützten Inhalte Dritter ohne Genehmigung).\n\n' +
        'Datenschutz: Die Vorschau läuft nur lokal in Ihrem Browser und wird nicht an Dritte übertragen. Für den tatsächlichen OBS-Stream gelten Ihre lokalen OBS-Einstellungen.\n\n' +
        'Möchten Sie fortfahren?'
      );
      if (!confirmed) return;
      setCameraConsentGiven(true);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStreams(prev => ({ ...prev, [elementId]: stream }));
      setMessage('Kamera-Preview aktiv – direkt im Designer sichtbar. Bei Apply wird die Kamera-Quelle in OBS übernommen (verwenden Sie Ihre OBS-Kamera-Quelle).');
    } catch (err) {
      alert('Kamera-Zugriff fehlgeschlagen. Bitte erlauben Sie den Zugriff im Browser oder prüfen Sie Ihre OBS-Kamera in den Einstellungen.');
    }
  };

  // Simple but professional canvas drag (pointer events - no external deps, clean)
  const startDrag = (e: React.PointerEvent, elementId: string) => {
    e.stopPropagation();
    setSelectedId(elementId);

    const startX = e.clientX;
    const startY = e.clientY;
    const el = canvasElements.find((c) => c.id === elementId)!;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / 800) * 100; // scale to %
      const dy = ((moveEvent.clientY - startY) / 450) * 100;

      const updated = currentLayout.elements.map((item) =>
        item.id === elementId
          ? {
              ...item,
              x: Math.max(0, Math.min(75, item.x + dx)),
              y: Math.max(0, Math.min(65, item.y + dy)),
            }
          : item
      );

      setCurrentLayout({ ...currentLayout, elements: updated, updatedAt: new Date().toISOString() });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Update custom properties - core personalization (high-class dynamic fields)
  const updateCustom = (key: string, value: any) => {
    if (!selectedId) return;

    const updatedElements = currentLayout.elements.map((el) =>
      el.id === selectedId ? { ...el, custom: { ...el.custom, [key]: value } } : el
    );

    setCurrentLayout({
      ...currentLayout,
      elements: updatedElements,
      updatedAt: new Date().toISOString(),
    });
  };

  // Layers controls - professional reordering & visibility
  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const elements = [...currentLayout.elements];
    const index = elements.findIndex((e) => e.id === id);
    if (index < 0) return;

    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= elements.length) return;

    [elements[index], elements[swapWith]] = [elements[swapWith], elements[index]];
    elements.forEach((el, i) => (el.zIndex = i + 1));

    setCurrentLayout({ ...currentLayout, elements, updatedAt: new Date().toISOString() });
  };

  const toggleVisibility = (id: string) => {
    const updated = currentLayout.elements.map((el) =>
      el.id === id ? { ...el, visible: !el.visible } : el
    );
    setCurrentLayout({ ...currentLayout, elements: updated, updatedAt: new Date().toISOString() });
  };

  const deleteElement = (id: string) => {
    const updated = currentLayout.elements.filter((el) => el.id !== id);
    setCurrentLayout({ ...currentLayout, elements: updated, updatedAt: new Date().toISOString() });
    if (selectedId === id) setSelectedId(null);
  };

  // High-class Apply - fully functional, reuses existing pipeline (no duplication)
  const handleApplyToOBS = async () => {
    if (!canControl) return;

    setIsApplying(true);
    setMessage('Pushing professional layout to OBS...');

    try {
      const result: any = await applyDesignerLayout(currentLayout);
      setMessage(result.message || 'Layout applied successfully to OBS');

      // Optional: also save the layout
      await saveDesignerLayout(currentLayout);
    } catch (e: any) {
      setMessage('Apply failed: ' + (e.message || 'Check OBS connection'));
    } finally {
      setIsApplying(false);
    }
  };

  const handleSaveLayout = async () => {
    try {
      await saveDesignerLayout(currentLayout);
      setMessage('Layout saved successfully');
    } catch (e) {
      setMessage('Save failed');
    }
  };

  // New clean layout
  const newLayout = () => {
    setCurrentLayout({
      id: 'new-' + Date.now(),
      name: 'New Pro Layout',
      sceneName: 'Main',
      elements: [],
      updatedAt: new Date().toISOString(),
    });
    setSelectedId(null);
    setMessage('New layout created');
  };

  // Embedded rich templates for robustness (same as backend - no overlap, single source of truth pattern)
  function getEmbeddedTemplates(): DesignerTemplate[] {
    return [
      { id: 'cam-elegant-pip', name: 'Elegant PIP', description: 'Rounded PIP with shadow + accent. Move-ready.', category: 'camera', preview: 'PIP', defaultCustom: { borderColor: '#fff', animation: 'pop' }, proTips: ['Use Move plugin'] },
      { id: 'cam-cinematic-full', name: 'Cinematic Full', description: 'Full bleed with vignette and sponsor frame.', category: 'camera', preview: 'Full', defaultCustom: { vignette: 0.3 }, proTips: ['Pro keying'] },
      { id: 'ad-top-premium-banner', name: 'Premium Top Banner', description: 'Animated sponsor banner with logo burst.', category: 'werbung', preview: 'Banner', defaultCustom: { sponsorName: 'Your Sponsor' }, proTips: ['Browser source for clicks'] },
      { id: 'ad-vertical-sponsor-wall', name: 'Sponsor Wall', description: 'Clean multi-sponsor vertical stack.', category: 'werbung', preview: 'Wall', defaultCustom: { slots: 3 }, proTips: ['Easy rotation'] },
      { id: 'overlay-modern-lowerthird', name: 'Modern Lower Third', description: 'Minimal dynamic lower third.', category: 'overlay', preview: 'Lower', defaultCustom: { name: 'Streamer', title: 'Playing' }, proTips: ['Twitch bindable'] },
      { id: 'alert-premium-popup', name: 'Premium Alert', description: 'High-production popup with animation.', category: 'alert', preview: 'Popup', defaultCustom: { duration: 5 }, proTips: ['Rich text + image'] },
    ] as any;
  }

  const groupedTemplates = templates.reduce((acc: Record<string, DesignerTemplate[]>, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* High-class animation keyframes for ready-made animated designs (visible directly in designer preview) */}
      <style>{`
        @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 50% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slide { 0% { transform: translateX(60px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        @keyframes fade { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      `}</style>
      {/* Pro Top Bar - high-class, minimal, functional */}
      <div className="h-14 border-b border-white/10 bg-[#111] flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="font-semibold tracking-tight flex items-center gap-2 text-xl">
            <Palette className="h-5 w-5 text-accent" /> Streaming Designer
          </div>
          <Badge variant="outline" className="ml-2">High-Class Production</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={currentLayout.name}
            onChange={(e) => setCurrentLayout({ ...currentLayout, name: e.target.value })}
            className="w-64 bg-transparent border-white/20 h-8"
          />
          <Button onClick={newLayout} variant="outline" size="sm">New</Button>
          <Button onClick={handleSaveLayout} variant="outline" size="sm"><Save className="h-4 w-4 mr-1" /> Save</Button>
          <Button onClick={handleApplyToOBS} disabled={!canControl || isApplying} size="sm" className="bg-accent text-black">
            <Play className="h-4 w-4 mr-1" /> {isApplying ? 'Applying...' : 'Apply to OBS'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Template Library - professional, categorized, high-class Vorlagen */}
        <div className="w-72 border-r border-white/10 bg-[#111] p-3 overflow-auto">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-2 px-1">COMPONENT TEMPLATES</div>
          {Object.entries(groupedTemplates).map(([cat, list]) => (
            <div key={cat} className="mb-4">
              <div className="text-[10px] font-medium text-gray-400 px-1 mb-1.5 uppercase">{cat.toUpperCase()}</div>
              <div className="space-y-1.5">
                {list.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => addTemplate(tpl)}
                    className="w-full text-left p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition text-sm"
                  >
                    <div className="font-medium">{tpl.name}</div>
                    <div className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{tpl.description}</div>
                    <div className="text-[10px] text-accent mt-1">+ Add to canvas</div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Dedicated high-class feature: Ankündigungen erstellen */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="text-[10px] font-medium text-gray-400 px-1 mb-1.5 uppercase">SCHNELL ERSTELLEN</div>
            <button
              onClick={() => {
                const announcementEl: CanvasElement = {
                  id: 'el-' + Date.now(),
                  type: 'overlay',
                  templateId: 'announcement-custom',
                  x: 15,
                  y: 65,
                  width: 70,
                  height: 18,
                  zIndex: canvasElements.length + 10,
                  visible: true,
                  custom: { 
                    text: 'Deine Ankündigung hier...\nWeitere Infos folgen in Kürze.', 
                    title: 'Wichtige Ankündigung', 
                    textColor: '#ffcc00', 
                    fontSize: 16, 
                    animation: 'fade',
                    textAlign: 'center'
                  },
                  selected: false,
                };
                const updated = [...currentLayout.elements, announcementEl];
                setCurrentLayout({ ...currentLayout, elements: updated, updatedAt: new Date().toISOString() });
                setSelectedId(announcementEl.id);
                setMessage('Ankündigung hinzugefügt – Text direkt bearbeiten');
              }}
              className="w-full p-2.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 text-sm text-left"
            >
              <div className="font-medium">+ Ankündigung erstellen</div>
              <div className="text-[11px] text-gray-400">Sofort editierbarer Text für Stream-Infos, Sponsor-Hinweise oder Events</div>
            </button>
          </div>

          {/* Fertige animierte Designs - ready-made high-class animated presets */}
          <div className="mt-3 pt-2 border-t border-white/10">
            <div className="text-[10px] font-medium text-gray-400 px-1 mb-1.5 uppercase">FERTIGE ANIMIERTE DESIGNS</div>
            <div className="grid grid-cols-1 gap-1">
              {animatedDesignPresets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (!selectedId) {
                      setMessage('Bitte zuerst ein Element im Canvas auswählen');
                      return;
                    }
                    updateCustom('animation', preset.animation);
                    setMessage(`Fertiges animiertes Design "${preset.name}" angewendet`);
                  }}
                  className="text-left p-2 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <div className="font-medium text-accent">{preset.name}</div>
                  <div className="text-[10px] text-gray-400">{preset.desc}</div>
                </button>
              ))}
            </div>
            <div className="text-[9px] text-gray-500 mt-1 px-1">Wendet fertige Animation auf das ausgewählte Element an (direkt im Preview sichtbar, Move-Plugin kompatibel für OBS).</div>
          </div>
          <div className="text-[10px] text-gray-500 mt-4 px-1">All templates are pro-grade with animation slots, dynamic bindings and plugin compatibility (Move, Masks, etc.).</div>
        </div>

        {/* Canvas - 16:9 professional visual editor */}
        <div className="flex-1 flex flex-col p-4 bg-[#0a0a0a]">
          <div className="mb-2 text-xs text-gray-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              Screen Breite:
              {(['16:9', '9:16', '21:9'] as const).map(ar => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar)}
                  className={`px-2 py-0.5 rounded ${aspectRatio === ar ? 'bg-accent text-black' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {ar}
                </button>
              ))}
              <span className="ml-2 text-[10px]">{aspectConfig[aspectRatio].label}</span>
            </div>
            <div className="text-accent">Scene: {currentLayout.sceneName}</div>
          </div>

          <div
            className="relative mx-auto bg-black shadow-2xl border border-white/20 overflow-hidden"
            style={{ 
              width: aspectConfig[aspectRatio].width, 
              aspectRatio: aspectConfig[aspectRatio].ratio 
            }}
            onClick={() => setSelectedId(null)}
          >
            {canvasElements
              .filter((e) => e.visible)
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) => {
                const isSelected = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => startDrag(e, el.id)}
                    onDoubleClick={() => startTextEdit(el.id)}
                    className={`absolute border cursor-move transition-all overflow-hidden ${isSelected ? 'border-accent ring-1 ring-accent/40' : 'border-white/30'}`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width}%`,
                      height: `${el.height}%`,
                      zIndex: el.zIndex,
                      background: el.type === 'camera' ? '#1a1a2e' : 'rgba(255,255,255,0.06)',
                      color: el.custom.textColor || '#ffffff',
                      fontSize: `${Math.max(8, (el.custom.fontSize || 14) * (el.height / 20)) }px`,
                      boxShadow: isSelected ? '0 0 0 2px rgba(0,200,255,0.2)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: el.custom.textAlign || 'center',
                      padding: '4px 8px',
                      whiteSpace: 'pre-wrap',
                      animation: el.custom.animation && el.custom.animation !== 'none' ? `${el.custom.animation} 1.5s infinite ease-in-out` : 'none',
                    }}
                  >
                    {el.type === 'camera' && cameraStreams[el.id] ? (
                      <video 
                        autoPlay 
                        playsInline 
                        muted 
                        ref={video => { if (video && cameraStreams[el.id]) video.srcObject = cameraStreams[el.id]; }}
                        className="w-full h-full object-cover"
                      />
                    ) : el.custom.title && <div className="font-bold mb-0.5 text-[0.9em]">{el.custom.title}</div>}
                    {!cameraStreams[el.id] && (el.custom.text || el.custom.sponsorName || el.custom.name || el.templateId.replace(/-/g, ' '))}
                    
                    {el.type === 'camera' && !cameraStreams[el.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center p-1">
                        <div>
                          <div className="text-[9px] mb-1">KAMERA</div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); activateCameraPreview(el.id); }}
                            className="text-[8px] bg-accent text-black px-1.5 py-0.5 rounded font-medium hover:bg-white"
                          >
                            Browser-Kamera als direkte Preview starten<br />(Bestätigung erforderlich)
                          </button>
                        </div>
                      </div>
                    )}
                    {isSelected && <div className="absolute -top-2 -right-2 text-[9px] bg-accent text-black px-1 rounded">SELECTED</div>}
                  </div>
                );
              })}

            {canvasElements.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                Add templates from the left library to start building your high-class monitor
              </div>
            )}

            {/* Inline Text Editor for direct text input and announcements */}
            {editingTextId && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="bg-[#111] border border-white/20 p-4 rounded-lg w-[min(400px,90%)]">
                  <div className="text-sm font-medium mb-2">Text / Ankündigung bearbeiten</div>
                  <textarea
                    className="w-full h-32 bg-[#0a0a0a] border border-white/10 rounded p-2 text-sm"
                    value={editingTextValue}
                    onChange={(e) => setEditingTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveTextEdit();
                      }
                      if (e.key === 'Escape') cancelTextEdit();
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={saveTextEdit}>Speichern</Button>
                    <Button size="sm" variant="outline" onClick={cancelTextEdit}>Abbrechen</Button>
                    <div className="text-[10px] text-gray-400 self-center ml-auto">Enter = speichern, Esc = abbrechen</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-center text-gray-500 mt-1.5">Positions are percentage-based for perfect OBS mapping. Double-click text elements to edit directly.</div>
        </div>

        {/* Properties + Layers - professional right column */}
        <div className="w-80 border-l border-white/10 bg-[#111] flex flex-col overflow-auto">
          {/* Properties */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">PROPERTIES</div>
              {selectedElement && <Badge variant="outline" className="text-xs">{selectedElement.templateId}</Badge>}
            </div>

            {!selectedElement && <div className="text-xs text-gray-400 py-6 text-center">Select an element on the canvas</div>}

            {selectedElement && (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Visibility</div>
                  <Button size="sm" variant={selectedElement.visible ? 'default' : 'outline'} onClick={() => toggleVisibility(selectedElement.id)}>
                    {selectedElement.visible ? 'Visible' : 'Hidden'}
                  </Button>
                </div>

                {/* Camera specific: direct preview activation with required confirmation */}
                {selectedElement.type === 'camera' && (
                  <div className="border border-white/10 p-2 rounded bg-white/5">
                    <div className="text-xs text-accent mb-1">KAMERA PREVIEW (direkt im Designer)</div>
                    <Button 
                      size="sm" 
                      onClick={() => activateCameraPreview(selectedElement.id)}
                      disabled={!!cameraStreams[selectedElement.id]}
                    >
                      {cameraStreams[selectedElement.id] ? 'Kamera-Preview aktiv' : 'Browser-Kamera als Preview starten'}
                    </Button>
                    <div className="text-[9px] text-gray-400 mt-1">Erfordert Ihre Bestätigung der Nutzungserlaubnis. Die Vorschau ist lokal und dient nur dem Designer-Workflow.</div>
                  </div>
                )}

                {/* Enhanced text & announcement design controls */}
                { (selectedElement.custom.text !== undefined || selectedElement.custom.sponsorName !== undefined || selectedElement.custom.name !== undefined) && (
                  <div className="space-y-2 border border-white/10 p-2 rounded">
                    <div className="text-xs font-medium text-accent">Text & Ankündigung</div>
                    
                    {/* Direct text input for announcements and personalization */}
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Text / Nachricht</div>
                      <textarea
                        className="w-full h-16 bg-[#0a0a0a] border border-white/10 rounded p-1.5 text-xs"
                        value={String(selectedElement.custom.text || selectedElement.custom.sponsorName || selectedElement.custom.name || '')}
                        onChange={(e) => {
                          const key = selectedElement.custom.text !== undefined ? 'text' : 
                                     selectedElement.custom.sponsorName !== undefined ? 'sponsorName' : 'name';
                          updateCustom(key, e.target.value);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Textfarbe</div>
                        <input 
                          type="color" 
                          value={selectedElement.custom.textColor || '#ffffff'} 
                          onChange={(e) => updateCustom('textColor', e.target.value)}
                          className="w-full h-7 bg-transparent border border-white/10 rounded" 
                        />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Schriftgröße</div>
                        <Input 
                          type="number" 
                          value={selectedElement.custom.fontSize || 14} 
                          onChange={(e) => updateCustom('fontSize', parseInt(e.target.value) || 14)}
                          className="h-7 text-xs" 
                          min="8" 
                          max="72"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 mb-1">Animation</div>
                      <select 
                        value={selectedElement.custom.animation || 'none'} 
                        onChange={(e) => updateCustom('animation', e.target.value)}
                        className="w-full h-7 bg-[#0a0a0a] border border-white/10 rounded text-xs"
                      >
                        <option value="none">Keine</option>
                        <option value="fade">Fade</option>
                        <option value="pop">Pop (Move Transition)</option>
                        <option value="slide">Slide</option>
                        <option value="pulse">Pulse</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Dynamic personalization fields - remaining custom fields */}
                {Object.entries(selectedElement.custom)
                  .filter(([key]) => !['text', 'sponsorName', 'name', 'textColor', 'fontSize', 'animation', 'textAlign'].includes(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-gray-400 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                      <Input
                        value={String(value)}
                        onChange={(e) => updateCustom(key, e.target.value)}
                        className="h-8 text-xs bg-[#0a0a0a] border-white/10"
                      />
                    </div>
                  ))}

                <div className="text-[10px] text-gray-500 pt-1">Double-Click auf Text-Elemente im Canvas für schnelle Bearbeitung. Alle Änderungen werden beim Apply zu OBS übertragen.</div>
              </div>
            )}
          </div>

          {/* Layers - clean, functional, pro */}
          <div className="p-3 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Layers className="h-4 w-4" /> LAYERS
            </div>
            {canvasElements.length === 0 && <div className="text-xs text-gray-500">No elements yet</div>}

            <div className="space-y-1">
              {[...canvasElements].sort((a, b) => b.zIndex - a.zIndex).map((el) => (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer ${el.id === selectedId ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <div className="truncate">{el.templateId}</div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); toggleVisibility(el.id); }} className="p-0.5">
                      {el.visible ? '👁' : '🚫'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'up'); }} className="px-1">↑</button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 'down'); }} className="px-1">↓</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="p-0.5 text-red-400"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-[#111] border-t border-white/10 px-4 py-1.5 text-xs text-accent flex items-center justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-gray-400">×</button>
        </div>
      )}
    </div>
  );
}
