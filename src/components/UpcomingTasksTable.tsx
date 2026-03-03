import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { formatShortDate } from '../utils/dateUtils';

interface Task {
  id: string;
  name: string;
  date: string;
  propertyType?: string;
  assigned_user?: string;
}

interface UpcomingTasksTableProps {
  /** Array of tasks to display */
  tasks: Task[];
  /** Whether to show the Assigned To column (for rental properties) */
  showAssignedTo?: boolean;
  /** Whether to wrap in a Paper component */
  wrapInPaper?: boolean;
  /** Maximum height for scrollable area */
  maxHeight?: number;
  /** Paper styling props */
  paperSx?: object;
}

/**
 * Reusable Upcoming Tasks table component
 * Used in Property.tsx for both rental and non-rental property views
 */
const UpcomingTasksTable: React.FC<UpcomingTasksTableProps> = ({
  tasks,
  showAssignedTo = false,
  wrapInPaper = true,
  maxHeight = 180,
  paperSx = {},
}) => {
  const truncateLength = showAssignedTo ? 30 : 40;
  const taskColumnWidth = showAssignedTo ? '55%' : '75%';
  const dateColumnWidth = showAssignedTo ? '30%' : '25%';
  const colSpan = showAssignedTo ? 3 : 2;

  const headerStyle: React.CSSProperties = {
    textAlign: 'left',
    fontWeight: 550,
    fontSize: '1rem',
    color: '#343748',
    background: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    height: 40,
    lineHeight: '40px',
    padding: 0,
    margin: 0,
  };

  const content = (
    <>
      <Typography 
        variant="h5" 
        fontWeight={550} 
        sx={{ 
          textAlign: 'left', 
          color: '#343748', 
          fontFamily: 'Nunito, Arial, sans-serif', 
          fontSize: { xs: 18, sm: 22, md: 26 },
          mb: wrapInPaper ? 2 : 0,
        }}
      >
        Upcoming Tasks
        <span style={{ color: '#343748', fontWeight: 550, marginLeft: 10, fontSize: '0.9em' }}>
          ({tasks.length})
        </span>
      </Typography>
      <Box sx={{ 
        width: '100%', 
        overflowX: 'auto', 
        maxHeight: tasks.length > 5 ? 64 + 56 * 5 : maxHeight, 
        overflowY: tasks.length > 5 ? 'auto' : 'visible', 
        transition: 'max-height 0.2s' 
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          fontFamily: 'Nunito, Arial, sans-serif', 
          tableLayout: 'fixed' 
        }}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, width: taskColumnWidth }}>Task</th>
              <th style={{ ...headerStyle, width: dateColumnWidth }}>
                {showAssignedTo ? 'Date Completed' : 'Due Date'}
              </th>
              {showAssignedTo && (
                <th style={{ ...headerStyle, width: '15%' }}>Assigned To</th>
              )}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ padding: 0, border: 'none', height: 40, lineHeight: '40px', margin: 0 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    borderRadius: 2, 
                    background: '#fff', 
                    p: '12px 18px', 
                    fontWeight: 600, 
                    color: '#888' 
                  }}>
                    No upcoming tasks.
                  </Box>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id}>
                  <td style={{ 
                    padding: showAssignedTo ? 0 : '8px 12px', 
                    border: 'none', 
                    height: showAssignedTo ? 40 : 'auto', 
                    lineHeight: showAssignedTo ? '40px' : 'normal', 
                    margin: 0, 
                    overflow: 'hidden' 
                  }}>
                    <Box sx={{ 
                      fontWeight: 400, 
                      color: '#343748', 
                      fontSize: '1rem', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap', 
                      maxWidth: '100%' 
                    }}>
                      {task.name.length > truncateLength 
                        ? task.name.substring(0, truncateLength) + '...' 
                        : task.name}
                    </Box>
                  </td>
                  <td style={{ 
                    padding: showAssignedTo ? 0 : '8px 12px', 
                    border: 'none', 
                    height: showAssignedTo ? 40 : 'auto', 
                    lineHeight: showAssignedTo ? '40px' : 'normal', 
                    margin: 0 
                  }}>
                    <Box sx={{ fontWeight: 400, color: '#343748', fontSize: '1rem' }}>
                      {formatShortDate(task.date)}
                    </Box>
                  </td>
                  {showAssignedTo && (
                    <td style={{ padding: 0, border: 'none', height: 40, lineHeight: '40px', margin: 0 }}>
                      <Box sx={{ fontWeight: 400, color: '#343748', fontSize: '1rem' }}>
                        {task.assigned_user}
                      </Box>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Box>
    </>
  );

  if (wrapInPaper) {
    return (
      <Paper sx={{ 
        p: { xs: 2, sm: 3 }, 
        borderRadius: 2, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
        ...paperSx 
      }}>
        {content}
      </Paper>
    );
  }

  return <>{content}</>;
};

export default UpcomingTasksTable;
