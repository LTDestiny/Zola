import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "@/modules/auth/authStore";
import { LoginScreen } from "@/modules/auth/screens/LoginScreen";
import { RegisterScreen } from "@/modules/auth/screens/RegisterScreen";
import { ChatListScreen } from "@/modules/chat/screens/ChatListScreen";
import { ChatDetailScreen } from "@/modules/chat/screens/ChatDetailScreen";
import { ProfileScreen } from "@/modules/profile/screens/ProfileScreen";
import { getMyProfile } from "@/modules/chat/api/chatApi";
import { useSocket } from "@/modules/chat/hooks/useSocket";
import { useUnread } from "@/modules/chat/hooks/useUnread";
import type { AuthStackParamList, ChatStackParamList, RootTabParamList } from "@/shared/types/navigation";
import { colors } from "@/shared/theme/colors";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const Tabs = createBottomTabNavigator<RootTabParamList>();

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator>
      <ChatStack.Screen name="ChatList" component={ChatListScreen} options={{ headerShown: false }} />
      <ChatStack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ headerShown: false }} />
    </ChatStack.Navigator>
  );
}

function MainTabs() {
  useSocket();
  const { totalUnreadCount } = useUnread();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="Chats"
        component={ChatStackNavigator}
        options={{
          title: "Chat",
          tabBarBadge: totalUnreadCount > 0 ? totalUnreadCount : undefined,
        }}
      />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: "Toi" }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const setProfile = useAuthStore((s) => s.setProfile);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void getMyProfile()
      .then((result) => setProfile(result.data))
      .catch(() => setProfile(null));
  }, [isLoggedIn, setProfile]);

  if (!bootstrapped) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Dang tai...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <MainTabs />
      ) : (
        <AuthStack.Navigator>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: "Dang nhap" }} />
          <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: "Dang ky" }} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
