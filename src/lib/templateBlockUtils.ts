import {
  TemplateBlock,
  TextBlockData,
  SessionDetailsBlockData,
  CTABlockData,
  ImageBlockData,
  FooterBlockData,
  DividerBlockData,
  HeaderBlockData,
  RawHTMLBlockData,
} from "@/types/templateBuilder";
import { replacePlaceholders } from "./templatePlaceholders";

// Convert blocks to HTML content for email rendering
export function blocksToHTML(blocks: TemplateBlock[], previewData: Record<string, string> = {}): string {
  if (!blocks || blocks.length === 0) {
    return '<p>No content</p>';
  }

  const visibleBlocks = blocks.filter(block => block.visible).sort((a, b) => a.order - b.order);
  
  const htmlParts = visibleBlocks.map(block => {
    switch (block.type) {
      case 'text':
        {
          const textData = block.data as TextBlockData;
          const content = replacePlaceholders(textData.content ?? '', previewData);
          const fontSize = textData.formatting?.fontSize ?? 'p';
          const alignment = textData.formatting?.alignment ?? 'left';
          const tag = fontSize === 'p' ? 'p' : fontSize;
        
          let styles = `text-align: ${alignment};`;
          if (textData.formatting?.bold) styles += ' font-weight: bold;';
          if (textData.formatting?.italic) styles += ' font-style: italic;';
        
          return `<${tag} style="${styles}">${content}</${tag}>`;
        }

      case 'session-details':
        {
          const sessionData = block.data as SessionDetailsBlockData;
          const heading = sessionData.customLabel?.trim() || 'Session Details';
          const projectLabel = sessionData.projectLabel?.trim() || 'Project';
          const packageLabel = sessionData.packageLabel?.trim() || 'Package';
          const meetingLabel = sessionData.meetingLabel?.trim() || 'Meeting Link';

          const detailRows = [
            { visible: sessionData.showName, label: 'Session', value: '{session_name}' },
            { visible: sessionData.showType, label: 'Type', value: '{session_type}' },
            { visible: sessionData.showDuration, label: 'Duration', value: '{session_duration}' },
            { visible: sessionData.showStatus, label: 'Status', value: '{session_status}' },
            { visible: sessionData.showDate, label: 'Date', value: '{session_date}' },
            { visible: sessionData.showTime, label: 'Time', value: '{session_time}' },
            { visible: sessionData.showLocation, label: 'Location', value: '{session_location}' },
            {
              visible: sessionData.showMeetingLink,
              label: meetingLabel,
              value: '<a href="{session_meeting_url}">{session_meeting_url}</a>',
            },
            { visible: sessionData.showProject, label: projectLabel, value: '{project_name}' },
            { visible: sessionData.showPackage, label: packageLabel, value: '{project_package_name}' },
          ];

          let sessionHtml = '<div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">';
          sessionHtml += `<h3 style="margin: 0 0 12px 0;">${heading}</h3>`;

          detailRows.forEach((row) => {
            if (!row.visible) return;
            sessionHtml += `<p style="margin: 4px 0;"><strong>${row.label}:</strong> ${row.value}</p>`;
          });

          if (sessionData.showNotes) {
            const notesContent = sessionData.customNotes?.trim()
              ? replacePlaceholders(sessionData.customNotes, previewData)
              : '{session_notes}';
            sessionHtml += `<p style="margin: 4px 0;"><strong>Notes:</strong> ${notesContent}</p>`;
          }

          sessionHtml += '</div>';
          return replacePlaceholders(sessionHtml, previewData);
        }

      case 'cta':
        {
          const ctaData = block.data as CTABlockData;
          const buttonStyle = ctaData.variant === 'primary'
            ? 'background: #1f2937; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;'
            : ctaData.variant === 'secondary'
            ? 'background: transparent; color: #1f2937; padding: 12px 24px; text-decoration: none; border: 2px solid #1f2937; border-radius: 6px; display: inline-block; font-weight: bold;'
            : 'color: #1f2937; text-decoration: underline;';
        
          const href = ctaData.link || '#';
          const text = replacePlaceholders(ctaData.text || 'Click here', previewData);
        
          return `<div style="text-align: center; margin: 20px 0;"><a href="${href}" style="${buttonStyle}">${text}</a></div>`;
        }

      case 'image':
        {
          const imageData = block.data as ImageBlockData;
          if (!imageData.src && imageData.placeholder) {
            return '<div style="background: #f3f4f6; border: 2px dashed #d1d5db; padding: 40px; text-align: center; margin: 16px 0;"><p style="color: #6b7280; margin: 0;">Image placeholder</p></div>';
          }
        
          const imgAlt = replacePlaceholders(imageData.alt ?? '', previewData);
          const imgCaption = imageData.caption ? replacePlaceholders(imageData.caption, previewData) : '';
        
          let imageHtml = `<div style="text-align: center; margin: 16px 0;">`;
        
          if (imageData.link) {
            imageHtml += `<a href="${imageData.link}">`;
          }
        
          if (imageData.src) {
            imageHtml += `<img src="${imageData.src}" alt="${imgAlt}" style="max-width: 100%; height: auto;" />`;
          }
        
          if (imageData.link) {
            imageHtml += `</a>`;
          }
        
          if (imgCaption) {
            imageHtml += `<p style="font-size: 14px; color: #6b7280; margin: 8px 0 0 0; font-style: italic;">${imgCaption}</p>`;
          }
        
          imageHtml += `</div>`;
          return imageHtml;
        }

      case 'footer':
        {
          const footerData = block.data as FooterBlockData;
          let footerHtml = '<div style="border-top: 1px solid #e5e7eb; padding: 20px 0; margin-top: 30px; color: #6b7280; font-size: 14px;">';
        
          if (footerData.showStudioName) {
            footerHtml += '<p style="margin: 0 0 8px 0; font-weight: bold;">{studio_name}</p>';
          }
        
          if (footerData.showContactInfo) {
            footerHtml += '<p style="margin: 4px 0;">{studio_phone} | {studio_email}</p>';
          }
        
          if (footerData.customText) {
            footerHtml += `<p style="margin: 8px 0;">${footerData.customText}</p>`;
          }
        
          if (footerData.showUnsubscribe) {
            footerHtml += '<p style="margin: 8px 0;"><a href="#" style="color: #6b7280;">Unsubscribe</a></p>';
          }
        
          footerHtml += '</div>';
          return replacePlaceholders(footerHtml, previewData);
        }

      case 'divider':
        {
          const dividerData = block.data as DividerBlockData;
          if (dividerData.style === 'space') {
            const height = dividerData.height ?? 20;
            return `<div style="height: ${height}px;"></div>`;
          }
          const color = dividerData.color ?? '#e5e7eb';
          return `<hr style="border: none; border-top: 1px solid ${color}; margin: 20px 0;" />`;
        }

      case 'header':
        {
          const headerData = block.data as HeaderBlockData;
          const bgColor = headerData.backgroundColor ?? 'transparent';
          const logoAlign = headerData.logoAlignment ?? 'center';
        
          let headerHtml = `<div style="background: ${bgColor}; padding: 20px; text-align: ${logoAlign};">`;
        
          if (headerData.showLogo) {
            headerHtml += '<div style="margin-bottom: 10px;">[LOGO]</div>';
          }
        
          if (headerData.tagline) {
            const taglineColor = headerData.taglineColor ?? '#6b7280';
            headerHtml += `<p style="margin: 0; color: ${taglineColor};">${headerData.tagline}</p>`;
          }
        
          headerHtml += '</div>';
          return replacePlaceholders(headerHtml, previewData);
        }

      case 'raw-html':
        {
          const rawHtmlData = block.data as RawHTMLBlockData;
          return rawHtmlData.html ?? '';
        }

      default:
        return '<p>Unknown block type</p>';
    }
  });

  return htmlParts.join('\n');
}

