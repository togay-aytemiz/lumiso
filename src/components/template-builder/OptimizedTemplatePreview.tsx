import React, { useMemo } from 'react';
import { TemplatePreview } from './TemplatePreview';
import { TemplateBlock } from '@/types/templateBuilder';

interface OptimizedTemplatePreviewProps {
  blocks: TemplateBlock[];
  activeChannel: 'email' | 'whatsapp' | 'sms';
  onChannelChange: (channel: 'email' | 'whatsapp' | 'sms') => void;
  emailSubject: string;
  preheader: string;
  previewData: Record<string, string>;
  showSendTestButton?: boolean;
}

export const OptimizedTemplatePreview = React.memo(({
  blocks,
  activeChannel,
  onChannelChange,
  emailSubject,
  preheader,
  previewData,
  showSendTestButton
}: OptimizedTemplatePreviewProps) => {
  // Memoize the preview data to prevent unnecessary re-renders
  const memoizedPreviewData = useMemo(() => previewData, [previewData]);
  
  // Memoize the blocks to prevent unnecessary processing
  const memoizedBlocks = useMemo(() => blocks, [blocks]);

  return (
    <TemplatePreview
      blocks={memoizedBlocks}
      activeChannel={activeChannel}
      onChannelChange={onChannelChange}
      emailSubject={emailSubject}
      preheader={preheader}
      previewData={memoizedPreviewData}
      showSendTestButton={showSendTestButton}
    />
  );
});

OptimizedTemplatePreview.displayName = 'OptimizedTemplatePreview';
