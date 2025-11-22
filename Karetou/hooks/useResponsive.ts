import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import responsive from '../utils/responsive';

const useResponsive = () => {
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    isTablet: Dimensions.get('window').width > 768,
    isSmallDevice: Dimensions.get('window').width < 375 || Dimensions.get('window').height < 667,
    isLargeDevice: Dimensions.get('window').width > 414 || Dimensions.get('window').height > 844,
    breakpoint: Dimensions.get('window').width < 375 ? 'xs' : Dimensions.get('window').width < 414 ? 'sm' : Dimensions.get('window').width < 768 ? 'md' : 'lg',
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
        isTablet: window.width > 768,
        isSmallDevice: window.width < 375 || window.height < 667,
        isLargeDevice: window.width > 414 || window.height > 844,
        breakpoint: window.width < 375 ? 'xs' : window.width < 414 ? 'sm' : window.width < 768 ? 'md' : 'lg',
      });
    });

    return () => subscription?.remove();
  }, []);

  return {
    ...responsive,
    dimensions,
  };
};

export { useResponsive };
export default useResponsive;
