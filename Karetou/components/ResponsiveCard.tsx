import React from 'react';
import { View, ViewProps, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveView from './ResponsiveView';

interface ResponsiveCardProps extends ViewProps {
  children: React.ReactNode;
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  margin?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  borderRadius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'round' | number;
  backgroundColor?: string;
  shadow?: boolean;
  elevation?: number;
  fullWidth?: boolean;
  width?: number | string;
  height?: number | string;
}

const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  padding = 'lg',
  margin = 'sm',
  borderRadius = 'lg',
  backgroundColor = '#fff',
  shadow = true,
  elevation = 2,
  fullWidth = false,
  width,
  height,
  style,
  ...props
}) => {
  const { getCardDimensions, getShadowStyle, spacing } = useResponsive();

  const getSpacingValue = (value: string | number | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return spacing[value as keyof typeof spacing];
    return undefined;
  };

  const cardStyle = StyleSheet.flatten([
    {
      padding: getSpacingValue(padding),
      margin: getSpacingValue(margin),
      borderRadius: getSpacingValue(borderRadius),
      backgroundColor,
      ...(shadow && getShadowStyle(elevation)),
      ...(fullWidth && { width: '100%' as DimensionValue }),
      ...(width && { width: typeof width === 'string' ? width as DimensionValue : width }),
      ...(height && { height: typeof height === 'string' ? height as DimensionValue : height }),
    } as ViewStyle,
    style,
  ]);

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
};

export default ResponsiveCard;




