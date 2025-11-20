import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, RotateCcw, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface HistoryPanelProps {
  versionHistory: {
    currentVersion: number;
    history: Array<{
      timestamp: Date;
      action: string;
      userId: string;
    }>;
  };
  onClose: () => void;
  onRestoreVersion: (versionIndex: number) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  versionHistory,
  onClose,
  onRestoreVersion
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <h3 className="font-semibold text-lg">Version History</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {/* Current Version */}
            <div className="bg-primary/10 border border-primary rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Current Version</div>
                  <div className="text-sm text-gray-500">Version {versionHistory.currentVersion}</div>
                </div>
                <div className="text-sm font-medium text-primary">Active</div>
              </div>
            </div>

            {/* History Versions */}
            {versionHistory.history.length > 0 ? (
              versionHistory.history.map((version, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">Version {versionHistory.currentVersion - (versionHistory.history.length - index)}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {version.action || 'Update'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {format(new Date(version.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Restore this version? Current changes will be lost.')) {
                          onRestoreVersion(index);
                        }
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No version history available</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-sm text-gray-500">
            Version history allows you to restore previous versions of your page. Each save creates a new version.
          </p>
        </div>
      </Card>
    </div>
  );
};
