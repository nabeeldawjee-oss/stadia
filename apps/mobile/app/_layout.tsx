import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "../src/lib/api";
import { useAuthStore } from "../src/lib/auth-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications() {
  if (!Device.isDevice) return;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;
  const { data } = await Notifications.getExpoPushTokenAsync();
  return data;
}

export default function RootLayout() {
  const { token: authToken } = useAuthStore();

  useEffect(() => {
    if (!authToken) return;
    registerForPushNotifications().then(async (pushToken) => {
      if (pushToken) {
        await api.post("/api/device-tokens", {
          token: pushToken,
          platform: "ios",
        }).catch(() => {});
      }
    });
  }, [authToken]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
