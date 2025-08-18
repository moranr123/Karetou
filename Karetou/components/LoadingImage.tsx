import React, { useState, useEffect } from 'react';
import { 
  View, 
  Image, 
  ActivityIndicator, 
  Text, 
  StyleSheet,
  ImageStyle,
  ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoadingImageProps {
  source: { uri: string };
  style: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  placeholder?: 'business' | 'image' | 'camera' | 'user';
  containerStyle?: ViewStyle;
}

// Cache to store loaded image URIs
const imageCache = new Set<string>();

const LoadingImage: React.FC<LoadingImageProps> = ({
  source,
  style,
  resizeMode = 'cover',
  placeholder = 'image',
  containerStyle
}) => {
  const [isLoading, setIsLoading] = useState(!imageCache.has(source.uri));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // If image is already cached, don't show loading
    if (imageCache.has(source.uri)) {
      setIsLoading(false);
      setHasError(false);
    } else {
      setIsLoading(true);
      setHasError(false);
    }
  }, [source.uri]);

  const getPlaceholderIcon = () => {
    switch (placeholder) {
      case 'business':
        return 'business';
      case 'camera':
        return 'camera';
      case 'user':
        return 'person-circle';
      default:
        return 'image-outline';
    }
  };

  const handleLoadStart = () => {
    if (!imageCache.has(source.uri)) {
      setIsLoading(true);
      setHasError(false);
    }
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    imageCache.add(source.uri); // Cache the loaded image
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    imageCache.delete(source.uri); // Remove from cache if error
  };

  return (
    <View style={[style, containerStyle, styles.container]}>
      <Image
        source={source}
        style={[style, hasError && styles.hiddenImage]}
        resizeMode={resizeMode}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />
      
      {(isLoading || hasError) && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#667eea" />
            </View>
          ) : hasError ? (
            <View style={styles.errorContainer}>
              <Ionicons name={getPlaceholderIcon()} size={24} color="#999" />
              <Text style={styles.errorText}>Failed to load</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
  },
  overlay: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  hiddenImage: {
    opacity: 0,
  },
});

export default LoadingImage; 