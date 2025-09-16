import { useCallback } from 'react';
import { LeadService, LeadWithCustomFields, CreateLeadData, UpdateLeadData } from '@/services/LeadService';
import { useEntityActions } from './useEntityActions';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/constants/entityConstants';

export interface UseLeadActionsOptions {
  onLeadCreated?: (lead: LeadWithCustomFields) => void;
  onLeadUpdated?: (lead: LeadWithCustomFields) => void;
  onLeadDeleted?: (leadId: string) => void;
  onStatusChanged?: (lead: LeadWithCustomFields) => void;
}

export function useLeadActions(options: UseLeadActionsOptions = {}) {
  const { executeAction, getActionState, clearActionState } = useEntityActions();
  const leadService = new LeadService();

  const createLead = useCallback(async (data: CreateLeadData) => {
    return executeAction(
      'createLead',
      () => leadService.createLead(data),
      {
        successMessage: SUCCESS_MESSAGES.CREATED('Lead'),
        onSuccess: options.onLeadCreated,
        errorMessage: ERROR_MESSAGES.CREATE_FAILED
      }
    );
  }, [leadService, options.onLeadCreated]);

  const updateLead = useCallback(async (id: string, data: UpdateLeadData) => {
    return executeAction(
      'updateLead',
      () => leadService.updateLead(id, data),
      {
        successMessage: SUCCESS_MESSAGES.UPDATED('Lead'),
        onSuccess: options.onLeadUpdated,
        errorMessage: ERROR_MESSAGES.UPDATE_FAILED
      }
    );
  }, [leadService, options.onLeadUpdated]);

  const deleteLead = useCallback(async (id: string) => {
    return executeAction(
      'deleteLead',
      () => leadService.deleteLead(id),
      {
        successMessage: SUCCESS_MESSAGES.DELETED('Lead'),
        onSuccess: () => options.onLeadDeleted?.(id),
        errorMessage: ERROR_MESSAGES.DELETE_FAILED
      }
    );
  }, [leadService, options.onLeadDeleted]);

  const updateCustomField = useCallback(async (
    leadId: string, 
    fieldKey: string, 
    value: string | null
  ) => {
    return executeAction(
      'updateCustomField',
      () => leadService.updateCustomField(leadId, fieldKey, value),
      {
        successMessage: 'Field updated successfully',
        errorMessage: 'Failed to update field'
      }
    );
  }, [leadService]);

  const changeLeadStatus = useCallback(async (
    leadId: string, 
    statusId: string
  ) => {
    const result = await executeAction(
      'changeStatus',
      () => leadService.updateLead(leadId, { status_id: statusId }),
      {
        successMessage: 'Lead status updated',
        onSuccess: options.onStatusChanged,
        errorMessage: 'Failed to update lead status'
      }
    );
    return result;
  }, [leadService, options.onStatusChanged]);

  const bulkUpdateLeads = useCallback(async (
    leadIds: string[], 
    data: Partial<UpdateLeadData>
  ) => {
    return executeAction(
      'bulkUpdate',
      async () => {
        const results = await Promise.all(
          leadIds.map(id => leadService.updateLead(id, data))
        );
        return results.filter(result => result !== null);
      },
      {
        successMessage: `${leadIds.length} leads updated successfully`,
        errorMessage: 'Failed to update some leads'
      }
    );
  }, [leadService]);

  // Action state getters
  const isCreating = getActionState('createLead').loading;
  const isUpdating = getActionState('updateLead').loading;
  const isDeleting = getActionState('deleteLead').loading;
  const isChangingStatus = getActionState('changeStatus').loading;
  const isUpdatingCustomField = getActionState('updateCustomField').loading;
  const isBulkUpdating = getActionState('bulkUpdate').loading;

  const createError = getActionState('createLead').error;
  const updateError = getActionState('updateLead').error;
  const deleteError = getActionState('deleteLead').error;
  const statusError = getActionState('changeStatus').error;

  const clearErrors = useCallback(() => {
    clearActionState('createLead');
    clearActionState('updateLead');
    clearActionState('deleteLead');
    clearActionState('changeStatus');
    clearActionState('updateCustomField');
    clearActionState('bulkUpdate');
  }, [clearActionState]);

  const hasAnyError = !!(createError || updateError || deleteError || statusError);
  const isAnyLoading = isCreating || isUpdating || isDeleting || isChangingStatus || 
                     isUpdatingCustomField || isBulkUpdating;

  return {
    // Actions
    createLead,
    updateLead,
    deleteLead,
    updateCustomField,
    changeLeadStatus,
    bulkUpdateLeads,
    
    // Loading states
    isCreating,
    isUpdating,
    isDeleting,
    isChangingStatus,
    isUpdatingCustomField,
    isBulkUpdating,
    isAnyLoading,
    
    // Error states
    createError,
    updateError,
    deleteError,
    statusError,
    hasAnyError,
    
    // Utilities
    clearErrors
  };
}