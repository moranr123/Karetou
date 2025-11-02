import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet, ActivityIndicator, ViewStyle, DimensionValue, View } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveText from './ResponsiveText';

interface ResponsiveButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  ...props
}) => {
  const { getButtonDimensions, fontSizes, spacing, borderRadius, getShadowStyle } = useResponsive();

  const getButtonStyle = () => {
    const baseStyle = {
      ...getButtonDimensions(),
      borderRadius: borderRadius.lg,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...getShadowStyle(2),
    };

    const sizeStyles = {
      sm: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        minHeight: 36,
      },
      md: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        minHeight: 44,
      },
      lg: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        minHeight: 52,
      },
    };

    const variantStyles = {
      primary: {
        backgroundColor: '#667eea',
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: '#6c757d',
        borderWidth: 0,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#667eea',
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
    };

    const stateStyles = {
      disabled: {
        opacity: 0.6,
      },
      loading: {
        opacity: 0.8,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(disabled && stateStyles.disabled),
      ...(loading && stateStyles.loading),
      ...(fullWidth && { width: '100%' as DimensionValue }),
    } as ViewStyle;
  };

  const getTextStyle = () => {
    const sizeStyles = {
      sm: fontSizes.sm,
      md: fontSizes.md,
      lg: fontSizes.lg,
    };

    const variantStyles = {
      primary: { color: '#fff' },
      secondary: { color: '#fff' },
      outline: { color: '#667eea' },
      ghost: { color: '#667eea' },
    };

    return {
      fontSize: sizeStyles[size],
      fontWeight: '600' as const,
      ...variantStyles[variant],
    };
  };

  const buttonStyle = StyleSheet.flatten([getButtonStyle(), style]);

  return (
    <TouchableOpacity
      style={buttonStyle}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' || variant === 'ghost' ? '#667eea' : '#fff'} 
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View style={{ marginRight: spacing.xs }}>
              {icon}
            </View>
          )}
          <ResponsiveText style={getTextStyle()}>
            {title}
          </ResponsiveText>
          {icon && iconPosition === 'right' && (
            <View style={{ marginLeft: spacing.xs }}>
              {icon}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

export default ResponsiveButton;




