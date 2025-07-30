import React from "react";

/**
 * Unified lead status color utility
 * Provides consistent styling for lead status badges across the entire application
 */

export type LeadStatus = 
  | 'new' 
  | 'contacted' 
  | 'qualified' 
  | 'proposal_sent' 
  | 'booked' 
  | 'lost' 
  | 'completed';

export interface StatusStyles {
  background: string;
  text: string;
  className: string;
}

/**
 * Get standardized Tailwind classes for lead status badges
 */
export function getLeadStatusStyles(status: string): StatusStyles {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  
  switch (normalizedStatus) {
    case 'new':
      return {
        background: 'bg-status-new-bg',
        text: 'text-status-new-text',
        className: 'bg-status-new-bg text-status-new-text'
      };
    case 'contacted':
      return {
        background: 'bg-status-contacted-bg',
        text: 'text-status-contacted-text',
        className: 'bg-status-contacted-bg text-status-contacted-text'
      };
    case 'qualified':
      return {
        background: 'bg-status-qualified-bg',
        text: 'text-status-qualified-text',
        className: 'bg-status-qualified-bg text-status-qualified-text'
      };
    case 'proposal_sent':
      return {
        background: 'bg-status-proposal-sent-bg',
        text: 'text-status-proposal-sent-text',
        className: 'bg-status-proposal-sent-bg text-status-proposal-sent-text'
      };
    case 'booked':
      return {
        background: 'bg-status-booked-bg',
        text: 'text-status-booked-text',
        className: 'bg-status-booked-bg text-status-booked-text'
      };
    case 'lost':
      return {
        background: 'bg-status-lost-bg',
        text: 'text-status-lost-text',
        className: 'bg-status-lost-bg text-status-lost-text'
      };
    case 'completed':
      return {
        background: 'bg-status-completed-bg',
        text: 'text-status-completed-text',
        className: 'bg-status-completed-bg text-status-completed-text'
      };
    default:
      // Fallback for unknown statuses
      return {
        background: 'bg-muted',
        text: 'text-muted-foreground',
        className: 'bg-muted text-muted-foreground'
      };
  }
}

/**
 * Format status text for display
 */
export function formatStatusText(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * React component wrapper for consistent status badge styling
 */
export interface StatusBadgeProps {
  status: string;
  className?: string;
  children?: React.ReactNode;
}

export function StatusBadge({ status, className = '', children }: StatusBadgeProps) {
  const styles = getLeadStatusStyles(status);
  const displayText = children || formatStatusText(status);
  
  return React.createElement(
    'span',
    { className: `px-2 py-1 text-xs rounded-full font-medium ${styles.className} ${className}` },
    displayText
  );
}