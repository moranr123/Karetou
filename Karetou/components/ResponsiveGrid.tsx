import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveGridProps extends ViewProps {
  children: React.ReactNode;
  columns?: number;
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  itemStyle?: any;
  containerStyle?: any;
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns,
  spacing = 'md',
  itemStyle,
  containerStyle,
  style,
  ...props
}) => {
  const { getGridColumns, spacing: spacingValues } = useResponsive();

  const getSpacingValue = (value: string | number | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return spacingValues[value as keyof typeof spacingValues];
    return spacingValues.md;
  };

  const gridColumns = columns || getGridColumns();
  const spacingValue = getSpacingValue(spacing);

  const gridStyle = StyleSheet.flatten([
    {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -spacingValue / 2,
    },
    containerStyle,
    style,
  ]);

  const itemStyles = StyleSheet.flatten([
    {
      width: `${100 / gridColumns}%`,
      paddingHorizontal: spacingValue / 2,
      paddingVertical: spacingValue / 2,
    },
    itemStyle,
  ]);

  const childrenArray = React.Children.toArray(children);

  return (
    <View style={gridStyle} {...props}>
      {childrenArray.map((child, index) => (
        <View key={index} style={itemStyles}>
          {child}
        </View>
      ))}
    </View>
  );
};

export default ResponsiveGrid;









