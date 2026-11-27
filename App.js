import React from "react";
import { useFonts } from "expo-font";
import SplashScreen from "./src/screens/SplashScreen";
import RoomJourney from "./src/features/rooms/RoomJourney";

export default function App() {
  const [loaded, error] = useFonts({
    Geologica: require("./assets/fonts/Geologica-Variable.ttf"),
  });
  if (!loaded && !error) return <SplashScreen />;
  return <RoomJourney />;
}
