'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MapPin, Type } from 'lucide-react';

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

  const handleConfirm = () => {
    if (mode === 'select' && selectedSiteId) {
      onConfirm(selectedSiteId, null);
    } else if (mode === 'manual' && customLocation.trim()) {
      onConfirm(null, customLocation.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Drop-Off Location</DialogTitle>
          <DialogDescription>
            Where are we dropping off <strong>{childName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'select' ? (
            <div className="space-y-2">
              <Label>Select a Site</Label>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Search or select a site..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setMode('manual')}>
                {`Can't find it — type the store name instead`}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Store Name</Label>
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Enter store name..."
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setMode('select')}>
                Back to site selection
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Skip</Button>
          <Button onClick={handleConfirm} disabled={mode === 'select' ? !selectedSiteId : !customLocation.trim()}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
