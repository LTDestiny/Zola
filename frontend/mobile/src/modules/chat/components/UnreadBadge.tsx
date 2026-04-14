import { Text, View } from "react-native";

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ef4444",
        paddingHorizontal: 6,
      }}
    >
      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}
