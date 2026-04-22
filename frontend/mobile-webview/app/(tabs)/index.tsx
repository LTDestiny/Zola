import { useEffect, useRef, useState } from 'react';
import { BackHandler, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const BASE_URL = 'http://192.168.10.39:5173';

export default function HomeScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>(BASE_URL);
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [canGoBack]);

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    // Track URL changes - this is crucial for navigation
    if (navState.url) {
      setCurrentUrl(navState.url);
      console.log('WebView URL changed to:', navState.url);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Khong tai duoc trang chat</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Text style={styles.errorText}>URL hien tai: {currentUrl}</Text>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        source={{ uri: BASE_URL }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        databaseEnabled
        geolocationEnabled
        mixedContentMode="always"
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        scalesPageToFit
        startInLoadingState={false}
        incognito={false}
        onLoad={() => setErrorMessage(null)}
        onNavigationStateChange={handleNavigationStateChange}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setErrorMessage(`HTTP ${nativeEvent.statusCode} - ${nativeEvent.description}`);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setErrorMessage(nativeEvent.description || 'Unknown WebView error');
        }}
        injectedJavaScript={`
          (function() {
            console.log('WebView script injected');
            // Ensure React Router history API is working
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            history.pushState = function(...args) {
              originalPushState.apply(this, args);
              console.log('pushState called:', window.location.href);
            };
            
            history.replaceState = function(...args) {
              originalReplaceState.apply(this, args);
              console.log('replaceState called:', window.location.href);
            };
          })();
        `}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FEE2E2',
  },
  errorTitle: {
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorText: {
    color: '#7F1D1D',
  },
});