import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveViewProps extends ViewProps {
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  margin?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  paddingHorizontal?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  paddingVertical?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  marginHorizontal?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  marginVertical?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  borderRadius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'round' | number;
  width?: number | string;
  height?: number | string;
  flex?: number;
  children: React.ReactNode;
}

const ResponsiveView: React.FC<ResponsiveViewProps> = ({
  padding,
  margin,
  paddingHorizontal,
  paddingVertical,
  marginHorizontal,
  marginVertical,
  borderRadius,
  width,
  height,
  flex,
  style,
  children,
  ...props
}) => {
  const { spacing, borderRadius: borderRadiusValues } = useResponsive();

  const getSpacingValue = (value: string | number | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return spacing[value as keyof typeof spacing];
    return undefined;
  };

  const getBorderRadiusValue = (value: string | number | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return borderRadiusValues[value as keyof typeof borderRadiusValues];
    return undefined;
  };

  const viewStyle = StyleSheet.flatten([
    {
      padding: getSpacingValue(padding),
      margin: getSpacingValue(margin),
      paddingHorizontal: getSpacingValue(paddingHorizontal),
      paddingVertical: getSpacingValue(paddingVertical),
      marginHorizontal: getSpacingValue(marginHorizontal),
      marginVertical: getSpacingValue(marginVertical),
      borderRadius: getBorderRadiusValue(borderRadius),
      width,
      height,
      flex,
    },
    style,
  ]);

  return (
    <View style={viewStyle} {...props}>
      {children}
    </View>
  );
};

export default ResponsiveView;




