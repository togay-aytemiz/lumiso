import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflow-builder.css';

import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { DelayNode } from './nodes/DelayNode';
import { WorkflowToolbar } from './WorkflowToolbar';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
};

interface WorkflowBuilderProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  readonly?: boolean;
}

export function WorkflowBuilder({ 
  initialNodes = [], 
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  readonly = false 
}: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge({ ...params, animated: true }, edges);
      setEdges(newEdges);
      onEdgesChange?.(newEdges);
    },
    [edges, setEdges, onEdgesChange]
  );

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChangeInternal(changes);
    // Get updated nodes after change
    setTimeout(() => {
      onNodesChange?.(nodes);
    }, 0);
  }, [onNodesChangeInternal, onNodesChange, nodes]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChangeInternal(changes);
    // Get updated edges after change
    setTimeout(() => {
      onEdgesChange?.(edges);
    }, 0);
  }, [onEdgesChangeInternal, onEdgesChange, edges]);

  const addNode = (type: string, position = { x: 100, y: 100 }) => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position,
      data: getDefaultNodeData(type),
    };
    
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    onNodesChange?.(updatedNodes);
  };

  const getDefaultNodeData = (type: string) => {
    switch (type) {
      case 'trigger':
        return {
          label: 'Trigger',
          triggerType: 'session_scheduled',
          conditions: {}
        };
      case 'action':
        return {
          label: 'Send Notification',
          actionType: 'send_email',
          channels: ['email'],
          templateId: '',
          delayMinutes: 0
        };
      case 'condition':
        return {
          label: 'Condition',
          field: '',
          operator: 'equals',
          value: ''
        };
      case 'delay':
        return {
          label: 'Wait',
          duration: 60,
          unit: 'minutes'
        };
      default:
        return { label: 'Unknown' };
    }
  };

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (!readonly) {
      setSelectedNode(node);
    }
  }, [readonly]);

  return (
    <div className="h-full w-full bg-background">
      {!readonly && (
        <WorkflowToolbar onAddNode={addNode} />
      )}
      <div style={{ height: readonly ? '100%' : 'calc(100% - 60px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={20} 
            size={1}
            color="hsl(var(--muted-foreground))"
          />
        </ReactFlow>
      </div>
      
      {selectedNode && (
        <div className="absolute top-4 right-4 w-80 bg-card border border-border rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold mb-3">Configure {String(selectedNode.data.label)}</h3>
          <p className="text-sm text-muted-foreground">
            Node configuration panel will go here
          </p>
        </div>
      )}
    </div>
  );
}