// Convert blocks to plain text content
export function blocksToPlainText(blocks: TemplateBlock[], previewData: Record<string, string> = {}): string {
  if (!blocks || blocks.length === 0) {
    return 'No content';
  }

  const visibleBlocks = blocks.filter(block => block.visible).sort((a, b) => a.order - b.order);
  
  const textParts = visibleBlocks.map(block => {
    switch (block.type) {
      case 'text': {
        const textData = block.data as TextBlockData;
        return replacePlaceholders(textData.content ?? '', previewData);
      }

      case 'session-details': {
        const sessionData = block.data as SessionDetailsBlockData;
        const heading = sessionData.customLabel?.trim() || 'Session Details';
        let sessionText = `${heading}:\n`;

        if (sessionData.showName) {
          sessionText += 'Session: {session_name}\n';
        }
        if (sessionData.showType) {
          sessionText += 'Type: {session_type}\n';
        }
        if (sessionData.showDuration) {
          sessionText += 'Duration: {session_duration}\n';
        }
        if (sessionData.showStatus) {
          sessionText += 'Status: {session_status}\n';
        }
        if (sessionData.showDate) {
          sessionText += 'Date: {session_date}\n';
        }
        if (sessionData.showTime) {
          sessionText += 'Time: {session_time}\n';
        }
        if (sessionData.showLocation) {
          sessionText += 'Location: {session_location}\n';
        }
        if (sessionData.showMeetingLink) {
          sessionText += `${sessionData.meetingLabel || 'Meeting Link'}: {session_meeting_url}\n`;
        }
        if (sessionData.showProject) {
          sessionText += `${sessionData.projectLabel || 'Project'}: {project_name}\n`;
        }
        if (sessionData.showPackage) {
          sessionText += `${sessionData.packageLabel || 'Package'}: {project_package_name}\n`;
        }
        if (sessionData.showNotes) {
          const notesContent = sessionData.customNotes?.trim()
            ? replacePlaceholders(sessionData.customNotes, previewData)
            : '{session_notes}';
          sessionText += `Notes: ${notesContent}\n`;
        }

        return replacePlaceholders(sessionText, previewData);
      }

      case 'cta': {
        const ctaData = block.data as CTABlockData;
        const text = replacePlaceholders(ctaData.text ?? 'Click here', previewData);
        return ctaData.link ? `${text}: ${ctaData.link}` : text;
      }

      case 'footer': {
        const footerData = block.data as FooterBlockData;
        let footerText = '';

        if (footerData.showStudioName) {
          footerText += '{studio_name}\n';
        }

        if (footerData.showContactInfo) {
          footerText += '{studio_phone} | {studio_email}\n';
        }

        if (footerData.customText) {
          footerText += `${footerData.customText}\n`;
        }

        return replacePlaceholders(footerText, previewData);
      }

      case 'image': {
        const imageData = block.data as ImageBlockData;
        return imageData.caption ? replacePlaceholders(imageData.caption, previewData) : '[Image]';
      }

      case 'header': {
        const headerData = block.data as HeaderBlockData;
        return headerData.tagline ? replacePlaceholders(headerData.tagline, previewData) : '';
      }

      case 'divider':
        return '---';

      case 'raw-html': {
        const rawHtmlData = block.data as RawHTMLBlockData;
        return rawHtmlData.html ?? '';
      }

      default:
        return '';
    }
  });

  return textParts.filter(text => text.trim()).join('\n\n');
}

// Parse HTML content back to blocks (basic implementation)
export function htmlToBlocks(html: string): TemplateBlock[] {
  if (!html || html.trim() === '') {
    return [];
  }

  // This is a simplified implementation - in a real app you might use a proper HTML parser
  const blocks: TemplateBlock[] = [];
  
  // Try to extract basic text content
  const cleanText = html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (cleanText) {
    blocks.push({
      id: `text-${Date.now()}`,
      type: 'text',
      data: {
        content: cleanText,
        formatting: {
          fontSize: 'p' as const,
          alignment: 'left' as const
        }
      },
      visible: true,
      order: 0
    });
  }

  return blocks;
}

// Extract master content from blocks
export function blocksToMasterContent(blocks: TemplateBlock[]): string {
  return blocksToPlainText(blocks);
}
