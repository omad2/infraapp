import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  View, 
  ActivityIndicator,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface ModernButtonProps extends TouchableOpacityProps {
  title: string;
  icon?: string;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  fullWidth?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const ModernButton: React.FC<ModernButtonProps> = ({
  title,
  icon,
  iconPosition = 'right',
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  containerStyle,
  textStyle,
  ...props
}) => {
  const getGradientColors = () => {
    switch (variant) {
      case 'primary':
        return ['#2AADAD', '#1a8a8a'] as const;
      case 'secondary':
        return ['#3a3a3a', '#2a2a2a'] as const;
      case 'outline':
        return ['transparent', 'transparent'] as const;
      default:
        return ['#2AADAD', '#1a8a8a'] as const;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'medium':
        return { paddingVertical: 12, paddingHorizontal: 20 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 20 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon as any} size={20} color="#FFFFFF" style={styles.iconLeft} />
          )}
          <Text style={[
            styles.buttonText, 
            { fontSize: getFontSize() },
            variant === 'outline' && styles.outlineText,
            textStyle
          ]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon as any} size={20} color="#FFFFFF" style={styles.iconRight} />
          )}
        </>
      )}
    </>
  );

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        style={[
          styles.buttonContainer,
          styles.outlineButton,
          fullWidth && styles.fullWidth,
          containerStyle
        ]}
        {...props}
      >
        <BlurView intensity={20} tint="dark" style={[styles.blurContainer, getPadding()]}>
          {renderContent()}
        </BlurView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.buttonContainer,
        fullWidth && styles.fullWidth,
        containerStyle
      ]}
      {...props}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientContainer, getPadding()]}
      >
        {renderContent()}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
  },
  fullWidth: {
    width: '100%',
  },
  gradientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
  },
  outlineButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  outlineText: {
    color: '#fff',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default ModernButton; 