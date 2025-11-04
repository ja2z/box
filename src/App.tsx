import React, { useMemo } from 'react';
import BoxPlotChart, { BoxPlotDataPoint } from './components/BoxPlotChart';
import './App.css';
import {
  client,
  useConfig,
  useElementData,
  useElementColumns,
} from '@sigmacomputing/plugin';
import * as d3 from 'd3';

// Configure the editor panel with column mappings
client.config.configureEditorPanel([
  { name: 'source', type: 'element' },
  {
    name: 'attribute',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Attribute (Grouping Key)',
  },
  {
    name: 'minValue',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Min Value (Bottom of Whisker)',
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'maxValue',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Max Value (Top of Whisker)',
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'median',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Median (Center Line)',
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'quartile1',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Quartile 1 (Bottom of Box)',
    allowedTypes: ['number', 'integer'],
  },
  {
    name: 'quartile2',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Quartile 2 (Top of Box)',
    allowedTypes: ['number', 'integer'],
  },
  // Formatting section
  { name: 'formattingGroup', type: 'group', label: 'Formatting' },
  {
    name: 'attributeLabelRotation',
    type: 'radio',
    source: 'formattingGroup',
    label: 'Rotate Attribute Labels',
    values: ['0', '90'],
    defaultValue: '0',
    singleLine: true,
  },
  {
    name: 'lineThickness',
    type: 'text',
    source: 'formattingGroup',
    label: 'Line Thickness',
    placeholder: '1',
    defaultValue: '1',
  },
  {
    name: 'boxFillColor',
    type: 'color',
    source: 'formattingGroup',
    label: 'Box Fill Color',
  },
  {
    name: 'lineColor',
    type: 'color',
    source: 'formattingGroup',
    label: 'Line Color',
  },
  {
    name: 'chartPadding',
    type: 'text',
    source: 'formattingGroup',
    label: 'Chart Padding (%)',
    placeholder: '10',
    defaultValue: '10',
  },
  {
    name: 'banding',
    type: 'toggle',
    source: 'formattingGroup',
    label: 'Banding',
    defaultValue: true,
  },
  {
    name: 'bandingColor',
    type: 'color',
    source: 'formattingGroup',
    label: 'Banding Color',
  },
  {
    name: 'xAxisFontSize',
    type: 'text',
    source: 'formattingGroup',
    label: 'X Axis Font Size',
    placeholder: '12',
    defaultValue: '12',
  },
  {
    name: 'xAxisFontColor',
    type: 'color',
    source: 'formattingGroup',
    label: 'X Axis Font Color',
  },
  {
    name: 'xAxisBold',
    type: 'toggle',
    source: 'formattingGroup',
    label: 'Bold X Axis Labels',
    defaultValue: false,
  },
  {
    name: 'yAxisFontSize',
    type: 'text',
    source: 'formattingGroup',
    label: 'Y Axis Font Size',
    placeholder: '12',
    defaultValue: '12',
  },
  {
    name: 'yAxisFontColor',
    type: 'color',
    source: 'formattingGroup',
    label: 'Y Axis Font Color',
  },
  {
    name: 'yAxisBold',
    type: 'toggle',
    source: 'formattingGroup',
    label: 'Bold Y Axis Labels',
    defaultValue: false,
  },
  {
    name: 'gridLines',
    type: 'toggle',
    source: 'formattingGroup',
    label: 'Grid Lines',
    defaultValue: true,
  },
  {
    name: 'gridLineColor',
    type: 'color',
    source: 'formattingGroup',
    label: 'Grid Line Color',
  },
]);

// Extended column info interface to include formatting
interface ExtendedColumnInfo extends Record<string, any> {
  name: string;
  columnType: string;
  format?: {
    format: string;
  };
}

// Plugin configuration interface
interface BoxPlotConfig {
  source?: string;
  attribute?: string;
  minValue?: string;
  maxValue?: string;
  median?: string;
  quartile1?: string;
  quartile2?: string;
  // Formatting options
  attributeLabelRotation?: string;
  boxFillColor?: string;
  lineColor?: string;
  lineThickness?: string;
  chartPadding?: string;
  banding?: boolean;
  bandingColor?: string;
  xAxisFontSize?: string;
  xAxisFontColor?: string;
  xAxisBold?: boolean;
  yAxisFontSize?: string;
  yAxisFontColor?: string;
  yAxisBold?: boolean;
  gridLines?: boolean;
  gridLineColor?: string;
}

