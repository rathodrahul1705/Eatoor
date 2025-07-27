// In your navigation stack file
import { createStackNavigator } from '@react-navigation/stack';
import AddressScreen from '../auth/screens/home/AddressScreen';
import MapLocationPicker from '../auth/screens/home/MapLocationPicker';

const Stack = createStackNavigator();

function AddressStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AddressList" component={AddressScreen} />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPicker} />
    </Stack.Navigator>
  );
}