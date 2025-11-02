import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveContainerProps extends ViewProps {
  children: React.ReactNode;
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  margin?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
  maxWidth?: number | string;
  center?: boolean;
  fullWidth?: boolean;
  safeArea?: boolean;
}

const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  padding = 'lg',
  margin = 'sm',
  maxWidth,
  center = false,
  fullWidth = false,
  safeArea = false,
  style,
  ...props
}) => {
  const { spacing, screenDimensions, getSafeAreaInsets } = useResponsive();

  const getSpacingValue = (value: string | number | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return spacing[value as keyof typeof spacing];
    return spacing.lg;
  };

  const containerStyle = StyleSheet.flatten([
    {
      padding: getSpacingValue(padding),
      margin: getSpacingValue(margin),
      ...(maxWidth && { maxWidth }),
      ...(center && { alignSelf: 'center' }),
      ...(fullWidth && { width: '100%' }),
      ...(safeArea && { paddingTop: getSafeAreaInsets().top }),
    },
    style,
  ]);

  return (
    <View style={containerStyle} {...props}>
      {children}
    </View>
  );
};

export default ResponsiveContainer;




