import { View, Text } from "react-native";
import SkyBackground from "@/components/SkyBackground";
import { Colors } from "@/constants/Colors";

// TODO: Today screen — current weather + outfit recommendation
export default function TodayScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.gradient.clearSky.colors[0] }}>
      <SkyBackground>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text>Today's weather + outfit</Text>
        </View>
      </SkyBackground>
    </View>
  );
}
