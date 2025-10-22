import { Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive height calculation
export const responsiveHeight = (percentage: number): number => {
  return (screenHeight * percentage) / 100;
};

// Responsive width calculation
export const responsiveWidth = (percentage: number): number => {
  return (screenWidth * percentage) / 100;
};

// Responsive font size calculation
export const responsiveFontSize = (size: number): number => {
  const baseWidth = 375; // iPhone X width as base
  const scale = screenWidth / baseWidth;
  return Math.max(size * scale, 12); // Minimum font size of 12
};

// Spacing system
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Font sizes
export const fontSizes = {
  xs: responsiveFontSize(10),
  sm: responsiveFontSize(12),
  md: responsiveFontSize(14),
  lg: responsiveFontSize(16),
  xl: responsiveFontSize(18),
  xxl: responsiveFontSize(20),
  xxxl: responsiveFontSize(24),
};

// Icon sizes
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
  xxxl: 40,
  xxxxl: 48,
};

// Border radius
export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
};

// Device detection
export const isTablet = screenWidth >= 768;
export const isSmallDevice = screenWidth < 375;
export const isMediumDevice = screenWidth >= 375 && screenWidth < 414;
export const isLargeDevice = screenWidth >= 414;

// Breakpoint system
export const getCurrentBreakpoint = () => {
  if (screenWidth < 375) return 'xs';
  if (screenWidth < 414) return 'sm';
  if (screenWidth < 768) return 'md';
  if (screenWidth < 1024) return 'lg';
  return 'xl';
};

// Responsive width and height helpers
export const getResponsiveWidth = (percentage: number): number => {
  return responsiveWidth(percentage);
};

export const getResponsiveHeight = (percentage: number): number => {
  return responsiveHeight(percentage);
};

// Layout configuration
export const getLayoutConfig = () => {
  return {
    screenWidth,
    screenHeight,
    isTablet,
    isSmallDevice,
    isMediumDevice,
    isLargeDevice,
    breakpoint: getCurrentBreakpoint(),
  };
};

// Safe area insets (mock implementation for now)
export const getSafeAreaInsets = () => {
  return {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
};

// Card dimensions helper
export const getCardDimensions = (width?: number | string, height?: number | string) => {
  return {
    width: width || '100%',
    height: height || 'auto',
  };
};

// Shadow style helper
export const getShadowStyle = (elevation: number = 2) => {
  return {
    elevation,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: elevation / 2,
    },
    shadowOpacity: 0.1 + (elevation * 0.05),
    shadowRadius: elevation,
  };
};

// Button dimensions helper
export const getButtonDimensions = () => {
  return {
    minHeight: 44,
    minWidth: 100,
  };
};

// Input dimensions helper
export const getInputDimensions = () => {
  return {
    minHeight: 48,
    minWidth: 200,
  };
};

// Image dimensions helper
export const getImageDimensions = (aspectRatio: number) => {
  const baseWidth = screenWidth * 0.8; // 80% of screen width
  return {
    width: baseWidth,
    height: baseWidth / aspectRatio,
  };
};

// Grid columns helper
export const getGridColumns = () => {
  if (isTablet) return 3;
  if (isLargeDevice) return 2;
  return 1;
};

// Color palette
export const colors = {
  primary: '#667eea',
  secondary: '#6c757d',
  success: '#28a745',
  danger: '#dc3545',
  warning: '#ffc107',
  info: '#17a2b8',
  light: '#f8f9fa',
  dark: '#343a40',
  white: '#ffffff',
  black: '#000000',
  gray: {
    100: '#f8f9fa',
    200: '#e9ecef',
    300: '#dee2e6',
    400: '#ced4da',
    500: '#adb5bd',
    600: '#6c757d',
    700: '#495057',
    800: '#343a40',
    900: '#212529',
  },
};

// Screen dimensions
export const screenDimensions = {
  width: screenWidth,
  height: screenHeight,
};

// Default export with all utilities
const responsive = {
  responsiveHeight,
  responsiveWidth,
  responsiveFontSize,
  spacing,
  fontSizes,
  iconSizes,
  borderRadius,
  isTablet,
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  getCurrentBreakpoint,
  getResponsiveWidth,
  getResponsiveHeight,
  getLayoutConfig,
  getSafeAreaInsets,
  getCardDimensions,
  getShadowStyle,
  getButtonDimensions,
  getInputDimensions,
  getImageDimensions,
  getGridColumns,
  colors,
  screenDimensions,
};

export default responsive;
