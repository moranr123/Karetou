import React from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveText from './ResponsiveText';

interface ResponsiveInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: any;
  inputStyle?: any;
  labelStyle?: any;
  errorStyle?: any;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'filled';
  size?: 'sm' | 'md' | 'lg';
}

const ResponsiveInput: React.FC<ResponsiveInputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  leftIcon,
  rightIcon,
  variant = 'outlined',
  size = 'md',
  style,
  ...props
}) => {
  const { getInputDimensions, fontSizes, spacing, borderRadius, colors } = useResponsive();

  const getSizeStyles = () => {
    const sizeStyles = {
      sm: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        fontSize: fontSizes.sm,
        minHeight: 40,
      },
      md: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        fontSize: fontSizes.md,
        minHeight: 48,
      },
      lg: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        fontSize: fontSizes.lg,
        minHeight: 56,
      },
    };
    return sizeStyles[size];
  };

  const getVariantStyles = () => {
    const variantStyles = {
      default: {
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        backgroundColor: 'transparent',
        borderRadius: 0,
      },
      outlined: {
        borderWidth: 1,
        borderColor: error ? '#e74c3c' : '#ddd',
        backgroundColor: 'transparent',
        borderRadius: borderRadius.md,
      },
      filled: {
        borderWidth: 0,
        backgroundColor: '#f8f9fa',
        borderRadius: borderRadius.md,
      },
    };
    return variantStyles[variant];
  };

  const inputContainerStyle = StyleSheet.flatten([
    {
      flexDirection: 'row',
      alignItems: 'center',
      ...getSizeStyles(),
      ...getVariantStyles(),
    },
    inputStyle,
    style,
  ]);

  const containerStyles = StyleSheet.flatten([
    {
      marginBottom: spacing.md,
    },
    containerStyle,
  ]);

  const labelStyles = StyleSheet.flatten([
    {
      fontSize: fontSizes.sm,
      fontWeight: '500',
      color: '#333',
      marginBottom: spacing.xs,
    },
    labelStyle,
  ]);

  const errorStyles = StyleSheet.flatten([
    {
      fontSize: fontSizes.xs,
      color: '#e74c3c',
      marginTop: spacing.xs,
    },
    errorStyle,
  ]);

  return (
    <View style={containerStyles}>
      {label && (
        <ResponsiveText style={labelStyles}>
          {label}
        </ResponsiveText>
      )}
      <View style={inputContainerStyle}>
        {leftIcon && (
          <View style={{ marginRight: spacing.sm }}>
            {leftIcon}
          </View>
        )}
        <TextInput
          style={[
            {
              flex: 1,
              fontSize: getSizeStyles().fontSize,
              color: '#333',
            },
            inputStyle,
          ]}
          placeholderTextColor="#999"
          {...props}
        />
        {rightIcon && (
          <View style={{ marginLeft: spacing.sm }}>
            {rightIcon}
          </View>
        )}
      </View>
      {error && (
        <ResponsiveText style={errorStyles}>
          {error}
        </ResponsiveText>
      )}
    </View>
  );
};

export default ResponsiveInput;








