import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveTextProps extends TextProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'xxxxl' | 'xxxxxl';
  weight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  children: React.ReactNode;
}

const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  size = 'md',
  weight = 'normal',
  color = '#333',
  align = 'left',
  style,
  children,
  ...props
}) => {
  const { fontSizes } = useResponsive();

  const textStyle = StyleSheet.flatten([
    {
      fontSize: fontSizes[size],
      fontWeight: weight,
      color,
      textAlign: align,
    },
    style,
  ]);

  return (
    <Text style={textStyle} {...props}>
      {children}
    </Text>
  );
};

export default ResponsiveText;

