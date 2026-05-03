import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/modules/auth/authStore";
import { LoginScreen } from "@/modules/auth/screens/LoginScreen";
import { RegisterScreen } from "@/modules/auth/screens/RegisterScreen";
import { ForgotPasswordScreen } from "@/modules/auth/screens/ForgotPasswordScreen";
import { VerifyRegisterOtpScreen } from "@/modules/auth/screens/VerifyRegisterOtpScreen";
import { ChatListScreen } from "@/modules/chat/screens/ChatListScreen";
import { ChatDetailScreen } from "@/modules/chat/screens/ChatDetailScreen";
import { GroupSettingsScreen } from "@/modules/chat/screens/GroupSettingsScreen";
import { ContactsScreen } from "@/modules/chat/screens/ContactsScreen";
import { ProfileScreen } from "@/modules/profile/screens/ProfileScreen";
import { UserProfileScreen } from "@/modules/profile/screens/UserProfileScreen";
import { getMyProfile } from "@/modules/chat/api/chatApi";
import { useSocket } from "@/modules/chat/hooks/useSocket";
import { useUnread } from "@/modules/chat/hooks/useUnread";
import { useFriendRequestStore } from "@/modules/chat/store/friendRequestStore";
import type { AuthStackParamList, ChatStackParamList, RootTabParamList } from "@/shared/types/navigation";
import { colors, spacing, typography, shadows } from "@/shared/theme/colors";

// ═══════════════════════════════════════════════════════════════════════════════
// iOS PREMIUM TAB BAR - Zola + iMessage Style
// ═══════════════════════════════════════════════════════════════════════════════

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const Tabs = createBottomTabNavigator<RootTabParamList>();

// Tab Bar Icons (SF Symbols style)
function TabBarIcon({ name, focused }: { name: "chat" | "friend" | "profile"; focused: boolean }) {
  const iconColor = focused ? colors.tabBarActive : colors.tabBarInactive;

  const icons = {
    chat: focused ? "💬" : "💬",
    friend: focused ? "👥" : "👥",
    profile: focused ? "👤" : "👤",
  };

  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.tabIcon, { opacity: focused ? 1 : 0.6 }]}>{icons[name]}</Text>
    </View>
  );
}

// Tab Bar Badge
function TabBarBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <View style={styles.tabBadge}>
      <Text style={styles.tabBadgeText}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <ChatStack.Screen name="ChatList" component={ChatListScreen} />
      <ChatStack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <ChatStack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      <ChatStack.Screen name="UserProfile" component={UserProfileScreen} />
    </ChatStack.Navigator>
  );
}

function MainTabs() {
  useSocket();
  const { totalUnreadCount } = useUnread();
  const friendRequestUnread = useFriendRequestStore((s) => s.unreadCount);
  const insets = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm,
            height: 60 + (insets.bottom > 0 ? insets.bottom : spacing.sm),
          },
        ],
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="Chats"
        component={ChatStackNavigator}
        options={{
          title: "Tin nhắn",
          tabBarIcon: ({ focused }) => (
            <View>
              <TabBarIcon name="chat" focused={focused} />
              <TabBarBadge count={totalUnreadCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          title: "Danh bạ",
          tabBarIcon: ({ focused }) => (
            <View>
              <TabBarIcon name="friend" focused={focused} />
              <TabBarBadge count={friendRequestUnread} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Cá nhân",
          tabBarIcon: ({ focused }) => <TabBarIcon name="profile" focused={focused} />,
        }}
      />
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <MainTabs />
      ) : (
        <AuthStack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <AuthStack.Screen name="VerifyRegisterOtp" component={VerifyRegisterOtpScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  loadingText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.md,
  },
  tabBar: {
    backgroundColor: colors.tabBarBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    ...shadows.sm,
  },
  tabBarLabel: {
    ...typography.caption2,
    fontWeight: "500",
    marginTop: spacing.xs,
  },
  tabBarItem: {
    paddingTop: spacing.xs,
  },
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  tabBadgeText: {
    ...typography.caption2,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 10,
  },
});
