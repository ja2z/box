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
  /** Measure axis label */
  measureAxisName?: string;
  /** Format function for tooltip values */
  formatValue?: (value: number) => string;
  /** Configuration options from plugin config */
  config?: {
    orientation?: string;
    attributeLabelRotation?: string;
    boxFillColor?: string;
    lineColor?: string;
    lineThickness?: string;
    chartPadding?: string;
    banding?: boolean;
    bandingColor?: string;
    attributeAxisFontSize?: string;
    attributeAxisFontColor?: string;
    attributeAxisBold?: boolean;
    measureAxisFontSize?: string;
    measureAxisFontColor?: string;
    measureAxisBold?: boolean;
    gridLines?: boolean;
    gridLineColor?: string;
    backgroundColor?: string;
  };
}

/**
 * BoxPlotChart Component
 * 
 * Renders a box and whisker plot using Apache ECharts with support for both
 * vertical and horizontal orientations. Accepts pre-calculated quartile data
 * and displays it with customizable styling and formatting.
 * 
 * Features:
 * - Vertical or horizontal orientation
 * - Smart label truncation based on available space
 * - Customizable colors, fonts, and styling
 * - Responsive design with automatic resizing
 * - Interactive tooltips with formatted values
 */
const BoxPlotChart: React.FC<BoxPlotChartProps> = ({
  data,
  measureAxisName = 'Value',
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

  // Parse orientation - default to vertical
  const orientation = config.orientation || 'vertical';
  const isHorizontal = orientation === 'horizontal';
  
  /**
   * Round a number to a "nice" value for axis labels
   * Rounds to the nearest nice step (1, 2, 5, 10, 20, 50, 100, etc. times a power of 10)
   * This ensures axis labels are consistent and readable
   */
  const roundToNiceNumber = (value: number, roundUp: boolean = true): number => {
    if (!isFinite(value) || value === 0) return value;
    
    const sign = value < 0 ? -1 : 1;
    const absValue = Math.abs(value);
    
    // Handle very small numbers
    if (absValue < 1) {
      const magnitude = Math.floor(Math.log10(absValue));
      const base = Math.pow(10, magnitude);
      const normalized = absValue / base;
      const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
      if (roundUp) {
        return sign * Math.ceil(normalized / niceStep) * niceStep * base;
      } else {
        return sign * Math.floor(normalized / niceStep) * niceStep * base;
      }
    }
    
    // Find the order of magnitude (power of 10)
    const magnitude = Math.floor(Math.log10(absValue));
    const base = Math.pow(10, magnitude);
    
    // Normalize the value to the base (e.g., 4893.58 -> 4.89358 with base 1000)
    const normalized = absValue / base;
    
    // Choose a nice step: prefer 1, 2, 5, then 10
    let niceStep: number;
    if (normalized <= 1) {
      niceStep = 1;
    } else if (normalized <= 2) {
      niceStep = 2;
    } else if (normalized <= 5) {
      niceStep = 5;
    } else {
      niceStep = 10;
    }
    
    // Round to the nice step
    if (roundUp) {
      const rounded = Math.ceil(normalized / niceStep) * niceStep * base;
      return sign * rounded;
    } else {
      const rounded = Math.floor(normalized / niceStep) * niceStep * base;
      return sign * rounded;
    }
  };

  // Calculate global min/max across all boxplots and add minimal padding for measure axis
  // This ensures all whiskers are fully visible without excessive blank space
  const measureAxisConfig = useMemo(() => {
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

      // Round max to a nice number for consistent axis labels
      // This ensures the last axis label matches the pattern of other labels (e.g., 1000, 2000, 3000, 4000, 5000)
      const roundedMax = roundToNiceNumber(calculatedMax, true);
      // Also round min down to a nice number for consistency
      const roundedMin = roundToNiceNumber(calculatedMin, false);

      return {
        min: roundedMin,
        max: roundedMax,
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
  const attributeAxisFontSize = parseInt(config.attributeAxisFontSize || '12', 10);
  const attributeAxisFontColor = config.attributeAxisFontColor || '#333';
  const attributeAxisBold = config.attributeAxisBold === true;
  const measureAxisFontSize = parseInt(config.measureAxisFontSize || '12', 10);
  const measureAxisFontColor = config.measureAxisFontColor || '#333';
  const measureAxisBold = config.measureAxisBold === true;
  const gridLines = config.gridLines !== false; // Default to true
  const gridLineColor = config.gridLineColor || measureAxisFontColor;
  const backgroundColor = config.backgroundColor || '#ffffff';


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
      // For 90Â° labels: text extends vertically downward
      // Limit labels to a percentage of chart height to prevent squishing
      const maxLabelHeightPercent = 0.28; // Labels can use up to 28% of chart height
      const bottomGridPercent = attributeLabelRotation === 90 ? 0.15 : 0.08; // From grid.bottom
      
      // Calculate available height for the chart area (excluding labels)
      const availableChartHeight = containerHeight * (1 - bottomGridPercent);
      const maxLabelHeight = availableChartHeight * maxLabelHeightPercent;
      
      // Each character takes roughly fontSize pixels vertically
      // Add small buffer for spacing and ellipsis
      const pixelsPerChar = attributeAxisFontSize * 1.1;
      maxCharsPerCategory = Math.floor(maxLabelHeight / pixelsPerChar);
      
      // Set reasonable bounds for vertical labels
      const minChars = 10;
      const maxChars = 50; // Reasonable maximum to prevent excessive labels
      maxCharsPerCategory = Math.max(minChars, Math.min(maxChars, maxCharsPerCategory));
      
    } else {
      // For horizontal (0Â°) labels: use width-based calculation
      const availableWidthPercent = 100 - (chartPadding * 2);
      const pixelsPerChar = attributeAxisFontSize * 0.65;
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
        return value.substring(0, maxCharsPerCategory - 1) + 'â€¦';
      }
      return value;
    };
  }, [categories.length, attributeLabelRotation, attributeAxisFontSize, chartPadding, containerWidth, containerHeight]);

  // ECharts configuration option
  const option: EChartsOption = useMemo(() => {
    return {
      backgroundColor: backgroundColor,
      animation: true,
      animationDuration: 1200,
      animationEasing: 'elasticOut',
      animationDelay: (idx: number) => idx * 50,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          // Handle attribute axis label tooltip - show full untruncated text
          // In vertical mode: attribute axis is xAxis, in horizontal mode: attribute axis is yAxis
          const attributeAxisType = isHorizontal ? 'yAxis' : 'xAxis';
          
          if (params && Array.isArray(params) && params.length > 0) {
            const firstParam = params[0];
            if (firstParam.componentType === attributeAxisType && firstParam.componentSubType === 'category') {
              const categoryIndex = firstParam.dataIndex || 0;
              return categories[categoryIndex] || '';
            }
            if (firstParam.componentType === 'series' && firstParam.seriesType === 'boxplot') {
              params = firstParam;
            }
          }
          
          // Handle single attribute axis param
          if (params && params.componentType === attributeAxisType && params.componentSubType === 'category') {
            const categoryIndex = params.dataIndex || 0;
            return categories[categoryIndex] || '';
          }
          
          // Custom tooltip formatter to show all values nicely
          if (!params || params.componentType !== 'series' || params.seriesType !== 'boxplot') {
            return '';
          }

          // For ECharts boxplot, params.value should be the array [min, Q1, median, Q3, max]
          let dataValue: [number, number, number, number, number] | null = null;
          
          if (Array.isArray(params.value) && params.value.length === 5) {
            dataValue = params.value as [number, number, number, number, number];
          }
          else if (params.data) {
            if (Array.isArray(params.data.value) && params.data.value.length === 5) {
              dataValue = params.data.value as [number, number, number, number, number];
            } else if (Array.isArray(params.data) && params.data.length === 5) {
              dataValue = params.data as [number, number, number, number, number];
            }
          }
          if (!dataValue && typeof params.dataIndex === 'number' && params.dataIndex >= 0 && boxplotValues[params.dataIndex]) {
            const value = boxplotValues[params.dataIndex];
            if (Array.isArray(value) && value.length === 5) {
              dataValue = value as [number, number, number, number, number];
            }
          }

          if (!dataValue) {
            return '';
          }

          const [min, q1, median, q3, max] = dataValue;
          
          const categoryIndex = typeof params.dataIndex === 'number' ? params.dataIndex : 0;
          const attributeName = categories[categoryIndex] || params.name || '';

          const formattedMin = formatValue(min);
          const formattedQ1 = formatValue(q1);
          const formattedMedian = formatValue(median);
          const formattedQ3 = formatValue(q3);
          const formattedMax = formatValue(max);

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
        bottom: attributeLabelRotation === 90 && !isHorizontal ? '15%' : '8%',
        top: `${chartPadding}%`,
        containLabel: true,
      },
      // Conditionally swap axes based on orientation
      ...(isHorizontal ? {
        // HORIZONTAL: Attribute axis is Y (vertical), Measure axis is X (horizontal)
        yAxis: {
          type: 'category',
          data: categories,
          boundaryGap: [0.15, 0.15],
          nameGap: attributeLabelRotation === 90 ? 10 : 30,
          splitArea: {
            show: false,
          },
          splitLine: {
            show: false,
          },
          axisLabel: {
            rotate: attributeLabelRotation,
            interval: 0,
            fontSize: attributeAxisFontSize,
            color: attributeAxisFontColor,
            fontWeight: attributeAxisBold ? 'bold' : 'normal',
            formatter: createSmartTruncationFormatter,
            overflow: 'truncate',
            margin: attributeLabelRotation === 90 ? 10 : 8,
          },
          triggerEvent: true,
        },
        xAxis: {
          type: 'value',
          name: '',
          nameTextStyle: {
            fontSize: measureAxisFontSize,
            color: measureAxisFontColor,
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
            fontSize: measureAxisFontSize,
            color: measureAxisFontColor,
            fontWeight: measureAxisBold ? 'bold' : 'normal',
          },
          min: measureAxisConfig.min,
          max: measureAxisConfig.max,
          scale: false,
        },
      } : {
        // VERTICAL: Attribute axis is X (horizontal), Measure axis is Y (vertical)
        xAxis: {
          type: 'category',
          data: categories,
          boundaryGap: [0.15, 0.15],
          nameGap: attributeLabelRotation === 90 ? 10 : 30,
          splitArea: {
            show: false,
          },
          splitLine: {
            show: false,
          },
          axisLabel: {
            rotate: attributeLabelRotation,
            interval: 0,
            fontSize: attributeAxisFontSize,
            color: attributeAxisFontColor,
            fontWeight: attributeAxisBold ? 'bold' : 'normal',
            formatter: createSmartTruncationFormatter,
            overflow: 'truncate',
            margin: attributeLabelRotation === 90 ? 10 : 8,
          },
          triggerEvent: true,
        },
        yAxis: {
          type: 'value',
          name: '',
          nameTextStyle: {
            fontSize: measureAxisFontSize,
            color: measureAxisFontColor,
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
            fontSize: measureAxisFontSize,
            color: measureAxisFontColor,
            fontWeight: measureAxisBold ? 'bold' : 'normal',
          },
          min: measureAxisConfig.min,
          max: measureAxisConfig.max,
          scale: false,
        },
      }),
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
    measureAxisName,
    formatValue,
    measureAxisConfig,
    orientation,
    isHorizontal,
    attributeLabelRotation,
    lineThickness,
    boxFillColor,
    lineColor,
    chartPadding,
    banding,
    bandingColor,
    attributeAxisFontSize,
    attributeAxisFontColor,
    attributeAxisBold,
    measureAxisFontSize,
    measureAxisFontColor,
    measureAxisBold,
    gridLines,
    gridLineColor,
    backgroundColor,
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