import React, { useState, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  RowSelectionState,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, Filter, X, ChevronLeft, ChevronRight, ChevronsLeft, CheckSquare } from 'lucide-react';
import { useFloating, FloatingPortal, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { DateTime } from 'luxon';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void;
  onSelectedRowsChange?: (selectedRows: T[]) => void;
}

interface DateFilterOption {
  label: string;
  value: string;
  getDateRange: () => [string, string];
}

const DATE_FILTER_OPTIONS: DateFilterOption[] = [
  {
    label: 'Today',
    value: 'today',
    getDateRange: () => {
      const today = DateTime.now();
      return [today.toISODate(), today.toISODate()];
    }
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getDateRange: () => {
      const yesterday = DateTime.now().minus({ days: 1 });
      return [yesterday.toISODate(), yesterday.toISODate()];
    }
  },
  {
    label: 'This Week',
    value: 'thisWeek',
    getDateRange: () => {
      const now = DateTime.now();
      const startOfWeek = now.startOf('week');
      return [startOfWeek.toISODate(), now.toISODate()];
    }
  },
  {
    label: 'Past Week',
    value: 'pastWeek',
    getDateRange: () => {
      const now = DateTime.now();
      const weekAgo = now.minus({ days: 7 });
      return [weekAgo.toISODate(), now.toISODate()];
    }
  },
  {
    label: 'This Month',
    value: 'thisMonth',
    getDateRange: () => {
      const now = DateTime.now();
      const startOfMonth = now.startOf('month');
      return [startOfMonth.toISODate(), now.toISODate()];
    }
  },
  {
    label: 'Past Month',
    value: 'pastMonth',
    getDateRange: () => {
      const now = DateTime.now();
      const monthAgo = now.minus({ months: 1 });
      return [monthAgo.toISODate(), now.toISODate()];
    }
  },
  {
    label: 'Last 7 Days',
    value: 'last7Days',
    getDateRange: () => {
      const now = DateTime.now();
      const sevenDaysAgo = now.minus({ days: 7 });
      return [sevenDaysAgo.toISODate(), now.toISODate()];
    }
  },
  {
    label: 'Last 30 Days',
    value: 'last30Days',
    getDateRange: () => {
      const now = DateTime.now();
      const thirtyDaysAgo = now.minus({ days: 30 });
      return [thirtyDaysAgo.toISODate(), now.toISODate()];
    }
  }
];

