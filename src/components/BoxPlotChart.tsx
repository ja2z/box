import React, { useMemo, useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

/**
 * BoxPlot data point interface
 * Each boxplot data point is an array of [min, Q1, median, Q3, max]
 */
interface BoxPlotDataPoint {
  name: string;
  value: [number, number, number, number, number]; // [min, Q1, median, Q3, max]
}

interface BoxPlotChartProps {
  /** Array of boxplot data points, one per attribute group */
  data: BoxPlotDataPoint[];
  /** Y-axis label */
  yAxisName?: string;
  /** Format function for tooltip values */
  formatValue?: (value: number) => string;
  /** Configuration options from plugin config */
  config?: {
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
  };
}

/**
 * BoxPlotChart Component
 * 
 * Renders a box and whisker plot using Apache ECharts.
 * Accepts pre-calculated quartile data and displays it as a boxplot.
 */
const BoxPlotChart: React.FC<BoxPlotChartProps> = ({
  data,
  yAxisName = 'Value',
  formatValue = (val) => val.toLocaleString(),
  config = {},
}) => {
  // Extract x-axis category labels from data
  const categories = useMemo(() => {
    return data.map((item) => item.name);
  }, [data]);

  // Extract boxplot values (array of [min, Q1, median, Q3, max] arrays)
  const boxplotValues = useMemo(() => {
    return data.map((item) => item.value);
  }, [data]);

  // Calculate global min/max across all boxplots and add minimal padding for y-axis
  // This ensures all whiskers are fully visible without excessive blank space
  const yAxisConfig = useMemo(() => {
    if (boxplotValues.length === 0) {
      return { min: undefined, max: undefined };
    }

    // Find the absolute min (from all min whiskers) and max (from all max whiskers)
    let globalMin = Infinity;
    let globalMax = -Infinity;

    boxplotValues.forEach((value) => {
      const [boxMin, , , , boxMax] = value;
      if (isFinite(boxMin) && boxMin < globalMin) globalMin = boxMin;
      if (isFinite(boxMax) && boxMax > globalMax) globalMax = boxMax;
    });

    // If we have valid data, calculate padding
    if (isFinite(globalMin) && isFinite(globalMax)) {
      const range = globalMax - globalMin;
      
      // Calculate padding: use moderate percentage (8%) to ensure visibility
      // But keep it reasonable to avoid excessive blank space
      let topPadding: number;
      let bottomPadding: number;
      
      if (range === 0) {
        // If all values are the same, add small padding based on the value itself
        const basePadding = Math.max(Math.abs(globalMax) * 0.08, 1);
        topPadding = basePadding;
        bottomPadding = basePadding;
      } else {
        // Use 8% of range for padding - enough to show whiskers without excessive space
        // This prevents excessive blank space while still showing whiskers
        const rangeBasedPadding = range * 0.08;
        // For very small ranges, use absolute minimum
        const minPadding = Math.max(range * 0.03, 1);
        
        topPadding = Math.max(rangeBasedPadding, minPadding);
        bottomPadding = Math.max(rangeBasedPadding, minPadding);
      }

      // Calculate min/max with padding, but don't go negative if all values are positive
      let calculatedMin = globalMin - bottomPadding;
      let calculatedMax = globalMax + topPadding;
      
      // If all values are positive, don't let min go below zero (unless data is actually negative)
      if (globalMin >= 0 && calculatedMin < 0) {
        calculatedMin = 0;
      }

      return {
        min: calculatedMin,
        max: calculatedMax,
      };
    }

    return { min: undefined, max: undefined };
  }, [boxplotValues]);

  // Parse formatting options with defaults
  const attributeLabelRotation = parseInt(config.attributeLabelRotation || '0', 10);
  const lineThickness = parseFloat(config.lineThickness || '1');
  const boxFillColor = config.boxFillColor || '#5470c6';
  const lineColor = config.lineColor || '#5470c6';
  const chartPadding = parseFloat(config.chartPadding || '10');
  const banding = config.banding !== false; // Default to true
  const bandingColor = config.bandingColor || '#f0f0f0';
  const xAxisFontSize = parseInt(config.xAxisFontSize || '12', 10);
  const xAxisFontColor = config.xAxisFontColor || '#333';
  const xAxisBold = config.xAxisBold === true;
  const yAxisFontSize = parseInt(config.yAxisFontSize || '12', 10);
  const yAxisFontColor = config.yAxisFontColor || '#333';
  const yAxisBold = config.yAxisBold === true;
  const gridLines = config.gridLines !== false; // Default to true
  const gridLineColor = config.gridLineColor || yAxisFontColor;

  // Container ref to get actual dimensions for responsive truncation
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);
  const [containerHeight, setContainerHeight] = useState<number>(600);

  // Update container dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Smart truncation formatter with proper height-based calculation for vertical labels
  const createSmartTruncationFormatter = useMemo(() => {
    const numCategories = categories.length;
    if (numCategories === 0) {
      return (value: string) => value || '';
    }

    const isVertical = attributeLabelRotation === 90;
    let maxCharsPerCategory: number;
    
    if (isVertical) {
      // For 90° labels: text extends vertically downward
      // Limit labels to a percentage of chart height to prevent squishing
      const maxLabelHeightPercent = 0.28; // Labels can use up to 28% of chart height
      const bottomGridPercent = attributeLabelRotation === 90 ? 0.15 : 0.08; // From grid.bottom
      
      // Calculate available height for the chart area (excluding labels)
      const availableChartHeight = containerHeight * (1 - bottomGridPercent);
      const maxLabelHeight = availableChartHeight * maxLabelHeightPercent;
      
      // Each character takes roughly fontSize pixels vertically
      // Add small buffer for spacing and ellipsis
      const pixelsPerChar = xAxisFontSize * 1.1;
      maxCharsPerCategory = Math.floor(maxLabelHeight / pixelsPerChar);
      
      // Set reasonable bounds for vertical labels
      const minChars = 10;
      const maxChars = 50; // Reasonable maximum to prevent excessive labels
      maxCharsPerCategory = Math.max(minChars, Math.min(maxChars, maxCharsPerCategory));
      
    } else {
      // For horizontal (0°) labels: use width-based calculation
      const availableWidthPercent = 100 - (chartPadding * 2);
      const pixelsPerChar = xAxisFontSize * 0.65;
      const effectiveWidth = containerWidth * (availableWidthPercent / 100);
      const pixelsPerCategory = effectiveWidth / numCategories;
      maxCharsPerCategory = Math.floor((pixelsPerCategory * 1.10) / pixelsPerChar);
      
      const minChars = 6;
      const maxChars = 100;
      maxCharsPerCategory = Math.max(minChars, Math.min(maxChars, maxCharsPerCategory));
    }

    return (value: string) => {
      if (!value) return '';
      if (value.length > maxCharsPerCategory) {
        return value.substring(0, maxCharsPerCategory - 1) + '…';
      }
      return value;
    };
  }, [categories.length, attributeLabelRotation, xAxisFontSize, chartPadding, containerWidth, containerHeight]);

  // ECharts configuration option
  const option: EChartsOption = useMemo(() => {
    return {
      animation: true,
      animationDuration: 2000,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          // Handle x-axis label tooltip - show full untruncated text
          if (params && Array.isArray(params) && params.length > 0) {
            const firstParam = params[0];
            if (firstParam.componentType === 'xAxis' && firstParam.componentSubType === 'category') {
              // Get original untruncated label from categories array
              const categoryIndex = firstParam.dataIndex || 0;
              return categories[categoryIndex] || '';
            }
            // If it's an array with series data, use the first param (boxplot)
            if (firstParam.componentType === 'series' && firstParam.seriesType === 'boxplot') {
              params = firstParam;
            }
          }
          
          // Handle single x-axis param
          if (params && params.componentType === 'xAxis' && params.componentSubType === 'category') {
            const categoryIndex = params.dataIndex || 0;
            return categories[categoryIndex] || '';
          }
          
          // Custom tooltip formatter to show all values nicely
          if (!params || params.componentType !== 'series' || params.seriesType !== 'boxplot') {
            return '';
          }

          // For ECharts boxplot, params.value should be the array [min, Q1, median, Q3, max]
          // Try multiple ways to extract the data to be robust
          let dataValue: [number, number, number, number, number] | null = null;
          
          // First try: params.value (most common for boxplot)
          if (Array.isArray(params.value) && params.value.length === 5) {
            dataValue = params.value as [number, number, number, number, number];
          }
          // Second try: params.data (if data is structured as objects)
          else if (params.data) {
            if (Array.isArray(params.data.value) && params.data.value.length === 5) {
              dataValue = params.data.value as [number, number, number, number, number];
            } else if (Array.isArray(params.data) && params.data.length === 5) {
              dataValue = params.data as [number, number, number, number, number];
            }
          }
          // Third try: Get from our data array using dataIndex
          if (!dataValue && typeof params.dataIndex === 'number' && params.dataIndex >= 0 && boxplotValues[params.dataIndex]) {
            const value = boxplotValues[params.dataIndex];
            if (Array.isArray(value) && value.length === 5) {
              dataValue = value as [number, number, number, number, number];
            }
          }

          // If we still don't have valid data, return empty
          if (!dataValue) {
            return '';
          }

          const [min, q1, median, q3, max] = dataValue;
          
          // Get FULL untruncated attribute name from categories array
          const categoryIndex = typeof params.dataIndex === 'number' ? params.dataIndex : 0;
          const attributeName = categories[categoryIndex] || params.name || '';

          // Format each value using the provided formatter
          const formattedMin = formatValue(min);
          const formattedQ1 = formatValue(q1);
          const formattedMedian = formatValue(median);
          const formattedQ3 = formatValue(q3);
          const formattedMax = formatValue(max);

          // Build tooltip HTML with one row per statistic
          return `
            <div style="padding: 8px; max-width: 300px;">
              <div style="font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; word-wrap: break-word;">
                ${attributeName}
              </div>
              <div style="line-height: 1.6;">
                <div><strong>Min:</strong> ${formattedMin}</div>
                <div><strong>Q1:</strong> ${formattedQ1}</div>
                <div><strong>Median:</strong> ${formattedMedian}</div>
                <div><strong>Q3:</strong> ${formattedQ3}</div>
                <div><strong>Max:</strong> ${formattedMax}</div>
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: `${chartPadding}%`,
        right: `${chartPadding}%`,
        bottom: attributeLabelRotation === 90 ? '15%' : '8%',
        top: `${chartPadding}%`,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: [0.15, 0.15], // Improved spacing between categories
        nameGap: attributeLabelRotation === 90 ? 10 : 30,
        splitArea: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        axisLabel: {
          rotate: attributeLabelRotation,
          interval: 0, // Show all labels
          fontSize: xAxisFontSize,
          color: xAxisFontColor,
          fontWeight: xAxisBold ? 'bold' : 'normal',
          // Smart truncation that considers available space per category
          formatter: createSmartTruncationFormatter,
          overflow: 'truncate',
          // Increased margin for better spacing between labels
          margin: attributeLabelRotation === 90 ? 10 : 8,
        },
        // Add tooltip for x-axis labels
        triggerEvent: true,
      },
      yAxis: {
        type: 'value',
        name: '', // Remove title
        nameTextStyle: {
          fontSize: yAxisFontSize,
          color: yAxisFontColor,
        },
        splitArea: {
          show: banding,
          areaStyle: {
            color: [bandingColor, 'transparent'],
          },
        },
        splitLine: {
          show: gridLines,
          lineStyle: {
            color: gridLineColor,
            width: 1,
          },
        },
        axisLabel: {
          fontSize: yAxisFontSize,
          color: yAxisFontColor,
          fontWeight: yAxisBold ? 'bold' : 'normal',
        },
        // Set min/max with calculated padding to ensure all whiskers are visible
        // The padding is minimal to avoid excessive blank space
        min: yAxisConfig.min,
        max: yAxisConfig.max,
        scale: false, // Don't use log scale, keep linear
      },
      series: [
        {
          name: 'boxplot',
          type: 'boxplot',
          data: boxplotValues,
          itemStyle: {
            color: boxFillColor,
            borderColor: lineColor,
            borderWidth: lineThickness,
          },
          // Configure whisker line style
          lineStyle: {
            color: lineColor,
            width: lineThickness,
          },
          emphasis: {
            itemStyle: {
              color: boxFillColor,
              borderColor: lineColor,
              borderWidth: lineThickness,
            },
          },
        },
      ],
    };
  }, [
    categories,
    boxplotValues,
    yAxisName,
    formatValue,
    yAxisConfig,
    attributeLabelRotation,
    lineThickness,
    boxFillColor,
    lineColor,
    chartPadding,
    banding,
    bandingColor,
    xAxisFontSize,
    xAxisFontColor,
    xAxisBold,
    yAxisFontSize,
    yAxisFontColor,
    yAxisBold,
    gridLines,
    gridLineColor,
    createSmartTruncationFormatter,
  ]);

  // Reference to the chart instance for resize handling
  const chartRef = useRef<any>(null);

  // Handle resize for responsive chart
  const onChartReady = (echartsInstance: any) => {
    chartRef.current = echartsInstance;
    const handleResize = () => {
      if (echartsInstance) {
        echartsInstance.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    
    // Trigger initial resize after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (echartsInstance) {
        echartsInstance.resize();
      }
    }, 100);
  };

  // Resize chart when data changes, option changes, or container dimensions change
  useEffect(() => {
    if (chartRef.current) {
      // Small delay to ensure container has dimensions
      const timer = setTimeout(() => {
        chartRef.current?.resize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data, option, containerWidth, containerHeight]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: '400px' }}>
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        onChartReady={onChartReady}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
};

export default BoxPlotChart;
export type { BoxPlotDataPoint, BoxPlotChartProps };