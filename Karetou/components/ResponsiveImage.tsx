import React from 'react';
import { Image, ImageProps, StyleSheet, View, ActivityIndicator, ImageStyle, DimensionValue } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveImageProps extends Omit<ImageProps, 'borderRadius' | 'width' | 'height' | 'style'> {
  width?: number | string;
  height?: number | string;
  aspectRatio?: number;
  borderRadius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'round' | number;
  loading?: boolean;
  placeholder?: React.ReactNode;
  error?: React.ReactNode;
  containerStyle?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  style?: ImageStyle;
}

const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  width,
  height,
  aspectRatio,
  borderRadius = 'md',
  loading = false,
  placeholder,
  error,
  containerStyle,
  resizeMode = 'cover',
  style,
  ...props
}) => {
  const { getImageDimensions, borderRadius: borderRadiusValues, spacing } = useResponsive();

  const getBorderRadiusValue = (value: string | number | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return borderRadiusValues[value as keyof typeof borderRadiusValues];
    return borderRadiusValues.md;
  };

  const getImageStyle = () => {
    let imageWidth = width;
    let imageHeight = height;

    if (aspectRatio && !height) {
      const dimensions = getImageDimensions(aspectRatio);
      imageWidth = width || dimensions.width;
      imageHeight = dimensions.height;
    }

    return {
      width: typeof imageWidth === 'string' ? imageWidth as DimensionValue : imageWidth,
      height: typeof imageHeight === 'string' ? imageHeight as DimensionValue : imageHeight,
      borderRadius: getBorderRadiusValue(borderRadius),
    } as ImageStyle;
  };

  const imageStyle = StyleSheet.flatten([
    getImageStyle(),
    style,
  ]);

  const containerStyles = StyleSheet.flatten([
    {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f0f0f0',
    },
    containerStyle,
  ]);

  if (loading) {
    return (
      <View style={[containerStyles, imageStyle]}>
        <ActivityIndicator size="small" color="#667eea" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[containerStyles, imageStyle]}>
        {error}
      </View>
    );
  }

  if (placeholder) {
    return (
      <View style={[containerStyles, imageStyle]}>
        {placeholder}
      </View>
    );
  }

  return (
    <Image
      style={imageStyle}
      resizeMode={resizeMode}
      {...props}
    />
  );
};

export default ResponsiveImage;




