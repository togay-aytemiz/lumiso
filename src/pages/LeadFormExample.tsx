import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityForm, EntityFormField } from '@/components/common/EntityForm';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useLeadActions } from '@/hooks/useLeadActions';
import { CreateLeadData } from '@/services/LeadService';
import { entityFormFields, commonValidationRules } from '@/utils/validationUtils';
import { LEAD_STATUS_OPTIONS } from '@/constants/entityConstants';

const LeadFormExample = () => {
  const navigate = useNavigate();
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { 
    createLead, 
    isCreating, 
    createError,
    clearErrors 
  } = useLeadActions({
    onLeadCreated: (lead) => {
      setIsSubmitted(true);
      navigate(`/leads/${lead.id}`);
    }
  });

  // Define form fields using our centralized field definitions
  const formFields: EntityFormField[] = [
    entityFormFields.lead.name(),
    entityFormFields.lead.email(),
    entityFormFields.lead.phone(),
    {
      key: 'status_id',
      type: 'select',
      label: 'Status',
      required: true,
      options: LEAD_STATUS_OPTIONS.filter(opt => opt.value !== 'all').map(opt => ({
        value: opt.value,
        label: opt.label
      })),
      validation: [commonValidationRules.required()]
    },
    {
      key: 'due_date',
      type: 'date',
      label: 'Follow-up Date',
      validation: [commonValidationRules.futureDate()],
      helpText: 'Optional date for follow-up'
    },
    entityFormFields.lead.notes()
  ];

  const handleSubmit = async (formData: CreateLeadData) => {
    clearErrors(); // Clear any previous errors
    await createLead(formData);
  };

  const handleCancel = () => {
    navigate('/leads');
  };

  return (
    <ErrorBoundary>
      <div className="max-w-2xl mx-auto p-6">
        <EntityForm<CreateLeadData>
          title="Create New Lead"
          fields={formFields}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Create Lead"
          loading={isCreating}
          error={createError}
          validateOnChange={true}
          showCard={true}
        />
        
        {isSubmitted && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">Lead created successfully!</p>
            <p className="text-green-600 text-sm mt-1">Redirecting to lead details...</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default LeadFormExample;