function App() {
  const config = useConfig() as BoxPlotConfig;
  const sigmaData = useElementData(config?.source || '');
  const columnInfo = useElementColumns(config?.source || '') as Record<
    string,
    ExtendedColumnInfo
  >;

  // Transform Sigma data format to ECharts boxplot format
  const boxplotData = useMemo<BoxPlotDataPoint[]>(() => {
    // Validation: Check if all required data is available
    if (
      !sigmaData ||
      !columnInfo ||
      !config.source ||
      !config.attribute ||
      !config.minValue ||
      !config.maxValue ||
      !config.median ||
      !config.quartile1 ||
      !config.quartile2
    ) {
      return [];
    }

    // Get column IDs from config
    const attributeColId = config.attribute;
    const minColId = config.minValue;
    const maxColId = config.maxValue;
    const medianColId = config.median;
    const q1ColId = config.quartile1;
    const q2ColId = config.quartile2;

    // Validate that all required columns exist in the data
    if (
      !sigmaData[attributeColId] ||
      !sigmaData[minColId] ||
      !sigmaData[maxColId] ||
      !sigmaData[medianColId] ||
      !sigmaData[q1ColId] ||
      !sigmaData[q2ColId]
    ) {
      return [];
    }

    // Get arrays for each column
    const attributeValues = sigmaData[attributeColId];
    const minValues = sigmaData[minColId];
    const maxValues = sigmaData[maxColId];
    const medianValues = sigmaData[medianColId];
    const q1Values = sigmaData[q1ColId];
    const q2Values = sigmaData[q2ColId];

    // Determine number of rows
    const numRows = attributeValues.length;

    // Transform each row into a boxplot data point
    const dataPoints: BoxPlotDataPoint[] = [];

    for (let i = 0; i < numRows; i++) {
      // Get values for this row, converting to numbers
      const min = Number(minValues[i]);
      const q1 = Number(q1Values[i]);
      const median = Number(medianValues[i]);
      const q2 = Number(q2Values[i]);
      const max = Number(maxValues[i]);

      // Skip row if any value is invalid (NaN, null, or undefined)
      if (
        isNaN(min) ||
        isNaN(q1) ||
        isNaN(median) ||
        isNaN(q2) ||
        isNaN(max) ||
        attributeValues[i] == null
      ) {
        continue;
      }

      // Get attribute name (convert to string for display)
      const attributeName = String(attributeValues[i]);

      // Create boxplot data point: [min, Q1, median, Q3, max]
      // Note: ECharts boxplot format is [min, Q1, median, Q3, max]
      dataPoints.push({
        name: attributeName,
        value: [min, q1, median, q2, max],
      });
    }

    return dataPoints;
  }, [sigmaData, columnInfo, config]);

  // Create value formatter function using column formatting if available
  const formatValue = useMemo(() => {
    // Try to get formatting from the median column (or any numeric column)
    const numericColumnId =
      config.median || config.minValue || config.maxValue;
    if (numericColumnId && columnInfo[numericColumnId]) {
      const column = columnInfo[numericColumnId];
      if (
        column.columnType === 'number' &&
        column.format?.format
      ) {
        try {
          // Create a d3 formatter from the format string
          const formatter = d3.format(column.format.format);
          return (value: number) => {
            try {
              return formatter(value);
            } catch (e) {
              return value.toLocaleString();
            }
          };
        } catch (e) {
          // If format is invalid, fall back to default
          return (value: number) => value.toLocaleString();
        }
      }
    }
    // Default formatter
    return (value: number) => value.toLocaleString();
  }, [columnInfo, config.median, config.minValue, config.maxValue]);

  // Get Y-axis label from column name (use median column as default)
  const yAxisName = useMemo(() => {
    if (config.median && columnInfo[config.median]) {
      return columnInfo[config.median].name;
    }
    return 'Value';
  }, [columnInfo, config.median]);

  // Show loading/empty state if no data
  if (!boxplotData || boxplotData.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#666',
        }}
      >
        {!config.source
          ? 'Please select a data source'
          : !config.attribute ||
            !config.minValue ||
            !config.maxValue ||
            !config.median ||
            !config.quartile1 ||
            !config.quartile2
          ? 'Please configure all required column mappings'
          : 'No data available'}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <BoxPlotChart
        data={boxplotData}
        yAxisName={yAxisName}
        formatValue={formatValue}
        config={config}
      />
    </div>
  );
}

export default App;

