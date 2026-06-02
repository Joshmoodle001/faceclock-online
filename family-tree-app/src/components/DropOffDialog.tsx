import { useState } from 'react';

interface SiteOption {
  id: string;
  name: string;
}

interface DropOffDialogProps {
  open: boolean;
  childName: string;
  sites: SiteOption[];
  onConfirm: (siteId: string | null, customLocation: string | null) => void;
  onCancel: () => void;
}

export function DropOffDialog({ open, childName, sites, onConfirm, onCancel }: DropOffDialogProps) {
  const [mode, setMode] = useState<'select' | 'manual'>('select');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [customLocation, setCustomLocation] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (mode === 'select' && selectedSiteId) {
      onConfirm(selectedSiteId, null);
    } else if (mode === 'manual' && customLocation.trim()) {
      onConfirm(null, customLocation.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Drop-Off Location</h2>
          <p className="text-sm text-gray-500">
            Where are we dropping off <strong>{childName}</strong>?
          </p>
        </div>

        <div className="space-y-4">
          {mode === 'select' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a Site</label>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Search or select a site...</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setMode('manual')}
                className="text-blue-600 text-xs hover:underline"
              >
                Can&apos;t find it — type the store name instead
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Store Name</label>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                <input
                  type="text"
                  placeholder="Enter store name..."
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <button onClick={() => setMode('select')} className="text-blue-600 text-xs hover:underline">
                Back to site selection
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">Skip</button>
          <button
            onClick={handleConfirm}
            disabled={mode === 'select' ? !selectedSiteId : !customLocation.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
