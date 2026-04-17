// CRITICAL: Must be imported FIRST before any STOMP usage
import "text-encoding-polyfill";

import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <ActionSheetProvider>
        <>
          <StatusBar style="dark" />
          <AppNavigator />
        </>
      </ActionSheetProvider>
    </SafeAreaProvider>
  );
}
