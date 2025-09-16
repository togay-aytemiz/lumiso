import { memo, useMemo, useRef, useEffect, useState } from "react";
import { FixedSizeGrid as Grid } from "react-window";

interface VirtualizedCalendarGridProps {
  days: Date[];
  getEventsForDate: (date: Date) => any;
  renderDay: (day: Date, events: any, index: number) => React.ReactNode;
  columns: number;
  rowHeight: number;
  width: number;
  height: number;
}

const GridCell = memo(({ columnIndex, rowIndex, style, data }: any) => {
  const { days, getEventsForDate, renderDay, columns } = data;
  const dayIndex = rowIndex * columns + columnIndex;
  
  if (dayIndex >= days.length) {
    return <div style={style} />;
  }
  
  const day = days[dayIndex];
  const events = getEventsForDate(day);
  
  return (
    <div style={style}>
      {renderDay(day, events, dayIndex)}
    </div>
  );
});

GridCell.displayName = "GridCell";

/**
 * Virtualized calendar grid for handling large date ranges efficiently
 * Only renders visible calendar cells to improve performance
 */
export const VirtualizedCalendarGrid = memo<VirtualizedCalendarGridProps>(({
  days,
  getEventsForDate,
  renderDay,
  columns,
  rowHeight,
  width,
  height
}) => {
  const gridRef = useRef<Grid>(null);
  const [isReady, setIsReady] = useState(false);
  
  const rowCount = Math.ceil(days.length / columns);
  
  const itemData = useMemo(() => ({
    days,
    getEventsForDate,
    renderDay,
    columns
  }), [days, getEventsForDate, renderDay, columns]);

  // Ensure grid is ready before rendering
  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <div style={{ width, height }} className="bg-card rounded-xl border" />;
  }

  return (
    <Grid
      ref={gridRef}
      columnCount={columns}
      columnWidth={width / columns}
      height={height}
      rowCount={rowCount}
      rowHeight={rowHeight}
      width={width}
      itemData={itemData}
      className="bg-card rounded-xl border"
      style={{ outline: 'none' }}
    >
      {GridCell}
    </Grid>
  );
});

VirtualizedCalendarGrid.displayName = "VirtualizedCalendarGrid";