function DataTable<T>({ data, columns, rowSelection, onRowSelectionChange, onSelectedRowsChange }: DataTableProps<T>) {
  const [columnFilters, setColumnFilters] = useState<{ id: string; value: any }[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [paginationState, setPaginationState] = useState({
    pageIndex: 0,
    pageSize: 50,
  });
  const [selectedDateOptions, setSelectedDateOptions] = useState<{[columnId: string]: string[]}>({});
  const [customDateRanges, setCustomDateRanges] = useState<{[columnId: string]: [string, string]}>({});
  const filterRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns: [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="rounded bg-gray-700 border-gray-600"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded bg-gray-700 border-gray-600"
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 40,
      },
      ...columns
    ],
    getRowId: (row: any) => row.id?.toString(),
    state: {
      rowSelection,
      columnFilters,
      pagination: paginationState,
    },
    enableRowSelection: true,
    onRowSelectionChange,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPaginationState,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Floating UI setup for filter popover
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterRef.current && 
        !filterRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.filter-button')
      ) {
        setActiveFilter(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notify parent component of selection changes
  React.useEffect(() => {
    if (onSelectedRowsChange) {
      const selectedRows = table.getSelectedRowModel().rows.map(row => row.original);
      onSelectedRowsChange(selectedRows);
    }
  }, [rowSelection]);

  const handleDateOptionChange = (columnId: string, optionValue: string, checked: boolean) => {
    const currentOptions = selectedDateOptions[columnId] || [];
    let newOptions: string[];
    
    if (checked) {
      newOptions = [...currentOptions, optionValue];
    } else {
      newOptions = currentOptions.filter(opt => opt !== optionValue);
    }
    
    setSelectedDateOptions(prev => ({
      ...prev,
      [columnId]: newOptions
    }));
    
    // Apply the filter
    applyDateFilter(columnId, newOptions, customDateRanges[columnId]);
  };

  const handleCustomDateChange = (columnId: string, fromDate: string, toDate: string) => {
    const newRange: [string, string] = [fromDate, toDate];
    setCustomDateRanges(prev => ({
      ...prev,
      [columnId]: newRange
    }));
    
    // Apply the filter
    applyDateFilter(columnId, selectedDateOptions[columnId] || [], newRange);
  };

  const applyDateFilter = (columnId: string, options: string[], customRange?: [string, string]) => {
    const column = table.getColumn(columnId);
    if (!column) return;
    
    const dateRanges: [string, string][] = [];
    
    // Add predefined option ranges
    options.forEach(optionValue => {
      const option = DATE_FILTER_OPTIONS.find(opt => opt.value === optionValue);
      if (option) {
        dateRanges.push(option.getDateRange());
      }
    });
    
    // Add custom range if both dates are provided
    if (customRange && customRange[0] && customRange[1]) {
      dateRanges.push(customRange);
    }
    
    // Set the filter value
    if (dateRanges.length > 0) {
      column.setFilterValue(dateRanges);
    } else {
      column.setFilterValue(undefined);
    }
  };

  const clearDateFilter = (columnId: string) => {
    const column = table.getColumn(columnId);
    if (!column) return;
    
    column.setFilterValue(undefined);
    setSelectedDateOptions(prev => ({
      ...prev,
      [columnId]: []
    }));
    setCustomDateRanges(prev => ({
      ...prev,
      [columnId]: ['', '']
    }));
  };
  const renderFilterPopover = (columnId: string) => {
    const column = table.getColumn(columnId);
    if (!column) return null;

    // Special handling for date columns
    if (columnId === 'created_at' || columnId === 'converted_at') {
      const currentOptions = selectedDateOptions[columnId] || [];
      const currentCustomRange = customDateRanges[columnId] || ['', ''];
      
      return (
        <FloatingPortal>
          <div
            ref={(node) => {
              refs.setFloating(node);
              if (filterRef) filterRef.current = node;
            }}
            style={floatingStyles}
            className="z-50 bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Filter by Date</h4>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      // Check all options
                      const allOptions = DATE_FILTER_OPTIONS.map(opt => opt.value);
                      setSelectedDateOptions(prev => ({
                        ...prev,
                        [columnId]: allOptions
                      }));
                      applyDateFilter(columnId, allOptions, currentCustomRange);
                    }}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white"
                  >
                    Check All
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDateOptions(prev => ({
                        ...prev,
                        [columnId]: []
                      }));
                      applyDateFilter(columnId, [], currentCustomRange);
                    }}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white"
                  >
                    Uncheck All
                  </button>
                </div>
              </div>
              
              {/* Predefined Options */}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {DATE_FILTER_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={currentOptions.includes(option.value)}
                      onChange={(e) => handleDateOptionChange(columnId, option.value, e.target.checked)}
                      className="rounded bg-gray-600 border-gray-500"
                    />
                    <span className="text-sm text-white">{option.label}</span>
                  </label>
                ))}
              </div>
              
              {/* Custom Date Range */}
              <div className="border-t border-gray-700 pt-3">
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-1 rounded mb-2">
                  <input
                    type="checkbox"
                    checked={currentCustomRange[0] !== '' || currentCustomRange[1] !== ''}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        handleCustomDateChange(columnId, '', '');
                      }
                    }}
                    className="rounded bg-gray-600 border-gray-500"
                  />
                  <span className="text-sm text-white font-medium">Custom</span>
                </label>
                
                <div className="ml-6 space-y-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">From:</label>
                    <input
                      type="date"
                      value={currentCustomRange[0]}
                      onChange={(e) => handleCustomDateChange(columnId, e.target.value, currentCustomRange[1])}
                      className="w-full bg-gray-700 rounded px-2 py-1 text-sm text-white"
                      placeholder="mm/dd/yyyy"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">To:</label>
                    <input
                      type="date"
                      value={currentCustomRange[1]}
                      onChange={(e) => handleCustomDateChange(columnId, currentCustomRange[0], e.target.value)}
                      className="w-full bg-gray-700 rounded px-2 py-1 text-sm text-white"
                      placeholder="mm/dd/yyyy"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => clearDateFilter(columnId)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          </div>
        </FloatingPortal>
      );
    }
    const uniqueValues = Array.from(column.getFacetedUniqueValues().keys())
      .filter(value => value !== null && value !== undefined)
      .sort();

    return (
      <FloatingPortal>
        <div
          ref={(node) => {
            refs.setFloating(node);
            if (filterRef) filterRef.current = node;
          }}
          style={floatingStyles}
          className="z-50 bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-64 max-h-96 overflow-auto"
        >
          <div className="p-3 border-b border-gray-700">
            <input
              type="text"
              value={(column.getFilterValue() as string) ?? ''}
              onChange={e => column.setFilterValue(e.target.value)}
              placeholder="Search..."
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            />
          </div>
          
          <div className="p-2">
            {uniqueValues.map((value) => (
              <label key={value} className="flex items-center px-2 py-1 hover:bg-gray-700 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={((column.getFilterValue() as string[]) || []).includes(value)}
                  onChange={(e) => {
                    const filterValue = (column.getFilterValue() as string[]) || [];
                    if (e.target.checked) {
                      column.setFilterValue([...filterValue, value]);
                    } else {
                      column.setFilterValue(filterValue.filter(v => v !== value));
                    }
                  }}
                  className="rounded bg-gray-600 border-gray-500 mr-2"
                />
                <span className="text-sm text-white">{value}</span>
              </label>
            ))}
          </div>
        </div>
      </FloatingPortal>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-auto flex-1" ref={tableRef}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-gray-700">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-gray-300"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center space-x-2">
                        <div
                          className={
                            header.column.getCanSort()
                              ? 'flex items-center space-x-1 cursor-pointer select-none'
                              : ''
                          }
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {{
                            asc: <ChevronUp size={16} />,
                            desc: <ChevronDown size={16} />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                        
                        {header.column.getCanFilter() && (
                          <div className="relative" ref={refs.setReference}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFilter(activeFilter === header.column.id ? null : header.column.id);
                              }}
                              className={`filter-button text-gray-400 hover:text-white ${header.column.getFilterValue() ? 'text-blue-400' : ''}`}
                            >
                              {header.column.getFilterValue() ? (
                                <X size={14} onClick={(e) => {
                                  e.stopPropagation();
                                  header.column.setFilterValue(null);
                                }} />
                              ) : (
                                <Filter size={14} />
                              )}
                            </button>
                            {activeFilter === header.column.id && renderFilterPopover(header.column.id)}
                          </div>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className="border-b border-gray-700 hover:bg-gray-800 transition-colors"
              >
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id} 
                    className="px-4 py-3 text-white"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex items-center justify-between px-4 py-3 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <span>
            {table.getSelectedRowModel().rows.length} of {table.getRowModel().rows.length} row(s) selected
          </span>
          <span className="text-gray-600">|</span>
          <span>{table.getFilteredRowModel().rows.length} filtered leads</span>
          {table.getSelectedRowModel().rows.length < table.getFilteredRowModel().rows.length && (
            <>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => table.toggleAllRowsSelected(true)}
                className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 underline"
              >
                <CheckSquare size={14} />
                <span>Select all {table.getFilteredRowModel().rows.length} leads</span>
              </button>
            </>
          )}
          <span className="text-gray-600">|</span>
          <select
            value={paginationState.pageSize}
            onChange={e => setPaginationState(prev => ({
              ...prev,
              pageSize: Number(e.target.value),
              pageIndex: 0, // Reset to first page when changing page size
            }))}
            className="bg-gray-700 rounded px-2 py-1 text-sm"
          >
            {[10, 25, 50, 100, 250].map(size => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
            {[500, 1000, 2500, 5000].map(size => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
            <option value={10000}>Show 10,000</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-50"
            title="Go to first page"
          >
            <ChevronsLeft size={20} />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-gray-400">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;